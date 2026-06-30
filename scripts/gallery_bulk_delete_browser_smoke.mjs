#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API_BASE = process.env.MFLUX_API_BASE ?? "http://127.0.0.1:8189";
const UI_BASE = process.env.MFLUX_UI_BASE ?? "http://127.0.0.1:4173";
const DEBUG_PORT = Number(process.env.MFLUX_BROWSER_DEBUG_PORT ?? 9237);
const CHROME_USER_DATA_DIR = path.join(tmpdir(), `mflux-gallery-smoke-${process.pid}`);
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mP8z8BQDwAFgwJ/lxvt+wAAAABJRU5ErkJggg==",
  "base64"
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function expandConfiguredPath(value) {
  if (value.startsWith("~/")) {
    return path.join(homedir(), value.slice(2));
  }
  return path.isAbsolute(value) ? value : path.resolve(ROOT, value);
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`${url} returned non-JSON response: ${text.slice(0, 240)}`);
  }
  if (!response.ok) {
    throw new Error(`${url} failed with HTTP ${response.status}: ${text.slice(0, 240)}`);
  }
  return payload;
}

async function waitForJson(url, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await fetchJson(url);
    } catch (error) {
      lastError = error;
      await sleep(250);
    }
  }
  throw new Error(`${label} timed out: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

function chromePath() {
  const candidates = [
    process.env.CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ].filter(Boolean);
  const candidate = candidates.find((entry) => existsSync(entry));
  if (!candidate) {
    throw new Error("Chrome/Chromium not found. Set CHROME_BIN to run this browser smoke.");
  }
  return candidate;
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = new WebSocket(this.wsUrl);
      this.socket.addEventListener("open", () => resolve());
      this.socket.addEventListener("error", () => reject(new Error(`Failed to connect to ${this.wsUrl}`)), {
        once: true
      });
      this.socket.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data));
        if (!message.id) {
          return;
        }
        const pending = this.pending.get(message.id);
        if (!pending) {
          return;
        }
        this.pending.delete(message.id);
        if (message.error) {
          pending.reject(new Error(`${pending.method} failed: ${JSON.stringify(message.error)}`));
        } else {
          pending.resolve(message.result);
        }
      });
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { method, resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket?.close();
  }
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(`Browser evaluation failed: ${JSON.stringify(result.exceptionDetails)}`);
  }
  return result.result?.value;
}

async function waitForBrowserCondition(client, expression, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let lastValue;
  while (Date.now() < deadline) {
    lastValue = await evaluate(client, expression);
    if (lastValue === true || (lastValue && typeof lastValue === "object" && lastValue.ok === true)) {
      return lastValue;
    }
    await sleep(250);
  }
  throw new Error(`${label} timed out. Last value: ${JSON.stringify(lastValue)}`);
}

async function createSyntheticOutputs() {
  const config = await fetchJson(`${API_BASE}/api/config`);
  const outputDir = expandConfiguredPath(config.data.paths.outputDir);
  await mkdir(outputDir, { recursive: true });

  const stamp = Date.now();
  const commonQuery = `gallery bulk delete smoke ${stamp}`;
  const outputs = ["alpha", "bravo"].map((suffix, index) => {
    const id = `gallery_bulk_smoke_${stamp}_${suffix}`;
    const prompt = `${commonQuery} ${suffix}`;
    return {
      id,
      prompt,
      commonQuery,
      imagePath: path.join(outputDir, `${id}.png`),
      metadataPath: path.join(outputDir, `${id}.metadata.json`),
      metadata: {
        prompt,
        model: "z-image-turbo",
        seed: 9100 + index,
        width: 1,
        height: 1,
        steps: 1,
        guidance: 0,
        scheduler: "linear"
      }
    };
  });

  for (const output of outputs) {
    await writeFile(output.imagePath, PNG_BYTES);
    await writeFile(output.metadataPath, `${JSON.stringify(output.metadata, null, 2)}\n`);
  }

  return outputs;
}

async function launchChrome() {
  let stderr = "";
  const child = spawn(chromePath(), [
    "--headless=new",
    "--disable-gpu",
    "--disable-background-networking",
    "--disable-component-update",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${CHROME_USER_DATA_DIR}`,
    "--window-size=1440,1000",
    "about:blank"
  ]);
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  try {
    const targets = await waitForJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`, 10000, "Chrome target discovery");
    const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
    if (!page) {
      throw new Error("Chrome started but no page target was available");
    }
    return { child, page };
  } catch (error) {
    child.kill();
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${stderr.slice(-1000)}`);
  }
}

async function stopChrome(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 2500);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill();
  });
}

async function runBrowserSmoke(outputs) {
  const { child, page } = await launchChrome();
  const client = new CdpClient(page.webSocketDebuggerUrl);
  try {
    await client.connect();
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false
    });
    await client.send("Page.navigate", { url: `${UI_BASE}/gallery` });

    const idList = JSON.stringify(outputs.map((output) => output.id));
    await waitForBrowserCondition(
      client,
      `(() => {
        const ids = ${idList};
        const imageHits = ids.map((id) =>
          Array.from(document.images).some((image) => decodeURIComponent(image.src).includes(id))
        );
        return {
          ok: imageHits.every(Boolean),
          imageHits,
          cardCount: document.querySelectorAll(".group.relative").length,
          readyState: document.readyState,
          text: (document.body?.innerText ?? "").slice(0, 1000)
        };
      })()`,
      15000,
      "Synthetic gallery cards"
    );

    const filterQuery = JSON.stringify(outputs[0].commonQuery);
    const filterResult = await evaluate(
      client,
      `(() => {
        const input = Array.from(document.querySelectorAll("input")).find((candidate) =>
          candidate.getAttribute("placeholder") === "Search prompt, model, or path"
        );
        if (!input) {
          return { ok: false, reason: "missing search input", text: document.body.innerText.slice(0, 2000) };
        }
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        if (!setter) {
          return { ok: false, reason: "missing input value setter" };
        }
        setter.call(input, ${filterQuery});
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return { ok: true };
      })()`
    );
    if (!filterResult?.ok) {
      throw new Error(`Failed to filter synthetic outputs: ${JSON.stringify(filterResult)}`);
    }

    await waitForBrowserCondition(
      client,
      `(document.body?.innerText ?? "").includes("SELECT ALL FILTERED (2)")`,
      5000,
      "Filtered gallery toolbar"
    );

    const selectAllClicked = await evaluate(
      client,
      `(() => {
        const button = Array.from(document.querySelectorAll("button")).find((candidate) =>
          candidate.textContent.trim().includes("SELECT ALL FILTERED (2)")
        );
        if (!button) {
          return false;
        }
        button.click();
        return true;
      })()`
    );
    if (!selectAllClicked) {
      throw new Error("SELECT ALL FILTERED (2) button was not found");
    }

    await waitForBrowserCondition(
      client,
      `(document.body?.innerText ?? "").includes("SELECT 2 FILTERED OUTPUTS?")`,
      5000,
      "Filtered selection confirmation modal"
    );

    const selectConfirmClicked = await evaluate(
      client,
      `(() => {
        const button = Array.from(document.querySelectorAll("button")).find((candidate) =>
          candidate.textContent.trim() === "SELECT ALL"
        );
        if (!button) {
          return false;
        }
        button.click();
        return true;
      })()`
    );
    if (!selectConfirmClicked) {
      throw new Error("SELECT ALL confirmation button was not found");
    }

    await waitForBrowserCondition(
      client,
      `(document.body?.innerText ?? "").includes("DELETE SELECTED (2)")`,
      5000,
      "Bulk delete toolbar"
    );

    const deleteClicked = await evaluate(
      client,
      `(() => {
        const button = Array.from(document.querySelectorAll("button")).find((candidate) =>
          candidate.textContent.trim().includes("DELETE SELECTED (2)")
        );
        if (!button) {
          return false;
        }
        button.click();
        return true;
      })()`
    );
    if (!deleteClicked) {
      throw new Error("DELETE SELECTED (2) button was not found");
    }

    await waitForBrowserCondition(
      client,
      `(document.body?.innerText ?? "").includes("DELETE 2 OUTPUTS?")`,
      5000,
      "Bulk delete confirmation modal"
    );

    const confirmClicked = await evaluate(
      client,
      `(() => {
        const button = Array.from(document.querySelectorAll("button")).find((candidate) =>
          candidate.textContent.trim() === "DELETE ALL"
        );
        if (!button) {
          return false;
        }
        button.click();
        return true;
      })()`
    );
    if (!confirmClicked) {
      throw new Error("DELETE ALL confirmation button was not found");
    }

    await waitForBrowserCondition(
      client,
      `(document.body?.innerText ?? "").includes("Deleted 2 outputs from disk.")`,
      10000,
      "Bulk delete success notice"
    );
  } finally {
    client.close();
    await stopChrome(child);
    await rm(CHROME_USER_DATA_DIR, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
  }
}

async function assertDeleted(outputs) {
  const gallery = await fetchJson(`${API_BASE}/api/gallery`);
  const remainingIds = new Set(gallery.data.items.map((item) => item.id));
  const failures = outputs.flatMap((output) => {
    const found = [];
    if (existsSync(output.imagePath)) {
      found.push(output.imagePath);
    }
    if (existsSync(output.metadataPath)) {
      found.push(output.metadataPath);
    }
    if (remainingIds.has(output.id)) {
      found.push(`gallery:${output.id}`);
    }
    return found;
  });
  if (failures.length) {
    throw new Error(`Bulk delete left artifacts behind: ${failures.join(", ")}`);
  }
}

async function cleanup(outputs) {
  await Promise.all(
    outputs.flatMap((output) => [
      rm(output.imagePath, { force: true }),
      rm(output.metadataPath, { force: true })
    ])
  );
}

async function main() {
  const health = await fetchJson(`${API_BASE}/api/health`);
  if (!health.ok) {
    throw new Error("API health check failed");
  }
  await fetch(UI_BASE);

  const outputs = await createSyntheticOutputs();
  try {
    await runBrowserSmoke(outputs);
    await assertDeleted(outputs);
    console.log(
      "[PASS] Gallery browser bulk delete smoke — filtered 2 synthetic outputs, selected all, confirmed delete, files removed"
    );
  } catch (error) {
    await cleanup(outputs);
    throw error;
  }
}

main().catch((error) => {
  console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

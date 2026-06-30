#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const UI_BASE = process.env.MFLUX_UI_BASE ?? "http://127.0.0.1:4173";
const DEBUG_PORT = Number(process.env.MFLUX_BROWSER_DEBUG_PORT ?? 9238);
const CHROME_USER_DATA_DIR = path.join(tmpdir(), `mflux-navigation-state-${process.pid}`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForJson(url, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 240)}`);
      }
      return JSON.parse(text);
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

async function clickRoute(client, pathName) {
  const clicked = await evaluate(
    client,
    `(() => {
      const link = Array.from(document.querySelectorAll("a")).find((candidate) =>
        new URL(candidate.href).pathname === ${JSON.stringify(pathName)}
      );
      if (!link) {
        return false;
      }
      link.click();
      return true;
    })()`
  );
  if (!clicked) {
    throw new Error(`Route link was not found: ${pathName}`);
  }
  await waitForBrowserCondition(
    client,
    `window.location.pathname === ${JSON.stringify(pathName)}`,
    5000,
    `Route ${pathName}`
  );
}

async function runBrowserSmoke() {
  const { child, page } = await launchChrome();
  const client = new CdpClient(page.webSocketDebuggerUrl);
  const promptValue = `sticky txt2img prompt ${Date.now()}`;
  const galleryQuery = `sticky gallery query ${Date.now()}`;

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
    await client.send("Page.navigate", { url: `${UI_BASE}/txt2img` });

    await waitForBrowserCondition(
      client,
      `Boolean(document.querySelector('textarea[placeholder="Enter positive prompt"]'))`,
      15000,
      "Txt2Img prompt field"
    );

    const promptSet = await evaluate(
      client,
      `(() => {
        const textarea = document.querySelector('textarea[placeholder="Enter positive prompt"]');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
        if (!textarea || !setter) {
          return false;
        }
        setter.call(textarea, ${JSON.stringify(promptValue)});
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      })()`
    );
    if (!promptSet) {
      throw new Error("Failed to set Txt2Img prompt");
    }

    await clickRoute(client, "/gallery");
    await waitForBrowserCondition(
      client,
      `Boolean(document.querySelector('input[placeholder="Search prompt, model, or path"]'))`,
      15000,
      "Gallery search field"
    );

    const querySet = await evaluate(
      client,
      `(() => {
        const input = document.querySelector('input[placeholder="Search prompt, model, or path"]');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        if (!input || !setter) {
          return false;
        }
        setter.call(input, ${JSON.stringify(galleryQuery)});
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      })()`
    );
    if (!querySet) {
      throw new Error("Failed to set Gallery search query");
    }

    await clickRoute(client, "/models");
    await clickRoute(client, "/gallery");
    await waitForBrowserCondition(
      client,
      `document.querySelector('input[placeholder="Search prompt, model, or path"]')?.value === ${JSON.stringify(galleryQuery)}`,
      5000,
      "Gallery search state retained"
    );

    await clickRoute(client, "/txt2img");
    await waitForBrowserCondition(
      client,
      `document.querySelector('textarea[placeholder="Enter positive prompt"]')?.value === ${JSON.stringify(promptValue)}`,
      5000,
      "Txt2Img prompt state retained"
    );
  } finally {
    client.close();
    await stopChrome(child);
    await rm(CHROME_USER_DATA_DIR, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
  }
}

async function main() {
  await fetch(UI_BASE);
  await runBrowserSmoke();
  console.log("[PASS] Navigation state smoke — Txt2Img prompt and Gallery search survived route changes");
}

main().catch((error) => {
  console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Mirror Blue screenshot regression for Dashboard + Txt2Img.
 *
 * Usage:
 *   node scripts/screenshot_regression.mjs --update   # refresh baselines
 *   node scripts/screenshot_regression.mjs            # compare against baselines
 *
 * Requires UI dev server (4173) and API (8189). Set CHROME_BIN if needed.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASELINES_DIR = path.join(ROOT, "scripts", "screenshot_regression", "baselines");
const CURRENT_DIR = path.join(ROOT, "scripts", "screenshot_regression", ".current");
const DIFF_DIR = path.join(ROOT, "scripts", "screenshot_regression", ".diff");
const UI_BASE = process.env.MFLUX_UI_BASE ?? "http://127.0.0.1:4173";
const DEBUG_PORT = Number(process.env.MFLUX_SCREENSHOT_DEBUG_PORT ?? 9239);
const CHROME_USER_DATA_DIR = path.join(tmpdir(), `mflux-screenshot-regression-${process.pid}`);
const VIEWPORT = { width: 1440, height: 1000 };
const MAX_DIFF_PERCENT = Number(process.env.MFLUX_SCREENSHOT_MAX_DIFF ?? 1.0);
const UPDATE = process.argv.includes("--update");

const TARGETS = [
  {
    name: "dashboard",
    path: "/",
    ready: `Boolean(document.querySelector("h1")?.textContent?.includes("SYSTEM DASHBOARD"))`,
    stabilize: stabilizeDashboard
  },
  {
    name: "txt2img",
    path: "/txt2img",
    ready: `Boolean(document.querySelector('textarea[placeholder="Enter positive prompt"]'))`,
    stabilize: stabilizeTxt2Img
  }
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    throw new Error("Chrome/Chromium not found. Set CHROME_BIN to run screenshot regression.");
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
    if (lastValue === true) {
      return;
    }
    await sleep(250);
  }
  throw new Error(`${label} timed out. Last value: ${JSON.stringify(lastValue)}`);
}

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
    `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
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

async function stabilizeDashboard(client) {
  await evaluate(
    client,
    `(() => {
      const subtitle = document.querySelector(".content-shell main header p");
      if (subtitle) subtitle.textContent = "Live telemetry • 0 outputs indexed";

      const statValues = ["MACOS", "IDLE", "0", "Z-IMAGE TURBO"];
      document.querySelectorAll(".mirror-panel .titanium-text.font-headline").forEach((element, index) => {
        if (statValues[index]) element.textContent = statValues[index];
      });

      const telemetryValues = [
        "12.0 GB / 64.0 GB",
        "0.0 GB / 64.0 GB",
        "120.0 GB",
        "500.0 GB FREE / 1000.0 GB",
        "STANDBY"
      ];
      document.querySelectorAll(".recessed-panel .font-mono, .recessed-panel .font-headline").forEach((element, index) => {
        if (telemetryValues[index]) element.textContent = telemetryValues[index];
      });

      const recentOutputs = Array.from(document.querySelectorAll("h2")).find((heading) =>
        heading.textContent?.includes("RECENT OUTPUTS")
      );
      const aside = recentOutputs?.closest("aside");
      if (aside) aside.style.visibility = "hidden";

      return true;
    })()`
  );
}

async function stabilizeTxt2Img(client) {
  await evaluate(
    client,
    `(() => {
      const textarea = document.querySelector('textarea[placeholder="Enter positive prompt"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
      if (textarea && setter) {
        setter.call(textarea, "mirror blue regression baseline");
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }

      const version = document.querySelector(".module-reskin-page-header .font-label");
      if (version) version.textContent = "IDLE";

      return true;
    })()`
  );
}

async function captureScreenshot(client, outputPath) {
  await sleep(400);
  const result = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(result.data, "base64"));
}

async function captureTargets() {
  const { child, page } = await launchChrome();
  const client = new CdpClient(page.webSocketDebuggerUrl);
  const captures = [];

  try {
    await client.connect();
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      deviceScaleFactor: 1,
      mobile: false
    });

    for (const target of TARGETS) {
      await client.send("Page.navigate", { url: `${UI_BASE}${target.path}` });
      await waitForBrowserCondition(client, target.ready, 20000, `${target.name} ready`);
      await target.stabilize(client);
      const outputPath = path.join(UPDATE ? BASELINES_DIR : CURRENT_DIR, `${target.name}.png`);
      await captureScreenshot(client, outputPath);
      captures.push({ name: target.name, path: outputPath });
    }
  } finally {
    client.close();
    await stopChrome(child);
    await rm(CHROME_USER_DATA_DIR, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
  }

  return captures;
}

function compareCapture(name) {
  const baseline = path.join(BASELINES_DIR, `${name}.png`);
  const current = path.join(CURRENT_DIR, `${name}.png`);
  const diff = path.join(DIFF_DIR, `${name}.png`);
  const python = path.join(ROOT, ".venv", "bin", "python");
  const script = path.join(ROOT, "scripts", "screenshot_regression", "compare_screenshots.py");
  const result = spawnSync(
    python,
    [script, baseline, current, "--max-diff-percent", String(MAX_DIFF_PERCENT), "--write-diff", diff],
    { encoding: "utf8" }
  );
  process.stdout.write(result.stdout ?? "");
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new Error(`Screenshot regression failed for ${name}`);
  }
}

async function ensureServers() {
  const ui = await fetch(UI_BASE);
  if (!ui.ok) {
    throw new Error(`UI not reachable at ${UI_BASE}`);
  }
  const api = await fetch(process.env.MFLUX_API_BASE ?? "http://127.0.0.1:8189/api/health");
  if (!api.ok) {
    throw new Error("API not reachable at http://127.0.0.1:8189/api/health");
  }
}

async function main() {
  await ensureServers();
  const captures = await captureTargets();

  if (UPDATE) {
    for (const capture of captures) {
      console.log(`[UPDATED] ${capture.name} -> ${capture.path}`);
    }
    console.log(`[PASS] Screenshot baselines updated (${captures.length} surfaces)`);
    return;
  }

  for (const capture of captures) {
    const baseline = path.join(BASELINES_DIR, `${capture.name}.png`);
    if (!existsSync(baseline)) {
      throw new Error(`Missing baseline ${baseline}. Run with --update first.`);
    }
    compareCapture(capture.name);
    console.log(`[PASS] ${capture.name} matches baseline`);
  }

  console.log(`[PASS] Screenshot regression — ${captures.length} surfaces within ${MAX_DIFF_PERCENT}% diff`);
}

main().catch((error) => {
  console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
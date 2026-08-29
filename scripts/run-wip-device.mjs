import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseURL = new URL(process.argv[2] || "https://appmana.github.io/mobile-safari-emulator-lab/");
const systemIds = (process.argv[3] || "dos,nes,gba,ps1").split(",").filter(Boolean);
const date = new Date().toISOString().slice(0, 10);
const outputDirectory = path.resolve(process.argv[4] || path.join(root, "reports", "device-runs", date));
const discoveryURL = process.env.WIP_DISCOVERY_URL || "http://127.0.0.1:9221/json";
const timeoutMs = Number(process.env.WIP_TIMEOUT_MS || 90_000);

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function json(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function discover() {
  const devices = await json(discoveryURL);
  if (devices.length !== 1) throw new Error(`Expected one attached iOS device, found ${devices.length}`);
  const device = devices[0];
  const pages = await json(`http://${device.url}/json`);
  return { device, pages };
}

async function matchingPage(urlPrefix, exact = false) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { device, pages } = await discover();
    const page = pages.find((candidate) => exact ? candidate.url === urlPrefix : candidate.url.startsWith(urlPrefix));
    if (page) return { device, page };
    await delay(250);
  }
  throw new Error(`No inspectable page matched ${urlPrefix}`);
}

class WebKitConnection {
  constructor(webSocketURL) {
    this.socket = new WebSocket(webSocketURL);
    this.targetId = undefined;
    this.innerId = 0;
    this.outerId = 0;
    this.pending = new Map();
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => this.onMessage(event));
    const deadline = Date.now() + 15_000;
    while (!this.targetId && Date.now() < deadline) await delay(25);
    if (!this.targetId) throw new Error("WebKit did not announce a page target");
    return this;
  }

  onMessage(event) {
    const message = JSON.parse(event.data);
    if (message.method === "Target.targetCreated") {
      const info = message.params.targetInfo;
      if (!this.targetId && info.type === "page" && !info.isProvisional) this.targetId = info.targetId;
    }
    if (message.method === "Target.didCommitProvisionalTarget" && message.params.oldTargetId === this.targetId) {
      this.targetId = message.params.newTargetId;
    }
    if (message.method !== "Target.dispatchMessageFromTarget") return;
    const inner = JSON.parse(message.params.message);
    const pending = this.pending.get(inner.id);
    if (!pending) return;
    this.pending.delete(inner.id);
    clearTimeout(pending.timer);
    if (inner.error) pending.reject(new Error(inner.error.message));
    else pending.resolve(inner.result);
  }

  command(method, params = {}, commandTimeout = timeoutMs) {
    const innerId = ++this.innerId;
    const outerId = ++this.outerId;
    this.socket.send(JSON.stringify({
      id: outerId,
      method: "Target.sendMessageToTarget",
      params: {
        targetId: this.targetId,
        message: JSON.stringify({ id: innerId, method, params }),
      },
    }));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(innerId);
        reject(new Error(`${method} timed out`));
      }, commandTimeout);
      this.pending.set(innerId, { resolve, reject, timer });
    });
  }

  async evaluate(expression, { userGesture = false, awaitPromise = false } = {}) {
    const evaluation = await this.command("Runtime.evaluate", {
      expression,
      returnByValue: !awaitPromise,
      emulateUserGesture: userGesture,
      doNotPauseOnExceptionsAndMuteConsole: true,
    });
    if (evaluation.wasThrown) throw new Error(evaluation.result.description || "Evaluation failed");
    let result = evaluation.result;
    if (awaitPromise && result.objectId) {
      const awaited = await this.command("Runtime.awaitPromise", {
        promiseObjectId: result.objectId,
        returnByValue: true,
      });
      if (awaited.wasThrown) throw new Error(awaited.result.description || "Promise rejected");
      result = awaited.result;
    }
    return result.value;
  }

  close() {
    this.socket.close();
  }
}

async function navigate(destination) {
  const { pages } = await discover();
  const page = pages.find((candidate) => candidate.url.startsWith("http"));
  if (!page) throw new Error("Safari has no inspectable HTTP page to navigate");
  const connection = await new WebKitConnection(page.webSocketDebuggerUrl).open();
  await connection.evaluate(`location.assign(${JSON.stringify(destination)})`);
  await delay(750);
  connection.close();
  return matchingPage(destination, true);
}

async function resetToGallery() {
  const navigated = await navigate(baseURL.href);
  const connection = await new WebKitConnection(navigated.page.webSocketDebuggerUrl).open();
  try {
    await connection.command("Heap.gc", {}, 5_000);
  } finally {
    connection.close();
  }
  await delay(1_500);
}

async function waitFor(connection, expression, description, waitMs = timeoutMs) {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    try {
      if (await connection.evaluate(expression)) return;
    } catch {}
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function resumeEmulator(connection) {
  await connection.evaluate(`(async () => {
    const emulator = window.EJS_emulator;
    const resumeButton = [...document.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Click to resume Emulator'));
    resumeButton?.click();
    const contexts = new Set();
    const al = emulator?.Module?.AL?.currentCtx;
    if (al?.audioCtx) contexts.add(al.audioCtx);
    al?.sources?.forEach((source) => contexts.add(source?.gain?.context));
    await Promise.race([
      Promise.allSettled([...contexts].filter(Boolean).map((context) => context.resume())),
      new Promise((resolve) => setTimeout(resolve, 1_000)),
    ]);
    emulator?.play?.();
  })()`, { userGesture: true, awaitPromise: true });
  await waitFor(
    connection,
    "Number(window.EJS_emulator?.gameManager?.getFrameNum?.() || 0) > 0",
    "the emulator to advance its first frame",
    10_000,
  );
}

async function snapshot(connection, filename) {
  const viewport = JSON.parse(await connection.evaluate("JSON.stringify({width: innerWidth, height: innerHeight})"));
  const result = await connection.command("Page.snapshotRect", {
    x: 0,
    y: 0,
    width: viewport.width,
    height: viewport.height,
    coordinateSystem: "Viewport",
  });
  const match = result.dataURL?.match(/^data:image\/png;base64,(.+)$/);
  if (!match) throw new Error("Page.snapshotRect did not return a PNG data URL");
  await writeFile(filename, Buffer.from(match[1], "base64"));
}

async function snapshotFramebuffer(connection, filename) {
  const dataURL = await connection.evaluate(`new Promise((resolve, reject) => requestAnimationFrame(() => {
    try {
      const source = window.EJS_emulator.canvas;
      const gl = source.getContext('webgl2') || source.getContext('webgl');
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const raw = document.createElement('canvas');
      raw.width = width;
      raw.height = height;
      const rawContext = raw.getContext('2d');
      const image = rawContext.createImageData(width, height);
      image.data.set(pixels);
      rawContext.putImageData(image, 0, 0);
      const output = document.createElement('canvas');
      output.width = Math.min(1200, width);
      output.height = Math.round(height * output.width / width);
      const context = output.getContext('2d');
      context.translate(0, output.height);
      context.scale(1, -1);
      context.drawImage(raw, 0, 0, output.width, output.height);
      resolve(output.toDataURL('image/png'));
    } catch (error) {
      reject(error);
    }
  }))`, { awaitPromise: true });
  const match = dataURL?.match(/^data:image\/png;base64,(.+)$/);
  if (!match) throw new Error("Framebuffer capture did not return a PNG data URL");
  await writeFile(filename, Buffer.from(match[1], "base64"));
}

await mkdir(outputDirectory, { recursive: true });
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  transport: "ios-webkit-debug-proxy / WebKit Inspector Protocol",
  target: {},
  baseURL: baseURL.href,
  results: [],
  artifacts: [],
  failures: [],
};

// Start from the fixture-free gallery so a previous large Wasm instance can be
// released before the first measured run. The same reset happens between cores.
await resetToGallery();

for (const [systemIndex, systemId] of systemIds.entries()) {
  const destination = new URL(`?system=${encodeURIComponent(systemId)}`, baseURL).href;
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let connection;
    try {
      const navigated = await navigate(destination);
      connection = await new WebKitConnection(navigated.page.webSocketDebuggerUrl).open();
      await waitFor(
        connection,
        "document.readyState === 'complete' && window.__EMULATION_LAB__ && !document.querySelector('#launch-fixture')?.hidden",
        `${systemId} fixture readiness`,
      );
      const capabilities = JSON.parse(await connection.evaluate("JSON.stringify(window.__EMULATION_LAB__.capabilities())"));
      report.target = {
        productType: process.env.IPAD_PRODUCT_TYPE || "iPad",
        osVersion: navigated.device.deviceOSVersion,
        userAgent: capabilities.userAgent,
        platform: capabilities.platform,
        touchPoints: capabilities.touchPoints,
      };
      await connection.evaluate("document.querySelector('#launch-fixture').click()", { userGesture: true });
      await waitFor(
        connection,
        "['running', 'failed'].includes(window.__EMULATION_LAB__.status)",
        `${systemId} core startup`,
      );
      const startup = JSON.parse(await connection.evaluate("JSON.stringify({status: window.__EMULATION_LAB__.status, errors: window.__EMULATION_LAB__.errors})"));
      if (startup.status !== "running") throw new Error(`Core startup failed: ${startup.errors.join("; ") || "no browser error recorded"}`);
      await resumeEmulator(connection);
      await delay(1_000);
      const result = await connection.evaluate("window.__EMULATION_LAB__.runSmokeTest(5000)", { awaitPromise: true });
      if (result.status !== "passed") throw new Error(`Smoke test returned ${result.status}: ${JSON.stringify(result)}`);
      report.results.push(result);
      await snapshotFramebuffer(connection, path.join(outputDirectory, `${systemId}-frame.png`));
      await snapshot(connection, path.join(outputDirectory, `${systemId}.png`));
      report.artifacts.push({
        systemId,
        framebuffer: `${systemId}-frame.png`,
        page: `${systemId}.png`,
      });
      console.log(`${systemId}: ${result.status} at ${result.measuredFps} fps`);
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      if (attempt === 1) console.warn(`${systemId}: ${error}; retrying once`);
    } finally {
      connection?.close();
    }
    await delay(1_000);
  }
  if (lastError) {
    report.failures.push({ systemId, error: lastError instanceof Error ? lastError.message : String(lastError) });
    console.error(`${systemId}: ${lastError}`);
  }
  if (systemIndex < systemIds.length - 1) {
    await resetToGallery();
  }
}

report.completedAt = new Date().toISOString();
const reportPath = path.join(outputDirectory, "report.json");
await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(reportPath);
if (report.failures.length) process.exitCode = 1;

import { systems, systemById } from "./systems";
import type { LabApi, LabStatus, SmokeResult, SystemDefinition } from "./types";

const resultKey = "mobile-safari-emulator-lab.results.v1";
const errors: string[] = [];
let status: LabStatus = "idle";
let currentSystem: SystemDefinition | undefined;
let currentFixture = "";
let lastResult: SmokeResult | undefined;
let objectUrl: string | undefined;

function setStatus(next: LabStatus) {
  status = next;
  if (window.__EMULATION_LAB__) window.__EMULATION_LAB__.status = next;
  window.dispatchEvent(new CustomEvent("lab-status", { detail: next }));
}

function recordError(value: unknown) {
  const message = value instanceof Error ? `${value.name}: ${value.message}` : String(value);
  if (!errors.includes(message)) errors.push(message);
  window.dispatchEvent(new CustomEvent("lab-error", { detail: message }));
}

window.addEventListener("error", (event) => recordError(event.error || event.message));
window.addEventListener("unhandledrejection", (event) => recordError(event.reason));

function supportsWebGL2() {
  const canvas = document.createElement("canvas");
  return Boolean(canvas.getContext("webgl2"));
}

function capabilities() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    touchPoints: navigator.maxTouchPoints,
    crossOriginIsolated: window.crossOriginIsolated,
    sharedArrayBuffer: typeof SharedArrayBuffer === "function",
    webAssembly: typeof WebAssembly === "object",
    webgl2: supportsWebGL2(),
    gamepads: typeof navigator.getGamepads === "function",
    serviceWorker: "serviceWorker" in navigator,
    indexedDB: "indexedDB" in window,
  };
}

function canvasNonBlank(canvas: HTMLCanvasElement) {
  try {
    const sample = document.createElement("canvas");
    sample.width = 32;
    sample.height = 32;
    const context = sample.getContext("2d", { willReadFrequently: true });
    if (!context) return false;
    context.drawImage(canvas, 0, 0, 32, 32);
    const pixels = context.getImageData(0, 0, 32, 32).data;
    const first = [pixels[0], pixels[1], pixels[2], pixels[3]];
    for (let index = 4; index < pixels.length; index += 4) {
      if (
        pixels[index] !== first[0] ||
        pixels[index + 1] !== first[1] ||
        pixels[index + 2] !== first[2] ||
        pixels[index + 3] !== first[3]
      ) return true;
    }
    return false;
  } catch (error) {
    recordError(error);
    return false;
  }
}

async function capturedFrameNonBlank(canvas: HTMLCanvasElement) {
  const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl")) as WebGLRenderingContext | null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    if (canvasNonBlank(canvas)) return true;
    if (gl) {
      try {
        const pixel = new Uint8Array(4);
        const colors = new Set<string>();
        const steps = [0.08, 0.25, 0.42, 0.58, 0.75, 0.92];
        for (const x of steps) {
          for (const y of steps) {
            gl.readPixels(
              Math.min(canvas.width - 1, Math.floor(canvas.width * x)),
              Math.min(canvas.height - 1, Math.floor(canvas.height * y)),
              1,
              1,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              pixel,
            );
            colors.add(`${pixel[0]},${pixel[1]},${pixel[2]},${pixel[3]}`);
            if (colors.size > 1) return true;
          }
        }
      } catch (error) {
        recordError(error);
      }
    }
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  return false;
}

function audioState() {
  const module = window.EJS_emulator?.Module as any;
  const sources = module?.AL?.currentCtx?.sources;
  if (!sources || typeof sources.forEach !== "function") return "unavailable";
  let state = "unavailable";
  sources.forEach((source: any) => {
    state = source?.gain?.context?.state || state;
  });
  return state;
}

function storedResults(): SmokeResult[] {
  try {
    return JSON.parse(localStorage.getItem(resultKey) || "[]") as SmokeResult[];
  } catch {
    return [];
  }
}

function storeResult(result: SmokeResult) {
  const previous = storedResults().filter((item) => item.systemId !== result.systemId);
  localStorage.setItem(resultKey, JSON.stringify([...previous, result]));
}

async function runSmokeTest(sampleMs = 5000): Promise<SmokeResult> {
  if (!currentSystem || !window.EJS_emulator?.gameManager || !window.EJS_emulator.canvas) {
    throw new Error("The emulator is not running");
  }
  const startedAtDate = new Date();
  const startedAt = performance.now();
  const firstFrame = Number(window.EJS_emulator.gameManager.getFrameNum());
  await new Promise((resolve) => window.setTimeout(resolve, sampleMs));
  const lastFrame = Number(window.EJS_emulator.gameManager.getFrameNum());
  const durationMs = performance.now() - startedAt;
  const frameDelta = Math.max(0, lastFrame - firstFrame);
  const measuredFps = frameDelta / (durationMs / 1000);
  const canvas = window.EJS_emulator.canvas;
  const nonBlank = await capturedFrameNonBlank(canvas);
  const runErrors = [...errors];
  const passed = frameDelta > 0 && measuredFps >= 45 && nonBlank && !window.EJS_emulator.failedToStart;
  const result: SmokeResult = {
    schemaVersion: 1,
    runId: crypto.randomUUID(),
    systemId: currentSystem.id,
    systemName: currentSystem.name,
    core: currentSystem.core,
    fixture: currentFixture,
    status: passed ? "passed" : "failed",
    startedAt: startedAtDate.toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: Math.round(durationMs),
    frameDelta,
    measuredFps: Math.round(measuredFps * 10) / 10,
    canvas: { width: canvas.width, height: canvas.height, nonBlank },
    audioState: audioState(),
    crossOriginIsolated: window.crossOriginIsolated,
    sharedArrayBuffer: typeof SharedArrayBuffer === "function",
    webgl2: supportsWebGL2(),
    userAgent: navigator.userAgent,
    errors: runErrors,
  };
  lastResult = result;
  window.__EMULATION_LAB__.lastResult = result;
  storeResult(result);
  setStatus(passed ? "passed" : "failed");
  return result;
}

function simulateInput(button: number, value = 1, player = 0) {
  const manager = window.EJS_emulator?.gameManager;
  if (!manager) throw new Error("The emulator is not running");
  manager.simulateInput(player, button, value);
  if (value !== 0) window.setTimeout(() => manager.simulateInput(player, button, 0), 100);
}

export const labApi: LabApi = {
  schemaVersion: 1,
  status,
  errors,
  capabilities,
  runSmokeTest,
  simulateInput,
  exportResults: storedResults,
};

window.__EMULATION_LAB__ = labApi;

export function getResults() {
  return storedResults();
}

export function clearResults() {
  localStorage.removeItem(resultKey);
}

export function downloadResults() {
  const data = JSON.stringify({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    capabilities: capabilities(),
    systems: systems.map(({ id, name, core }) => ({ id, name, core })),
    results: storedResults(),
  }, null, 2);
  const href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `mobile-safari-emulator-lab-${new Date().toISOString().replaceAll(":", "-")}.json`;
  anchor.click();
  URL.revokeObjectURL(href);
}

export function resolveSystem(id: string | null) {
  return id ? systemById.get(id) : undefined;
}

export function launch(system: SystemDefinition, media: string | File, fixtureName: string) {
  currentSystem = system;
  currentFixture = fixtureName;
  errors.splice(0, errors.length);
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  if (media instanceof File) {
    objectUrl = URL.createObjectURL(media);
    window.EJS_gameUrl = objectUrl;
  } else {
    window.EJS_gameUrl = media;
  }
  window.__EMULATION_LAB__.systemId = system.id;
  window.EJS_player = "#emulator";
  window.EJS_gameName = fixtureName;
  window.EJS_core = system.core;
  window.EJS_pathtodata = `${import.meta.env.BASE_URL}vendor/emulatorjs/data/`;
  window.EJS_startOnLoaded = true;
  window.EJS_threads = system.threads;
  window.EJS_biosUrl = "";
  window.EJS_color = "#71d1ff";
  window.EJS_backgroundColor = "#050914";
  window.EJS_disableAutoLang = true;
  window.EJS_noAutoFocus = false;
  window.EJS_DEBUG_XX = true;
  window.EJS_ready = () => setStatus("ready");
  window.EJS_onGameStart = () => {
    setStatus("running");
    window.dispatchEvent(new CustomEvent("lab-running"));
  };
  setStatus("loading");
  const script = document.createElement("script");
  script.src = `${import.meta.env.BASE_URL}vendor/emulatorjs/data/loader.js`;
  script.onerror = () => {
    recordError("Failed to load EmulatorJS loader.js");
    setStatus("failed");
  };
  document.body.appendChild(script);
}

import "./style.css";
import { clearResults, downloadResults, getResults, labApi, launch, resolveSystem } from "./lab";
import { systems } from "./systems";
import type { SmokeResult, SystemDefinition } from "./types";

const app = document.querySelector<HTMLDivElement>("#app")!;

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[char] || char);
}

function capabilityBadges() {
  const caps = labApi.capabilities();
  const items: [string, unknown][] = [
    ["Wasm", caps.webAssembly],
    ["WebGL 2", caps.webgl2],
    ["Isolated", caps.crossOriginIsolated],
    ["Threads", caps.sharedArrayBuffer],
    ["Touch", Number(caps.touchPoints) > 0],
  ];
  return items.map(([name, value]) => `<span class="badge ${value ? "good" : "bad"}">${name}: ${value ? "yes" : "no"}</span>`).join("");
}

function resultBySystem() {
  return new Map(getResults().map((result) => [result.systemId, result]));
}

function renderGallery() {
  const results = resultBySystem();
  app.innerHTML = `
    <header class="hero">
      <p class="eyebrow">Local WebAssembly · Mobile Safari · Real device evidence</p>
      <h1>Mobile Safari Emulator Lab</h1>
      <p class="lede">Nine mature emulator families, one repeatable browser harness. No cloud-streamed gameplay.</p>
      <div class="badges">${capabilityBadges()}</div>
      <div class="actions">
        <button id="export-results" class="button secondary">Export results</button>
        <button id="clear-results" class="button ghost">Clear results</button>
      </div>
    </header>
    <main class="grid">
      ${systems.map((system) => {
        const result = results.get(system.id);
        const state = result ? result.status : "not run";
        return `
          <article class="card">
            <div class="card-heading">
              <div><span class="era">${system.era}</span><h2>${system.name}</h2></div>
              <span class="result ${state.replace(" ", "-")}">${state}</span>
            </div>
            <p>${system.description}</p>
            <dl><div><dt>Core</dt><dd>${system.core}</dd></div><div><dt>Media</dt><dd>${system.extensions.join(", ")}</dd></div></dl>
            ${result ? `<p class="metric">${result.measuredFps} fps · ${result.canvas.width}×${result.canvas.height} · audio ${result.audioState}</p>` : ""}
            <a class="button" href="?system=${system.id}">${system.fixture?.bundled ? "Run fixture" : "Choose media"}</a>
          </article>`;
      }).join("")}
    </main>
    <footer>EmulatorJS 4.2.3 stable · results stay in this browser until exported.</footer>
  `;
  document.querySelector("#export-results")?.addEventListener("click", downloadResults);
  document.querySelector("#clear-results")?.addEventListener("click", () => { clearResults(); renderGallery(); });
}

function resultMarkup(result: SmokeResult) {
  return `<pre class="result-json">${escapeHtml(JSON.stringify(result, null, 2))}</pre>`;
}

function renderPlayer(system: SystemDefinition) {
  const accept = system.extensions.map((extension) => `.${extension}`).join(",");
  app.innerHTML = `
    <main class="player-page">
      <nav><a href="./">← Matrix</a><span>${system.name} · ${system.core}</span></nav>
      <section class="player-intro">
        <div><p class="eyebrow">${system.era}</p><h1>${system.name}</h1><p>${system.description}</p></div>
        <div class="badges">${capabilityBadges()}</div>
      </section>
      <section class="launch-panel" id="launch-panel">
        ${system.fixture ? `<button id="launch-fixture" class="button" hidden>Start ${system.fixture.title}</button>` : ""}
        <label class="button secondary file-button">Open local ${system.extensions.join("/").toUpperCase()}<input id="media-file" type="file" accept="${accept}" /></label>
        ${system.notes ? `<p class="note">${system.notes}</p>` : ""}
      </section>
      <section class="emulator-shell"><div id="emulator"><div class="placeholder">Choose test media to initialize the core.</div></div></section>
      <section class="diagnostics">
        <div><span>Status</span><strong id="lab-status">idle</strong></div>
        <div><span>Errors</span><strong id="error-count">0</strong></div>
        <button id="smoke-test" class="button" disabled>Measure 5 seconds</button>
      </section>
      <section id="result-output"></section>
    </main>
  `;
  const launchPanel = document.querySelector<HTMLElement>("#launch-panel")!;
  const status = document.querySelector<HTMLElement>("#lab-status")!;
  const errorCount = document.querySelector<HTMLElement>("#error-count")!;
  const smokeButton = document.querySelector<HTMLButtonElement>("#smoke-test")!;
  const output = document.querySelector<HTMLElement>("#result-output")!;

  const start = (media: string | File, name: string) => {
    launchPanel.querySelectorAll("button,input").forEach((element) => (element as HTMLInputElement).disabled = true);
    launch(system, media, name);
  };
  if (system.fixture) {
    fetch(`${import.meta.env.BASE_URL}fixtures/manifest.json`)
      .then((response) => response.ok ? response.json() : [])
      .then((manifest: Array<{ file: string }>) => {
        if (manifest.some(({ file }) => file === system.fixture?.file)) {
          document.querySelector<HTMLButtonElement>("#launch-fixture")!.hidden = false;
        }
      })
      .catch(() => undefined);
  }
  document.querySelector("#launch-fixture")?.addEventListener("click", () => {
    if (system.fixture) start(`${import.meta.env.BASE_URL}fixtures/${system.fixture.file}`, system.fixture.title);
  });
  document.querySelector<HTMLInputElement>("#media-file")?.addEventListener("change", (event) => {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (file) start(file, file.name);
  });
  window.addEventListener("lab-status", ((event: CustomEvent<string>) => {
    status.textContent = event.detail;
  }) as EventListener);
  window.addEventListener("lab-error", () => { errorCount.textContent = String(labApi.errors.length); });
  window.addEventListener("lab-running", () => { smokeButton.disabled = false; });
  smokeButton.addEventListener("click", async () => {
    smokeButton.disabled = true;
    smokeButton.textContent = "Measuring…";
    try {
      const result = await labApi.runSmokeTest();
      output.innerHTML = resultMarkup(result);
    } catch (error) {
      output.innerHTML = `<p class="error">${escapeHtml(String(error))}</p>`;
    } finally {
      smokeButton.disabled = false;
      smokeButton.textContent = "Measure again";
    }
  });
}

const params = new URLSearchParams(location.search);
const system = resolveSystem(params.get("system"));
if (system) renderPlayer(system);
else renderGallery();

# Mobile Safari Emulator Lab

A reproducible, browser-local emulation matrix for Mobile Safari. The ROM or disk
image, emulator core, rendering, audio, and input loop all execute on the device
through JavaScript, WebAssembly, WebGL, and Web Audio. There is no gameplay
streaming service.

The lab pins the stable EmulatorJS 4.2.3 runtime and nine representative cores,
provides a local-file path for user media, and exposes a small measurement API for
real-device automation through Safari Web Inspector.

## Live demo

The public GitHub Pages build contains only fixtures that the project can
redistribute. Open the site once, allow the isolation service worker to reload the
page if necessary, then choose a system and press **Start**.

`https://appmana.github.io/mobile-safari-emulator-lab/`

The public build demonstrates NES, Game Boy Advance, DOS, and PlayStation. The
remaining cards accept local media. The explicit local test command downloads a
checksum-pinned fixture for every card without committing or publishing those
files.

## Production-tier matrix

| System | EmulatorJS core | Public fixture | Local fixture |
| --- | --- | --- | --- |
| Commodore 64 | `vice_x64sc` | — | Happy Flappy |
| Atari 2600 | `stella2014` | — | Flappy the Duck |
| NES / Famicom | `fceumm` | 240p Test Suite | same |
| SNES / Super Famicom | `snes9x` | — | BLT |
| Genesis / Mega Drive | `genesis_plus_gx` | — | Mega Flappy Sis |
| Game Boy Advance | `mgba` | 240p Test Suite | same |
| Arcade | `mame2003_plus` | — | Circus |
| DOS PC | `dosbox_pure` | generated VGA demo | same |
| PlayStation | `pcsx_rearmed` | Tetrade | same |

This is a representative production tier, not a claim that every game in each
catalog behaves identically. Each new title still needs media, input, save, audio,
and sustained-performance validation on its target devices.

## Run locally

Prerequisites: Node.js 22+ and a current Chromium browser for the automated browser
checks.

```sh
npm ci
npx playwright install chromium
npm run check
npm run test:e2e
```

For the complete nine-system test matrix:

```sh
npm run build:local
LOCAL_FIXTURES=1 npm run test:e2e
```

Run the interactive local build with:

```sh
npm run dev
```

The fixture scripts verify SHA-256 before writing anything. Generated runtime,
core, and fixture files under `public/` are ignored by Git. See [FIXTURES.md](FIXTURES.md)
for provenance and distribution behavior.

## Real-device measurement

Every player page publishes `window.__EMULATION_LAB__` for Safari Web Inspector,
`ios-webkit-debug-proxy`, or an MCP adapter:

```js
const lab = window.__EMULATION_LAB__;
lab.capabilities();
await lab.runSmokeTest(5000);
lab.simulateInput(0);
lab.exportResults();
```

`runSmokeTest()` samples the libretro frame counter, checks that the WebGL canvas
is not uniform, records the canvas and audio state, and captures isolation,
SharedArrayBuffer, WebGL 2, user-agent, and runtime errors. It passes at 45 fps or
better over the selected interval. Results stay in browser local storage until
the user exports or clears them.

Audio on iOS is gesture-gated. Start the fixture by tapping its button before
measuring. A physical-controller or touch-input run still needs a brief human
check; frame and canvas tests cannot prove that every control mapping feels right.

## Hosting requirements

WebAssembly threads require a secure, cross-origin-isolated page. The preferred
host configuration is included in `public/_headers`:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
```

Cloudflare Pages and compatible static hosts apply these headers directly. GitHub
Pages does not support custom response headers, so this repository also includes
the `coi-serviceworker` compatibility path. It may perform one automatic reload on
first visit. The capability badges must show **Isolated: yes** and **Threads: yes**
before using the DOS core as the production proof.

For a project-path deployment, set `BASE_PATH` during the build:

```sh
BASE_PATH=/mobile-safari-emulator-lab/ npm run build
```

## Architecture

```text
local picker or checksum-pinned fixture
                  │
                  ▼
        EmulatorJS 4.2.3 loader
                  │
                  ▼
     pinned libretro WebAssembly core
          │          │          │
          ▼          ▼          ▼
       WebGL     Web Audio    touch/gamepad
          │
          ▼
 window.__EMULATION_LAB__ → JSON evidence via Web Inspector/MCP
```

The demo deliberately stops at same-browser emulation. Remote couch netplay,
link-cable tunneling, IPX/LAN emulation, and platform matchmaking are separate
backend concerns.

## License

Project source is GPL-3.0-or-later. EmulatorJS and each libretro core retain their
upstream licenses. Fixtures retain their own terms; see [FIXTURES.md](FIXTURES.md).

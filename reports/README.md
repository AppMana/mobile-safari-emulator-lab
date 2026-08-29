# Device evidence

Real-device runs are exported from `window.__EMULATION_LAB__`. A report records the
device user agent and capabilities plus one result per tested system. Do not add a
device UDID, serial number, Apple ID, or other private identifier.

The committed evidence is deliberately limited to sanitized JSON and selected
screenshots. Raw Web Inspector logs and temporary traces stay local.

The `2026-08-29` report was captured from the public GitHub Pages deployment on
an iPad running iPadOS 26.5.2. A `passed` result requires at least 45 fps, frame
advancement, non-uniform canvas output, and a successfully started core. The
`errors` array remains unfiltered; on iOS it can therefore retain an initial
gesture-gate denial even when the runner recovers and `audioState` is `running`.

# Device evidence

Real-device runs are exported from `window.__EMULATION_LAB__`. A report records the
device user agent and capabilities plus one result per tested system. Do not add a
device UDID, serial number, Apple ID, or other private identifier.

The committed evidence is deliberately limited to sanitized JSON and selected
screenshots. Raw Web Inspector logs and temporary traces stay local.

# PWA auto refresh

## Root cause

The app already asked the service worker to update, but an installed PWA can still keep an older app shell active until the old service worker is replaced and the page reloads.

## Change

- Build emits `app-version.json` with the current app version and build time.
- `app-version.json` is excluded from service-worker precache and routed as network-only.
- The app checks this file on startup, foreground, focus, and every five minutes.
- If the published version differs from the running bundle version, the app updates the service worker and reloads. If needed, it unregisters old service workers before reloading so the next load comes from the network.

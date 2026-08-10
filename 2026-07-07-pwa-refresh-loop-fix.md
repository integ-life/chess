# PWA Refresh Loop Fix

Root cause: the deployed frontend registered the service worker with `/xiangqi-pwa-worker.js?v=${Date.now()}` at runtime. Every page load produced a different service worker script URL. The new worker then triggered `controllerchange`, which reloaded the page, and the next load registered yet another URL. This caused a refresh loop.

Change made:
- Replaced runtime `Date.now()` cache busting with a build-time `__SW_VERSION__`.
- Added a sessionStorage guard so one tab reloads at most once per service worker version.

Verification:
- Local build passed.
- `gh-pages` now points to `index-x5HwX9oZ.js`.
- The published bundle contains a fixed `xiangqi-pwa-worker.js?v=<build-version>` instead of runtime `Date.now()` in the service worker URL.

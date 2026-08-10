# PWA Update Cache Bust

Root cause: GitHub Pages/Fastly served `xiangqi-pwa-worker.js` with a long cache window, so the fixed frontend HTML could load while the installed service worker still used an older precache manifest. That made browsers keep running stale app bundles where login UI and user status were not visible.

Change made:
- Replaced the default virtual PWA registration with explicit service worker registration using `/xiangqi-pwa-worker.js?v=<timestamp>`.
- Set `updateViaCache: "none"` on registration.
- Reload the page when the new worker takes control.
- Keep `skipWaiting`, `clientsClaim`, and `cleanupOutdatedCaches` enabled in the generated worker.

Verification:
- `npm run build` passed.
- Deployed frontend to GitHub Pages.
- Confirmed `gh-pages` contains `index-BpLLupgn.js`.
- Confirmed public `https://xq.songyangyu.com/` now serves `index-BpLLupgn.js`.
- Confirmed the public bundle contains `xiangqi-pwa-worker.js?v=`, `updateViaCache`, `controllerchange`, `SKIP_WAITING`, and auth markers.

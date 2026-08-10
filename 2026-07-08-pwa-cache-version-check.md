# PWA cache version check

## Context

User reported that the deployed frontend did not appear to include the latest changelog and UI text changes.

## Checks

- `https://xq.songyangyu.com/` currently references `/assets/index-C-4t-syQ.js`.
- That JS bundle contains `2026.07.08-qipu-resources`, `按用途找棋谱`, and `黑方视角`.
- `https://xq.songyangyu.com/xiangqi-pwa-worker.js?v=debug` precaches `assets/index-C-4t-syQ.js`.

## Conclusion

The deployed GitHub Pages artifact is current. If a device still shows the old UI, it is likely being controlled by an older browser/PWA service worker cache or an older app shell already loaded on that device.

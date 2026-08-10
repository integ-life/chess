# ElephantEye WebAssembly experiment

This experiment compiles the LGPL-2.1 ElephantEye 3.15 engine into a single-threaded WebAssembly worker. It is deliberately isolated from the production AI call path.

## Hosting and consent boundary

- `worker.js`, `eleeye.js`, `eleeye.wasm`, and `manifest.json` are copied into `frontend/public/engine-lab` and therefore ship with the GitHub Pages frontend at `xq.songyangyu.com`.
- The browser loads only `manifest.json` when `#/engine-lab` opens. It downloads the executable package into a versioned Cache Storage entry only after the user clicks the size-labelled consent button, then creates the worker from that cache.
- The PWA excludes the entire `engine-lab` directory from precaching, so installing or updating the app cannot silently download the engine.
- Stopping the worker releases runtime memory without deleting the package. The page deletes all managed engine caches only through the explicit `删除本地引擎文件` action, and requests persistent browser storage after user consent when the browser supports it.
- No `/api` route or backend deployment contains these assets.

The current experiment omits ElephantEye's opening book. The manifest records the exact uncompressed package size and the 32 MiB WebAssembly runtime-memory reservation.

## Rebuild

Use Emscripten 6.0.3 or a compatible version:

```bash
source /path/to/emsdk/emsdk_env.sh
./experiments/eleeye-wasm/build.sh
```

On Apple Silicon with the x86_64 Emscripten package, run the script under Rosetta:

```bash
arch -x86_64 /bin/bash -lc 'source /path/to/emsdk/emsdk_env.sh && ./experiments/eleeye-wasm/build.sh'
```

The build fetches the pinned upstream commit `a9d3914e596da93a150d74af8967edecc0810ef7`, applies the two portable WebAssembly guards, and regenerates all published engine assets plus their exact-size manifest.

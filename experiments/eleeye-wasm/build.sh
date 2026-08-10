#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
UPSTREAM_URL="https://github.com/xqbase/eleeye.git"
UPSTREAM_COMMIT="a9d3914e596da93a150d74af8967edecc0810ef7"
PACKAGE_VERSION="$UPSTREAM_COMMIT-cache-v1"
CACHE_DIR="$SCRIPT_DIR/.cache"
BARE_REPO="$CACHE_DIR/eleeye.git"
OUT_DIR="$REPO_ROOT/frontend/public/engine-lab"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/eleeye-wasm.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

if ! command -v em++ >/dev/null 2>&1; then
  echo "em++ not found; activate Emscripten before running this script" >&2
  exit 1
fi

mkdir -p "$CACHE_DIR" "$OUT_DIR" "$WORK_DIR/source"
if [[ ! -d "$BARE_REPO" ]]; then
  git clone --bare --filter=blob:none "$UPSTREAM_URL" "$BARE_REPO"
fi
git --git-dir="$BARE_REPO" fetch --quiet origin "$UPSTREAM_COMMIT"
git --git-dir="$BARE_REPO" archive "$UPSTREAM_COMMIT" | tar -x -C "$WORK_DIR/source"
# Upstream tracks these headers with CRLF; normalize the disposable build copy so the patch is portable.
perl -pi -e 's/\r\n/\n/g' "$WORK_DIR/source/base/rc4prng.h" "$WORK_DIR/source/base/x86asm.h"
git -C "$WORK_DIR/source" apply --unidiff-zero "$SCRIPT_DIR/patches/eleeye-wasm.patch"
cp "$SCRIPT_DIR/wasm_bridge.cpp" "$WORK_DIR/source/eleeye/wasm_bridge.cpp"

pushd "$WORK_DIR/source/eleeye" >/dev/null
em++ -O3 -DNDEBUG -DCCHESS_A3800 --no-entry \
  pregen.cpp position.cpp genmoves.cpp hash.cpp movesort.cpp preeval.cpp evaluate.cpp search.cpp wasm_bridge.cpp \
  -o "$OUT_DIR/eleeye.js" \
  -sMODULARIZE=1 \
  -sEXPORT_ES6=1 \
  -sEXPORT_NAME=createEleeyeModule \
  -sENVIRONMENT=worker \
  -sINITIAL_MEMORY=33554432 \
  -sALLOW_MEMORY_GROWTH=0 \
  -sSTACK_SIZE=1048576 \
  -sFILESYSTEM=0 \
  -sNO_EXIT_RUNTIME=1 \
  -sASSERTIONS=0 \
  -sEXPORTED_FUNCTIONS='["_eleeye_init","_eleeye_bestmove"]' \
  -sEXPORTED_RUNTIME_METHODS='["cwrap"]'
popd >/dev/null

cp "$SCRIPT_DIR/worker.js" "$OUT_DIR/worker.js"
cp "$WORK_DIR/source/LICENSE" "$OUT_DIR/ELEEYE-LICENSE.txt"
perl -0pi -e 's/(?:\r?\n)+\z/\n/' "$OUT_DIR/ELEEYE-LICENSE.txt"
chmod 0644 "$OUT_DIR/worker.js" "$OUT_DIR/eleeye.js" "$OUT_DIR/eleeye.wasm" "$OUT_DIR/ELEEYE-LICENSE.txt"

worker_bytes="$(wc -c < "$OUT_DIR/worker.js" | tr -d ' ')"
loader_bytes="$(wc -c < "$OUT_DIR/eleeye.js" | tr -d ' ')"
wasm_bytes="$(wc -c < "$OUT_DIR/eleeye.wasm" | tr -d ' ')"
total_bytes="$((worker_bytes + loader_bytes + wasm_bytes))"

printf '%s\n' \
  '{' \
  '  "name": "ElephantEye 3.15 WebAssembly",' \
  "  \"version\": \"$PACKAGE_VERSION\"," \
  "  \"upstreamCommit\": \"$UPSTREAM_COMMIT\"," \
  '  "hosting": "GitHub Pages",' \
  '  "license": "LGPL-2.1",' \
  '  "sourceUrl": "https://github.com/xqbase/eleeye",' \
  "  \"totalBytes\": $total_bytes," \
  '  "runtimeMemoryBytes": 33554432,' \
  '  "files": [' \
  "    { \"name\": \"worker.js\", \"bytes\": $worker_bytes }," \
  "    { \"name\": \"eleeye.js\", \"bytes\": $loader_bytes }," \
  "    { \"name\": \"eleeye.wasm\", \"bytes\": $wasm_bytes }" \
  '  ]' \
  '}' > "$OUT_DIR/manifest.json"

echo "ElephantEye browser package: $total_bytes bytes"

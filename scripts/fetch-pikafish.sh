#!/usr/bin/env bash
# 下载最新 Pikafish 引擎（macOS Apple Silicon）与 NNUE 权重到 backend/engines/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/backend/engines"
mkdir -p "$DEST"

if [[ -x "$DEST/pikafish" && -f "$DEST/pikafish.nnue" ]]; then
  echo "pikafish already present in $DEST, skipping (delete to re-fetch)"
  exit 0
fi

command -v 7zz >/dev/null || { echo "need 7zz: brew install sevenzip" >&2; exit 1; }

echo "querying latest release..."
URL=$(curl -fsSL https://api.github.com/repos/official-pikafish/Pikafish/releases/latest |
  python3 -c "import json,sys; d=json.load(sys.stdin); print(next(a['browser_download_url'] for a in d['assets'] if a['name'].endswith('.7z')))")
echo "downloading $URL"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
curl -fL "$URL" -o "$TMP/pikafish.7z"
7zz x -y -o"$TMP/extract" "$TMP/pikafish.7z" >/dev/null

BIN=$(find "$TMP/extract" -type f -name 'pikafish-apple-silicon' | head -1)
NNUE=$(find "$TMP/extract" -type f -name '*.nnue' | head -1)
[[ -n "$BIN" && -n "$NNUE" ]] || { echo "expected files not found in archive:" >&2; find "$TMP/extract" -type f >&2; exit 1; }

cp "$BIN" "$DEST/pikafish"
cp "$NNUE" "$DEST/pikafish.nnue"
chmod +x "$DEST/pikafish"
echo "installed: $DEST/pikafish + pikafish.nnue"

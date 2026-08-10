#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
dest="$root/backend/qipu-sources/opening-materials"
mkdir -p "$dest"
stage="$(mktemp -d "$dest/.pull.XXXXXX")"
trap 'rm -rf "$stage"' EXIT

fetch() {
  local name="$1" url="$2"
  local tmp="$stage/$name"
  curl -fL --compressed --retry 3 --connect-timeout 10 --max-time 120 \
    -A 'chess-course-research/1.0' "$url" -o "$tmp"
  case "$name" in
    *.html) head -c 512 "$tmp" | grep -Eiq '<!doctype|<html' ;;
    *.pdf) head -c 5 "$tmp" | grep -q '%PDF-' ;;
  esac
}

fetch wxf-school-course.pdf 'https://www.wxf-chess.org/images/hangzhou-chess/2022_46_wang_bi_xiao_.pdf'
fetch wikibooks-opening.html 'https://zh.wikibooks.org/wiki/%E4%B8%AD%E5%9C%8B%E8%B1%A1%E6%A3%8B/%E9%96%8B%E5%B1%80'
fetch xiangqi-opening-principles.html 'https://www.zh.chess.com/articles/10-xiangqi-opening-principles.html'
fetch xiangqi-learning-guide.html 'https://www.zh.chess.com/how-to-play-chess/'
fetch xiangqi-central-cannon.html 'https://www.zh.chess.com/opening-central-cannon.html'
fetch xiangqi-angel-guide.html 'https://www.zh.chess.com/opening-angels-guide.html'
fetch xiangqiqipu-opening-systems.html 'https://www.xiangqiqipu.com/Category/View-32159.html'

for file in "$stage"/*; do mv "$file" "$dest/"; done
rm -f "$dest/reddit-beginner-course.html"
(cd "$dest" && shasum -a 256 -- *.html *.pdf > SHA256SUMS)
echo "opening materials updated in $dest"

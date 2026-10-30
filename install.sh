#!/bin/bash
# Install (or with --uninstall, remove) the ShaKy8 weather screensaver for this user.
# Nothing under /usr is touched. omarchy-screensaver calls `ttfx`, and ~/.local/bin
# comes before /usr/bin on its PATH, so our wrapper is run in its place (see shaky8-ttfx).
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
bin=$HOME/.local/bin/ttfx
data=$HOME/.local/share/shaky8-screensaver

if [[ ${1:-} == --uninstall ]]; then
  rm -f "$bin"
  rm -rf "$data" "${XDG_CACHE_HOME:-$HOME/.cache}/shaky8-screensaver"
  echo "Removed. The stock Omarchy screensaver is back."
  exit 0
fi

for cmd in chromium node curl jq hyprctl; do
  command -v "$cmd" >/dev/null || { echo "Missing required command: $cmd" >&2; exit 1; }
done
[[ -x /usr/bin/ttfx ]] || { echo "Missing /usr/bin/ttfx" >&2; exit 1; }

mkdir -p "$HOME/.local/bin" "$data"
install -m 755 "$here/shaky8-ttfx" "$bin"
install -m 644 "$here/shaky8-weather-driver.mjs" "$data/shaky8-weather-driver.mjs"
echo "Installed. Try it: omarchy-launch-screensaver force"

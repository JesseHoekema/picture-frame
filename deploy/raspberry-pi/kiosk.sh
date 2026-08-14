#!/usr/bin/env bash
set -euo pipefail

URL="${FRAME_URL:-http://localhost:3000/frame}"

# Wait for app to be reachable
until curl -sf "$URL" >/dev/null 2>&1; do
	sleep 2
done

# Disable screen blanking / power management (X11 only; harmless on Wayland).
xset s off 2>/dev/null || true
xset -dpms 2>/dev/null || true
xset s noblank 2>/dev/null || true

# Hide mouse cursor when idle
command -v unclutter >/dev/null 2>&1 && unclutter -idle 0 -root &

CHROME="$(command -v chromium-browser || command -v chromium || true)"
if [ -z "$CHROME" ]; then
	echo "Chromium not found. Install it: sudo apt-get install -y chromium-browser" >&2
	exit 1
fi

exec "$CHROME" \
	--kiosk \
	--start-fullscreen \
	--noerrdialogs \
	--disable-infobars \
	--incognito \
	--no-first-run \
	--fast --fast-start \
	--disable-features=Translate \
	--disable-session-crashed-bubble \
	--disable-pinch \
	--overscroll-history-navigation=0 \
	--check-for-update-interval=31536000 \
	--app="$URL"

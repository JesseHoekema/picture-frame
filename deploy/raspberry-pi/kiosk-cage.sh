#!/usr/bin/env bash
set -euo pipefail

URL="${FRAME_URL:-http://localhost:3000/frame}"
API="${API_URL:-http://localhost:3000/api/frame/live}"
CHROMIUM="$(command -v chromium || command -v chromium-browser || echo /usr/bin/chromium)"

if command -v wlopm >/dev/null 2>&1; then
	(
		last=""
		while true; do
			if curl -sf "$API" 2>/dev/null | grep -q '"displayShouldBeOn":false'; then
				want=off
			else
				want=on
			fi
			if [ "$want" != "$last" ]; then
				wlopm --"$want" '*' >/dev/null 2>&1 || true
				last="$want"
			fi
			sleep 5
		done
	) &
fi

exec "$CHROMIUM" \
	--kiosk \
	--ozone-platform=wayland \
	--enable-features=UseOzonePlatform \
	--noerrdialogs \
	--disable-infobars \
	--incognito \
	--no-first-run \
	--check-for-update-interval=31536000 \
	"$URL"

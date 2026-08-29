#!/usr/bin/env bash
set -euo pipefail

URL="${FRAME_URL:-http://localhost:3000/frame}"
API="${API_URL:-http://localhost:3000/api/frame/live}"
CHROMIUM="$(command -v chromium || command -v chromium-browser || echo /usr/bin/chromium)"

until curl -sf "$URL" >/dev/null 2>&1; do
	sleep 2
done

(
	last=""
	while true; do
		if curl -sf "$API" 2>/dev/null | grep -q '"displayShouldBeOn":false'; then
			want=off
		else
			want=on
		fi
		if [ "$want" != "$last" ]; then
			swaymsg "output * dpms $want" >/dev/null 2>&1 || true
			last="$want"
		fi
		sleep 5
	done
) &

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

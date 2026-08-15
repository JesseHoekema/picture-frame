#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
RUN_USER="${SUDO_USER:-$USER}"
USER_HOME="$(getent passwd "$RUN_USER" | cut -d: -f6)"
HOSTNAME_SHORT="$(hostname)"
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"

if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi
as_user() { if [ "$(id -u)" -eq 0 ]; then sudo -u "$RUN_USER" "$@"; else "$@"; fi; }
have() { command -v "$1" >/dev/null 2>&1; }

echo "==> Picture Frame installer"
echo "    App:  $APP_DIR"
echo "    User: $RUN_USER ($USER_HOME)"
echo "    Host: $HOSTNAME_SHORT"

# ---- self-update ----
if [ "${PF_REEXEC:-}" != "1" ] && have git && [ -d "$APP_DIR/.git" ]; then
	echo "==> Fetching latest version from git"
	if as_user git -C "$APP_DIR" pull --ff-only; then
		echo "==> Updated to latest push"
	else
		echo "!! git pull skipped (local changes or no upstream) — continuing with current code"
	fi
	export PF_REEXEC=1
	exec bash "$SCRIPT_DIR/install.sh" "$@"
fi

IS_DEBIAN=0
have apt-get && IS_DEBIAN=1

apt_install() {
	[ "$IS_DEBIAN" -eq 1 ] || { echo "!! Not a Debian/apt system; install '$*' manually." >&2; return 0; }
	$SUDO apt-get install -y "$@"
}

if [ "$IS_DEBIAN" -eq 1 ]; then
	echo "==> Updating package lists"
	$SUDO apt-get update -y || true
fi

# ---- curl ----
have curl || apt_install curl

# ---- Node.js 20+ ----
need_node=1
if have node; then
	major="$(node -v | sed 's/v\([0-9]*\).*/\1/')"
	[ "${major:-0}" -ge 18 ] && need_node=0
fi
if [ "$need_node" -eq 1 ]; then
	echo "==> Installing Node.js 20"
	if [ "$IS_DEBIAN" -eq 1 ]; then
		curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash -
		apt_install nodejs
	else
		echo "!! Install Node.js 20+ manually, then re-run." >&2
		exit 1
	fi
fi
echo "==> Node: $(node -v)"

# ---- package manager ----
if have pnpm; then
	PM=pnpm
elif have corepack; then
	echo "==> Enabling pnpm via corepack"
	$SUDO corepack enable >/dev/null 2>&1 || true
	corepack prepare pnpm@latest --activate >/dev/null 2>&1 || true
	have pnpm && PM=pnpm || PM=npm
else
	PM=npm
fi
echo "==> Package manager: $PM"

# ---- Chromium + helpers ----
if ! have chromium-browser && ! have chromium; then
	echo "==> Installing Chromium"
	apt_install chromium-browser || apt_install chromium || true
fi
have unclutter || apt_install unclutter || true

# ---- build app ----
cd "$APP_DIR"
echo "==> Installing dependencies ($PM)"
as_user "$PM" install
echo "==> Building"
as_user "$PM" run build

# ---- .env  ----
if [ ! -f "$APP_DIR/.env" ]; then
	ORIGINS="http://$HOSTNAME_SHORT.local:3000"
	[ -n "$LAN_IP" ] && ORIGINS="$ORIGINS,http://$LAN_IP:3000"
	ORIGINS="$ORIGINS,http://localhost:3000"
	echo "==> Creating .env (ALLOWED_ORIGINS=$ORIGINS)"
	sed "s#^ALLOWED_ORIGINS=.*#ALLOWED_ORIGINS=$ORIGINS#" \
		"$SCRIPT_DIR/env.example" | as_user tee "$APP_DIR/.env" >/dev/null
fi
chmod +x "$SCRIPT_DIR/kiosk.sh"

# ---- systemd service for server ----
SERVICE_DST="/etc/systemd/system/picture-frame.service"
echo "==> Installing service -> $SERVICE_DST"
sed -e "s#__APP_DIR__#$APP_DIR#g" -e "s#__USER__#$RUN_USER#g" \
	"$SCRIPT_DIR/picture-frame.service" | $SUDO tee "$SERVICE_DST" >/dev/null
$SUDO systemctl daemon-reload
$SUDO systemctl enable picture-frame >/dev/null 2>&1 || true
$SUDO systemctl restart picture-frame

# ---- kiosk autostart ----
KIOSK="$SCRIPT_DIR/kiosk.sh"
setup_autostart() {
	local cfg
	if have labwc || [ -d "$USER_HOME/.config/labwc" ]; then
		cfg="$USER_HOME/.config/labwc/autostart"
		as_user mkdir -p "$(dirname "$cfg")"
		as_user touch "$cfg"
		grep -qF "$KIOSK" "$cfg" 2>/dev/null || echo "$KIOSK &" | as_user tee -a "$cfg" >/dev/null
		echo "labwc ($cfg)"
	elif have wayfire || [ -f "$USER_HOME/.config/wayfire.ini" ]; then
		cfg="$USER_HOME/.config/wayfire.ini"
		as_user touch "$cfg"
		grep -qF "$KIOSK" "$cfg" 2>/dev/null ||
			printf '\n[autostart]\nframe = %s\n' "$KIOSK" | as_user tee -a "$cfg" >/dev/null
		echo "wayfire ($cfg)"
	elif [ -d "$USER_HOME/.config/lxsession" ] || have lxpanel; then
		cfg="$USER_HOME/.config/lxsession/LXDE-pi/autostart"
		as_user mkdir -p "$(dirname "$cfg")"
		as_user touch "$cfg"
		grep -qF "$KIOSK" "$cfg" 2>/dev/null || echo "@$KIOSK" | as_user tee -a "$cfg" >/dev/null
		echo "LXDE ($cfg)"
	else
		cfg="$USER_HOME/.config/labwc/autostart"
		as_user mkdir -p "$(dirname "$cfg")"
		as_user touch "$cfg"
		grep -qF "$KIOSK" "$cfg" 2>/dev/null || echo "$KIOSK &" | as_user tee -a "$cfg" >/dev/null
		echo "no desktop detected — defaulted to labwc ($cfg)"
	fi
}
echo "==> Kiosk autostart: $(setup_autostart)"

echo
echo "==> Server status:"
$SUDO systemctl --no-pager --lines=4 status picture-frame || true
echo
echo "Done. Finish first-run setup in a browser:"
echo "  • http://$HOSTNAME_SHORT.local:3000/"
[ -n "$LAN_IP" ] && echo "  • http://$LAN_IP:3000/"
echo "  • Reboot to launch the kiosk full-screen:  sudo reboot"

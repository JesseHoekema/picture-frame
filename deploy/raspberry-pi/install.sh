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

# ---- Node.js 22+ ----
need_node=1
if have node; then
	major="$(node -v | sed 's/v\([0-9]*\).*/\1/')"
	[ "${major:-0}" -ge 22 ] && need_node=0
fi
if [ "$need_node" -eq 1 ]; then
	echo "==> Installing Node.js 22"
	if [ "$IS_DEBIAN" -eq 1 ]; then
		curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO bash -
		apt_install nodejs
	else
		echo "!! Install Node.js 22+ manually, then re-run." >&2
		exit 1
	fi
fi
echo "==> Node: $(node -v)"

# ---- package manager ----
PM="${PF_PM:-npm}"
if [ "$PM" = "pnpm" ] && ! as_user pnpm --version >/dev/null 2>&1; then
	echo "!! pnpm not usable — falling back to npm"
	PM=npm
fi
echo "==> Package manager: $PM"

# ---- Chromium + helpers ----
if ! have chromium-browser && ! have chromium; then
	echo "==> Installing Chromium"
	apt_install chromium-browser || apt_install chromium || true
fi
have unclutter || apt_install unclutter || true

# ---- native build tools ----
have make && have g++ && have python3 || apt_install python3 make g++ || true

# ---- build app ----
cd "$APP_DIR"
if [ "$PM" = "npm" ] && [ -d "$APP_DIR/node_modules/.pnpm" ]; then
	echo "==> Clearing previous pnpm node_modules"
	as_user rm -rf "$APP_DIR/node_modules"
fi
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

# ---- kiosk ----
KIOSK="$SCRIPT_DIR/kiosk.sh"
KIOSK_URL="${FRAME_URL:-http://localhost:3000/frame}"

add_desktop_autostart() {
	local cfg
	if have labwc; then
		cfg="$USER_HOME/.config/labwc/autostart"
		as_user mkdir -p "$(dirname "$cfg")"; as_user touch "$cfg"
		grep -qF "$KIOSK" "$cfg" 2>/dev/null || echo "$KIOSK &" | as_user tee -a "$cfg" >/dev/null
		echo "labwc ($cfg)"; return 0
	elif have wayfire; then
		cfg="$USER_HOME/.config/wayfire.ini"; as_user touch "$cfg"
		grep -qF "$KIOSK" "$cfg" 2>/dev/null ||
			printf '\n[autostart]\nframe = %s\n' "$KIOSK" | as_user tee -a "$cfg" >/dev/null
		echo "wayfire ($cfg)"; return 0
	elif have lxpanel || have startlxde || have lxsession; then
		cfg="$USER_HOME/.config/lxsession/LXDE-pi/autostart"
		as_user mkdir -p "$(dirname "$cfg")"; as_user touch "$cfg"
		grep -qF "$KIOSK" "$cfg" 2>/dev/null || echo "@$KIOSK" | as_user tee -a "$cfg" >/dev/null
		echo "LXDE ($cfg)"; return 0
	fi
	return 1
}

setup_cage_kiosk() {
	apt_install cage || true
	apt_install wlopm || true
	local uid
	uid="$(id -u "$RUN_USER")"
	chmod +x "$SCRIPT_DIR/kiosk-cage.sh"
	$SUDO usermod -aG video,render,input,tty "$RUN_USER" >/dev/null 2>&1 || true

	$SUDO tee /etc/systemd/system/picture-frame-kiosk.service >/dev/null <<EOF
[Unit]
Description=Picture Frame kiosk (cage)
After=picture-frame.service systemd-user-sessions.service
Wants=picture-frame.service

[Service]
User=$RUN_USER
PAMName=login
TTYPath=/dev/tty1
StandardInput=tty
StandardOutput=journal
StandardError=journal
Environment=XDG_RUNTIME_DIR=/run/user/$uid
Environment=FRAME_URL=$KIOSK_URL
ExecStartPre=/bin/sh -c 'until curl -sf $KIOSK_URL >/dev/null 2>&1; do sleep 2; done'
ExecStart=/usr/bin/cage -- $SCRIPT_DIR/kiosk-cage.sh
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

	$SUDO systemctl disable getty@tty1.service >/dev/null 2>&1 || true
	$SUDO systemctl stop getty@tty1.service >/dev/null 2>&1 || true
	$SUDO systemctl daemon-reload
	$SUDO systemctl enable picture-frame-kiosk.service >/dev/null 2>&1 || true
	$SUDO systemctl restart picture-frame-kiosk.service || true
	echo "cage systemd service (picture-frame-kiosk)"
}

if desktop="$(add_desktop_autostart)"; then
	echo "==> Kiosk autostart: $desktop"
else
	echo "==> No desktop found — setting up standalone kiosk"
	echo "==> Kiosk: $(setup_cage_kiosk)"
fi

echo
echo "==> Server status:"
$SUDO systemctl --no-pager --lines=4 status picture-frame || true
echo
echo "Done. Finish first-run setup in a browser:"
echo "  • http://$HOSTNAME_SHORT.local:3000/"
[ -n "$LAN_IP" ] && echo "  • http://$LAN_IP:3000/"
echo "  • Reboot to launch the kiosk full-screen:  sudo reboot"

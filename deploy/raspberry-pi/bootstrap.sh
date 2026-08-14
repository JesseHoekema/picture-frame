#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${PF_REPO:-https://github.com/JesseHoekema/picture-frame.git}"

RUN_USER="${SUDO_USER:-$(id -un)}"
if [ "$RUN_USER" = "root" ]; then
	RUN_USER="$(getent passwd 1000 | cut -d: -f1 || true)"
	[ -n "$RUN_USER" ] || RUN_USER="root"
fi
USER_HOME="$(getent passwd "$RUN_USER" | cut -d: -f6)"
TARGET_DIR="${PF_DIR:-$USER_HOME/picture-frame}"

echo "==> Picture Frame bootstrap"
echo "    Repo:   $REPO_URL"
echo "    User:   $RUN_USER"
echo "    Target: $TARGET_DIR"

SUDO=""
[ "$(id -u)" -ne 0 ] && SUDO="sudo"
as_user() {
	if [ "$(id -u)" -eq 0 ] && [ "$RUN_USER" != "root" ]; then
		sudo -u "$RUN_USER" "$@"
	else
		"$@"
	fi
}

if ! command -v git >/dev/null 2>&1; then
	echo "==> Installing git"
	if command -v apt-get >/dev/null 2>&1; then
		$SUDO apt-get update -y && $SUDO apt-get install -y git
	else
		echo "!! git is required — install it and re-run." >&2
		exit 1
	fi
fi

if [ -d "$TARGET_DIR/.git" ]; then
	echo "==> Updating existing checkout"
	as_user git -C "$TARGET_DIR" pull --ff-only || echo "!! pull skipped (local changes)"
else
	echo "==> Cloning into $TARGET_DIR"
	as_user git clone "$REPO_URL" "$TARGET_DIR"
fi

export SUDO_USER="$RUN_USER"
exec bash "$TARGET_DIR/deploy/raspberry-pi/install.sh"

# Picture Frame on Raspberry Pi

This folder contains everything needed to run Picture Frame on a Raspberry Pi and
have the Pi's own display show the frame full-screen (kiosk mode).

Two pieces run on the Pi:

1. **The app** — a Node server (SvelteKit + `adapter-node`) serving the dashboard,
   the frame, uploads and the Home Assistant / storage integrations.
2. **The kiosk** — Chromium launched full-screen pointing at `/frame`, so the
   physical display shows the slideshow.

---

## Install (one command)

On a fresh Raspberry Pi OS, run:

```bash
curl -fsSL https://raw.githubusercontent.com/JesseHoekema/picture-frame/main/deploy/raspberry-pi/bootstrap.sh | sudo bash
```

`bootstrap.sh` clones the repo into `~/picture-frame` and runs the full
installer. _(If your default branch is `master`, change `/main/` to `/master/`.)_

Already have the project checked out? Just run the installer directly:

```bash
cd ~/picture-frame
bash deploy/raspberry-pi/install.sh
```

Either way the script does **everything**, on a fresh Raspberry Pi OS:

- installs **Node.js 22** if it's missing or too old,
- picks the package manager (**pnpm** if present, otherwise **npm**),
- installs **Chromium** (+ `unclutter` for cursor hiding),
- installs dependencies and **builds** the app,
- creates `.env` with `ALLOWED_ORIGINS` auto-set to the Pi's **hostname, LAN IP
  and localhost** (all on `:3000`) and a 100 MB upload limit,
- installs, enables and starts the **`picture-frame`** systemd service,
- sets up the **kiosk** so the frame opens full-screen on boot — using the
  desktop's autostart (**labwc / wayfire / LXDE**) if one is installed, or, on
  **Raspberry Pi OS Lite** (no desktop), a self-contained **`cage`** kiosk
  service on tty1.

It's safe to re-run (idempotent) — use it to update, too.

When it finishes:

```bash
# 1. Finish first-run setup in a browser:
#    http://<pi-hostname>.local:3000/
# 2. Reboot to launch the kiosk full-screen:
sudo reboot
```

### Notes

- **Origins / uploads:** same-origin requests are always allowed, so opening the
  dashboard from the hostname, the LAN IP or localhost all work out of the box.
  To allow another URL, add it to `ALLOWED_ORIGINS` (comma-separated) in `.env`
  and `sudo systemctl restart picture-frame`.
- **Kiosk** uses `http://localhost:3000/frame` (read-only) and is unaffected.
- Turn the display off via the in-app **motion / light control** or the
  dashboard **screen on/off** toggle.

---

## Files

| File                    | Purpose                                                    |
| ----------------------- | ---------------------------------------------------------- |
| `bootstrap.sh`          | `curl \| sudo bash` entrypoint: clones, then runs `install.sh`. |
| `install.sh`            | One-shot installer: runtime, build, service, kiosk.        |
| `picture-frame.service` | systemd unit template for the Node server.                 |
| `kiosk.sh`              | Launches Chromium full-screen at `/frame`.                 |
| `env.example`           | Environment defaults (PORT, ALLOWED_ORIGINS, body limit).  |

---

## Updating

Re-run the one-liner, or from the checkout:

```bash
cd ~/picture-frame
bash deploy/raspberry-pi/install.sh   # pulls latest, rebuilds & restarts (idempotent)
```

The installer runs `git pull` itself, so you don't need to. Your data (`data/`) —
database, local uploads and image cache — lives in the project folder and is
preserved across updates.

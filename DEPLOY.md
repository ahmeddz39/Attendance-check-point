# Deploying, LAN-only

This app is meant to run as an internal, LAN-only service — no domain, no internet
exposure. Both setups below are **one command, fully unattended**: get the code onto the
machine, run the script for your OS, and it installs everything it needs, generates its
own secrets, builds the app, runs it under a process supervisor, opens the LAN firewall
port, and creates the first admin login. Nothing to edit by hand.

- **Windows** — runs on a Windows PC under [PM2](https://pm2.keymetrics.io/). Good for a
  machine that's already dedicated to this (or always logged in).
- **Linux** — a dedicated Ubuntu VM/server under systemd + nginx. More durable — survives
  a raw reboot without anyone logging in, not just a process crash.

Both scripts are **idempotent**: re-running them (after pulling/re-copying newer code)
rebuilds the frontend, re-runs migrations, and restarts the service, without touching an
existing `.env`, database, or admin password.

This repo is **private**. How you get the code onto the target machine depends on whose
machine it is:

## Getting the code onto a machine

**Your own dev/staging machine** — you have GitHub access, so just clone it normally:

```bash
git clone https://github.com/ahmeddz39/Attendance-check-point.git
```

**A client's machine (recommended path for a paid install)** — don't `git clone` a
private repo onto hardware you don't control. That would mean either putting your own
GitHub credentials on their machine, or granting the client's account a standing `git
pull` connection to a repo that may later hold code for *other* clients too. Instead,
export a clean, git-free snapshot from your own machine and hand them that:

```bash
# On YOUR machine, in the repo root:
git archive --format=zip -o attendance-checkpoint-release.zip HEAD
```

Transfer `attendance-checkpoint-release.zip` to the client's machine however's
convenient (USB drive, file share, etc.), then unzip it there. No `.git` folder, no
commit history, no GitHub account needed on their end at all — just the plain files,
ready for the setup script below. See [Rolling out an update to a client install](#rolling-out-an-update-to-a-client-install)
for how updates work later, since `git pull` won't be available on their machine.

## Quick checklist (what you actually do, step by step)

### Windows

1. Install [Git for Windows](https://git-scm.com/download/win) if it's not already
   there — only needed if you're cloning directly (your own machine); a client's zip
   extract doesn't need Git at all.
2. Get the code onto the machine — see [Getting the code onto a machine](#getting-the-code-onto-a-machine)
   above — into e.g. `C:\Apps\Attendance-check-point`.
3. Open PowerShell **as Administrator**, then run:
   ```powershell
   cd C:\Apps\Attendance-check-point
   .\deploy\setup-windows.ps1
   ```
4. If it just installed Node.js and/or PostgreSQL for you, it'll tell you to close the
   window and run the last line again (PATH needs a fresh shell to pick them up) — that's
   the only case you run it twice.
5. It prints the LAN URL plus a generated admin login and DB password once — **copy them
   down**.
6. Open the LAN URL in a browser, log in. Done — see [Windows](#windows) below for
   optional parameters (pinning a password instead of generating one, etc.).

### Linux (Ubuntu server/VM)

1. Make sure the VM/server's network adapter is on the same physical LAN as the ZKTeco
   scanners — not an isolated or NAT'd network (see below for why).
2. SSH in, create the target directory, and get the code onto the machine — see
   [Getting the code onto a machine](#getting-the-code-onto-a-machine) above:
   ```bash
   sudo mkdir -p /opt/attendance-check-point
   sudo chown "$USER" /opt/attendance-check-point
   # then either `git clone ... /opt/attendance-check-point` (your own machine)
   # or unzip a release archive into /opt/attendance-check-point (a client's machine)
   ```
3. Run the installer:
   ```bash
   cd /opt/attendance-check-point
   sudo bash deploy/setup-vm.sh
   ```
4. It prints the URL plus a generated admin login and DB password once — copy them down.
5. Open that URL, log in. Done.
6. Optional but recommended — nightly backups:
   ```bash
   sudo crontab -e
   # add: 0 2 * * * /opt/attendance-check-point/deploy/backup-db.sh >> /var/log/attendance-backup.log 2>&1
   ```

That's the entire list either way: get the code on, one script, copy the printed
credentials somewhere safe. Nothing to edit, no `.env` to fill in by hand. Everything
from here down is reference detail for that same process — options, what each script
does internally, and day-to-day commands.

## Why network placement matters

`backend/src/services/deviceDiscovery.js` and `attendanceDeviceAdapter.js` talk directly
to the ZKTeco biometric scanners over raw TCP on port 4370, and the discovery scan sweeps
the local `/24` subnet the server itself is on. **Whichever machine runs this must be on
the same physical/LAN network as the scanners** — not an isolated VM network, VLAN, or
guest Wi-Fi.

---

## Biometric terminal compatibility

Device I/O goes through an adapter registry (`backend/src/services/deviceAdapters/`), keyed
by the `protocol` field set on each device:

- **`zkteco`** (default) — ZKTeco's own "Pull SDK" binary protocol, port 4370. This is what
  the auto-discovery scan finds and what every ZKTeco fingerprint/card terminal speaks out
  of the box. No configuration beyond IP/port is needed.
- **`http-generic`** — a configurable adapter for any terminal that exposes an HTTP/REST API
  instead. It is **not tied to one vendor** — set it from the "Add Device" form's protocol
  dropdown, with a Base URL, an auth type (none/Basic/Digest/Bearer), and credentials. Its
  field and path defaults match Hikvision's public ISAPI standard (also followed by several
  OEM/Dahua-family lines), so a compatible terminal often needs nothing more than those
  fields. For a terminal that nests its JSON differently or uses different field names, use
  the "Advanced settings (JSON)" box to override any of:

  ```json
  {
    "usersPath": "/ISAPI/AccessControl/UserInfo/Search",
    "logsPath": "/ISAPI/AccessControl/AcsEvent",
    "usersListPath": "UserInfoSearch.UserInfo",
    "logsListPath": "AcsEvent.InfoList",
    "userIdField": "employeeNo",
    "userNameField": "name",
    "cardField": "cardNo",
    "eventUserField": "employeeNoString",
    "eventTimeField": "time",
    "eventTypeField": "eventType"
  }
  ```

  **This shape is written against public ISAPI documentation, not verified against a
  physical unit.** Before relying on it for a real terminal, confirm the field and path
  names against that terminal's own API documentation, and test an import against it first.

- **A newer ZKTeco face-recognition terminal that won't connect on port 4370** is very
  likely in "Cloud Server Mode" (ADMS push mode), where the device pushes data to a server
  instead of being polled. That is a device-side setting to switch back to standard
  pull-mode communication, not something fixable in this app's configuration today — this
  app only supports the pull model.

Auto-discovery (the "Discover" button) only ever identifies `zkteco` devices, since a plain
TCP port probe can't tell what's actually listening. A `http-generic` device must be added
manually.

---

## Windows

Requirements: Windows 10/11, PowerShell 7+, an elevated ("Run as Administrator") prompt,
and internet access for the one-time dependency install (Node.js/PostgreSQL via
`winget`, if not already present).

Get the code onto the machine first — see
[Getting the code onto a machine](#getting-the-code-onto-a-machine) (clone directly on
your own machine, or extract a release zip on a client's) — then:

```powershell
cd C:\Apps\Attendance-check-point
.\deploy\setup-windows.ps1
```

If Node.js or PostgreSQL had to be installed for the first time, the script tells you to
close the window and re-run it once (so PATH picks up the new installs) — that's expected,
just run it again.

On success it prints the LAN URL and the generated admin login + database password once —
save them. Optional parameters if you want to pin specific values instead of generated
ones:

```powershell
.\deploy\setup-windows.ps1 -Port 4000 -AdminUsername admin -AdminPassword 'Str0ng!Pass' -DbPassword 'Str0ng!DbPass'
```

If PostgreSQL already existed on the machine with a superuser password set, pass it so the
script can create the app's role/database:

```powershell
.\deploy\setup-windows.ps1 -PgSuperPassword 'that-postgres-superuser-password'
```

**What it does, in order:** installs Node.js/PostgreSQL if missing (via winget) → creates
the app's database role/database → generates `.env` with random DB/JWT secrets → `npm ci`
+ frontend build → runs migrations → installs PM2 (+`pm2-windows-startup` so it resurrects
on login) and starts the app → opens a Windows Firewall rule for the port on the *Private*
network profile → creates the first admin account.

**Day to day:**

```powershell
pm2 status
pm2 logs attendance-app
pm2 restart attendance-app
```

**After pulling code changes (your own machine):**

```powershell
git pull
.\deploy\setup-windows.ps1
```

**Updating a client's machine:** see
[Rolling out an update to a client install](#rolling-out-an-update-to-a-client-install) —
there's no `git pull` there, since it was set up from a zip, not a clone.

**Known limitation:** PM2 resurrection happens on **user login**, not on raw machine
boot — fine for a PC that stays logged in, not a true headless server. If the PC restarts
and sits at the login screen, the app won't come back until someone logs in. For a
machine that reboots unattended, use the Linux path instead.

---

## Linux (Ubuntu VM/server)

Requirements: Ubuntu Server 22.04/24.04, root/sudo, internet access for the one-time
package install (`apt-get`).

```bash
sudo mkdir -p /opt/attendance-check-point
sudo chown "$USER" /opt/attendance-check-point
```

Get the code into `/opt/attendance-check-point` — see
[Getting the code onto a machine](#getting-the-code-onto-a-machine) (clone directly on
your own machine, or extract a release zip on a client's) — then:

```bash
cd /opt/attendance-check-point
sudo bash deploy/setup-vm.sh
```

On success it prints the LAN URL and the generated admin login + database password once —
save them. Optional overrides via env vars:

```bash
sudo DB_PASSWORD='pick-a-password' ADMIN_USERNAME='admin' ADMIN_PASSWORD='Str0ng!Pass' bash deploy/setup-vm.sh
```

**What it does, in order:** installs Node.js/PostgreSQL/nginx → creates the app's
database role/database → generates `.env` with random DB/JWT secrets → `npm ci` +
frontend build → runs migrations → creates the first admin account → installs
`attendance-backend` as a systemd service (`Restart=always`) → installs nginx as the
reverse proxy/static file server → opens port 80 in `ufw` if it's active.

If running this on an **ESXi VM**: give the VM's network adapter the same bridged
vSwitch/port group as the physical scanners (not an internal-only or NAT'd one), a static
IP or DHCP reservation, and in the ESXi host's *VM Startup/Shutdown* config set it to
start automatically with the host — that's what makes the app survive a host power
outage, on top of systemd already surviving a VM reboot.

**Day to day:**

```bash
systemctl status attendance-backend nginx
journalctl -u attendance-backend -f
```

**After pulling code changes (your own machine):**

```bash
cd /opt/attendance-check-point
git pull
sudo bash deploy/setup-vm.sh
```

**Updating a client's machine:** see
[Rolling out an update to a client install](#rolling-out-an-update-to-a-client-install) —
there's no `git pull` there, since it was set up from a zip, not a clone.

**Nightly backups** — add to root's crontab:

```bash
sudo crontab -e
# add:
0 2 * * * /opt/attendance-check-point/deploy/backup-db.sh >> /var/log/attendance-backup.log 2>&1
```

Backups land in `/opt/attendance-backups`, kept for 14 days by default (edit
`deploy/backup-db.sh` to change). Reads DB credentials from `.env` automatically. Also
take periodic VM snapshots as a coarser safety net.

**Verify:**
- `systemctl status attendance-backend nginx` — both `active (running)`.
- From another machine on the LAN, browse to `http://<vm-ip>/` and log in.
- Open the Devices page and confirm it discovers a real scanner on the network.
- Reboot the VM and confirm both services come back up on their own, no login required.
- `sudo systemctl kill -s SIGKILL attendance-backend` and confirm systemd restarts it.

---

## Rolling out an update to a client install

A client's machine was set up from a zip, not a clone, so `git pull` isn't an option
there. To ship them a code update:

```bash
# On YOUR machine, in the repo root, with the changes you want to ship committed:
git archive --format=zip -o attendance-checkpoint-release.zip HEAD
```

Transfer the new zip to the client's machine and extract it **over the existing
install directory**, replacing the code files but leaving `.env`, `node_modules/`, and
`uploads/` alone (none of those are part of the archive, since `git archive` only
includes tracked files). Then re-run the same setup script as the original install
(`.\deploy\setup-windows.ps1` or `sudo bash deploy/setup-vm.sh`) — it's idempotent, so it
just rebuilds the frontend, re-runs migrations, and restarts the service, without
touching the existing `.env`, database, or admin account.

## Rotating secrets later

Both scripts only generate `JWT_SECRET`/`JWT_REFRESH_SECRET`/the DB password on the very
first run (an existing `.env` is never touched). To rotate them deliberately:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Paste the result into `.env` (`JWT_SECRET`/`JWT_REFRESH_SECRET`), then restart the
service (`pm2 restart attendance-app` on Windows, `sudo systemctl restart
attendance-backend` on Linux). Rotating the JWT secrets invalidates every existing login
session.

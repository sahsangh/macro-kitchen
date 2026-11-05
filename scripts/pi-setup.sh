#!/bin/bash
# Run this ON the Raspberry Pi:  bash pi-setup.sh
#
# Installs Node.js 22, the Macro Kitchen server (as a service that starts on
# boot and restarts if it crashes), and Tailscale Funnel, which gives the
# server a public https:// address your phone can reach from anywhere.
#
# Safe to re-run: it pulls the latest code from GitHub and restarts the server.
set -euo pipefail

REPO=https://github.com/sahsangh/macro-kitchen.git
DIR="$HOME/macro-kitchen"
ENV_UPLOAD="$HOME/macro-kitchen.env"   # copied here from the Mac with scp
PORT=4000

step() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m%s\033[0m\n' "$*"; exit 1; }

# --- Node.js + git -----------------------------------------------------------
if ! command -v git >/dev/null; then
  step "Installing git"
  sudo apt-get update && sudo apt-get install -y git
fi
if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  step "Installing Node.js 22 (a few minutes on a Pi 3)"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "Node $(node -v)"

# --- Code --------------------------------------------------------------------
step "Getting the latest code"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull --ff-only
else
  git clone --depth 1 "$REPO" "$DIR"
fi

# --- Secrets -----------------------------------------------------------------
if [ -f "$ENV_UPLOAD" ]; then
  mv "$ENV_UPLOAD" "$DIR/server/.env"
fi
[ -f "$DIR/server/.env" ] || die "Missing server settings. On your Mac, run:
  scp ~/Downloads/code/calRecipeTracker/server/.env $USER@pi.local:~/macro-kitchen.env
then run this script again."
chmod 600 "$DIR/server/.env"
# The app is reached through Funnel on 4000, whatever the Mac's .env says.
sed -i "s/^PORT=.*/PORT=$PORT/" "$DIR/server/.env"
grep -q '^PORT=' "$DIR/server/.env" || echo "PORT=$PORT" >> "$DIR/server/.env"

step "Installing server packages"
(cd "$DIR/server" && npm ci --omit=dev --no-audit --no-fund)

# --- Service -----------------------------------------------------------------
step "Setting up the server to start on boot"
sudo tee /etc/systemd/system/macro-kitchen.service >/dev/null <<EOF
[Unit]
Description=Macro Kitchen API
After=network-online.target
Wants=network-online.target

[Service]
User=$USER
WorkingDirectory=$DIR/server
ExecStart=$(command -v node) src/index.js
Environment=NODE_ENV=production
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable macro-kitchen >/dev/null
sudo systemctl restart macro-kitchen

printf 'Waiting for the server'
for _ in $(seq 1 45); do
  if curl -fs "http://localhost:$PORT/health" >/dev/null; then echo " up!"; break; fi
  printf '.'; sleep 2
done
curl -fs "http://localhost:$PORT/health" >/dev/null || die "
The server didn't start. See why with:
  journalctl -u macro-kitchen -n 50 --no-pager"

# --- Tailscale Funnel --------------------------------------------------------
if ! command -v tailscale >/dev/null; then
  step "Installing Tailscale"
  curl -fsSL https://tailscale.com/install.sh | sh
fi
if ! tailscale status >/dev/null 2>&1; then
  step "Sign in to Tailscale: open the link below on your Mac or phone"
  sudo tailscale up
fi

step "Turning on Funnel (public https address)"
echo "If it prints a link, open it, click Enable, and it will continue."
sudo tailscale funnel --bg "$PORT"

HOST=$(tailscale status --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))')
step "Done!"
echo "Server address for the app:  https://$HOST"
echo "Test it from your Mac:       curl https://$HOST/health"
echo
echo "Useful commands:"
echo "  Update to latest code:  bash ~/pi-setup.sh"
echo "  Server logs:            journalctl -u macro-kitchen -f"
echo "  Restart server:         sudo systemctl restart macro-kitchen"

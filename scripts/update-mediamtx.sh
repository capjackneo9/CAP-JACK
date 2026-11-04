#!/usr/bin/env sh
# Refresh deploy/mediamtx.yml from the example, keeping your existing live password.
# Usage (on the VPS):  sh scripts/update-mediamtx.sh [PUBLIC_IP]
set -eu
cd "$(dirname "$0")/.."
CFG=deploy/mediamtx.yml
[ -f "$CFG" ] || { echo "No $CFG yet — follow docs/DEPLOYMENT.md section 5b first."; exit 1; }
PASS=$(awk '/user: ncvr/{f=1} f && /pass:/{print $2; exit}' "$CFG")
[ -n "$PASS" ] || { echo "Could not find the ncvr live password in $CFG"; exit 1; }
IP=${1:-$(curl -4 -fsS https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')}
cp "$CFG" "$CFG.bak"
sed -e "s/CHANGE_ME_LIVE_PASSWORD/$PASS/" -e "s/CHANGE_ME_PUBLIC_IP/$IP/" deploy/mediamtx.yml.example > "$CFG"
echo "Updated $CFG (public IP $IP, live password kept; backup in $CFG.bak)."

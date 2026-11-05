#!/bin/bash
# Adds an extra Wi-Fi network (e.g. your iPhone hotspot) to a Raspberry Pi SD card
# flashed with Raspberry Pi Imager, keeping the existing network. Run with the
# card's "bootfs" volume mounted on your Mac. The password is typed privately.
set -euo pipefail
BOOT=/Volumes/bootfs
[ -f "$BOOT/network-config" ] || { echo "Can't find $BOOT/network-config — is the SD card in?"; exit 1; }

echo "Tip: on iPhone, Settings → Personal Hotspot → turn ON \"Maximize Compatibility\"."
echo "The hotspot name is your iPhone's name (Settings → General → About → Name)."
read -r -p "Hotspot name, exactly: " SSID
read -r -s -p "Hotspot password (hidden): " PASS; echo

python3 - "$SSID" "$PASS" "$BOOT" <<'PY'
import json, re, sys, time
ssid, pw, boot = sys.argv[1], sys.argv[2], sys.argv[3]
path = f"{boot}/network-config"
cfg = open(path).read()
if json.dumps(ssid, ensure_ascii=False) in cfg:
    print(f"{ssid!r} is already on the card.")
else:
    # JSON strings are valid YAML double-quoted strings, so quotes/apostrophes are safe.
    entry = f"        {json.dumps(ssid, ensure_ascii=False)}:\n          password: {json.dumps(pw, ensure_ascii=False)}\n"
    cfg = cfg.replace("      access-points:\n", "      access-points:\n" + entry, 1)
    open(path, "w").write(cfg)
    print(f"Added {ssid!r}.")

# New instance id → the Pi re-runs its first-boot setup (network, SSH) next boot.
new_id = f"rpi-imager-{int(time.time() * 1000)}"
for name in ("meta-data", "cmdline.txt"):
    p = f"{boot}/{name}"
    text = open(p).read()
    open(p, "w").write(re.sub(r"rpi-imager-\d+", new_id, text))
print("Done. Networks on the card:")
for line in open(path):
    if line.strip().endswith(":") and line.startswith('        "'):
        print("  -", line.strip()[:-1])
PY

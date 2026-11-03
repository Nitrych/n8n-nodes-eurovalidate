#!/usr/bin/env bash
# End-to-end smoke test: run the built package inside a real n8n (Docker),
# import a credential and execute test/smoke-workflow.json headlessly.
#
#   EV_API_KEY=ev_live_... integrations/n8n/test/smoke.sh
#
# Needs: Docker, a built dist/ (npm run build). Pulls n8nio/n8n on first run.
# Prints the execution output; exits non-zero if the VAT step did not return
# status=valid or the LEI step did not return a legal name.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${EV_API_KEY:?set EV_API_KEY}"
IMAGE="${N8N_IMAGE:-n8nio/n8n:latest}"
# Keep the scratch dir inside the package: Docker Desktop on macOS does not share
# /var/folders (mktemp) by default, which silently yields empty mounts.
WORK="$PWD/.smoke-tmp"
rm -rf "$WORK"; mkdir -p "$WORK"
trap 'rm -rf "$WORK"' EXIT

# ── 1. Lay the package out the way n8n installs community nodes ─────────────
# ~/.n8n/nodes/package.json + node_modules/<pkg> (package.json + dist)
PKG_DIR="$WORK/n8n/nodes/node_modules/n8n-nodes-eurovalidate"
mkdir -p "$PKG_DIR"
TGZ="$(npm pack --silent --pack-destination "$WORK" | tail -1)"
tar -xzf "$WORK/$TGZ" -C "$PKG_DIR" --strip-components=1
cat > "$WORK/n8n/nodes/package.json" <<'EOF'
{ "name": "installed-nodes", "private": true, "dependencies": { "n8n-nodes-eurovalidate": "*" } }
EOF

# ── 2. Credential + workflow fixtures ───────────────────────────────────────
mkdir -p "$WORK/fixtures"
cat > "$WORK/fixtures/credentials.json" <<EOF
[{"id":"smoke-cred","name":"EuroValidate smoke","type":"euroValidateApi","data":{"apiKey":"${EV_API_KEY}"}}]
EOF
cp test/smoke-workflow.json "$WORK/fixtures/workflow.json"
chmod -R a+rwX "$WORK"

# ── 3. Run inside n8n ───────────────────────────────────────────────────────
echo "== n8n image: $IMAGE"
docker run --rm \
  -e N8N_ENCRYPTION_KEY=smoke-test-key-not-secret \
  -e N8N_LOG_LEVEL=info \
  -e N8N_RUNNERS_ENABLED=false \
  -e N8N_DIAGNOSTICS_ENABLED=false \
  -e N8N_VERSION_NOTIFICATIONS_ENABLED=false \
  -v "$WORK/n8n:/home/node/.n8n" \
  -v "$WORK/fixtures:/fixtures:ro" \
  --entrypoint sh "$IMAGE" -c '
    set -e
    n8n import:credentials --input=/fixtures/credentials.json >/dev/null
    n8n import:workflow --input=/fixtures/workflow.json >/dev/null
    n8n execute --id=smoke-wf
  ' > "$WORK/out.json" 2> "$WORK/err.log" || { echo "n8n execute failed:"; tail -40 "$WORK/err.log"; exit 1; }

# ── 4. Assert ───────────────────────────────────────────────────────────────
python3 - "$WORK/out.json" <<'PY' || { echo "---- stdout (head):"; head -c 2000 "$WORK/out.json"; echo; echo "---- stderr (tail):"; tail -30 "$WORK/err.log"; exit 1; }
import json, sys, re
raw = open(sys.argv[1]).read()
# n8n prints a few log lines, then the execution JSON
start = raw.find("{"); end = raw.rfind("}")
data = json.loads(raw[start:end + 1])
run = data.get("data", data).get("resultData", {}).get("runData", {})
def first(node):
    out = run[node][0]["data"]["main"][0][0]["json"]
    return out
vat = first("Validate VAT"); lei = first("Company by LEI")
print("VAT :", vat.get("vat_number"), vat.get("status"), vat.get("company_name"), "| source:", vat.get("meta", {}).get("source"))
print("LEI :", lei.get("lei"), lei.get("legal_name"), lei.get("jurisdiction"), "| source:", lei.get("meta", {}).get("source"))
assert vat.get("status") == "valid" and vat.get("vat_number") == "NL820646660B01", vat
assert lei.get("legal_name"), lei
print("SMOKE OK")
PY

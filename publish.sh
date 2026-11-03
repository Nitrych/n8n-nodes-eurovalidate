#!/usr/bin/env bash
# Publish n8n-nodes-eurovalidate to npm (run by the founder; needs `npm login` once).
#   integrations/n8n/publish.sh            # lint + build + publish current package.json version
# Bump the version in package.json first (npm version patch|minor) — npm refuses to re-publish a version.
set -euo pipefail
cd "$(dirname "$0")"
[ -d node_modules ] || npm ci --silent
npm run lint
npm run build
npm pack --dry-run 2>&1 | tail -15
echo; read -r -p "Publish $(node -p "require('./package.json').name+'@'+require('./package.json').version") to npm? [y/N] " yn
[ "${yn:-n}" = "y" ] || { echo "aborted"; exit 1; }
npm publish --access public
echo "published: https://www.npmjs.com/package/n8n-nodes-eurovalidate"

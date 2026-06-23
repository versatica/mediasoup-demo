#!/usr/bin/env bash

#
# This script is executed when accessing the server via SSH with an specific
# SSH key. It is ruled by `.ssh/authorized_keys` which contains this:
#
# # For mediasoup-demo project to trigger a redeploy via GitHub Actions.
# command="/xxxxxx/deploy/deploy-demo.sh",environment="MEDIASOUP_DEMO_PATH=/xxxxxx",environment="PM2_SERVICE_NAME=xxxxxx",restrict ssh-ed25519 xxxxxxxxxxxxxxxxxxxxxxxx gha-mediasoup-demo
#
# The demo-deploy workflow performs this SSH access when appropriate to trigger
# a redeploy of the mediasoup-demo application.
#

set -euo pipefail
# Remove `set -x` because we don't want that all commands below are exposed by
# the GitHub workflow execution.
# set -x

# These are injected by the SSH `authorized_keys` entry via its `environment=`
# options (requires `PermitUserEnvironment yes` in sshd_config), so they live on
# the server next to the key that uses them and never appear in this repo.
MEDIASOUP_DEMO_PATH="${MEDIASOUP_DEMO_PATH:-}"
PM2_SERVICE_NAME="${PM2_SERVICE_NAME:-}"

if [ -z "${MEDIASOUP_DEMO_PATH}" ] || [ -z "${PM2_SERVICE_NAME}" ]; then
  echo "ERROR: MEDIASOUP_DEMO_PATH and PM2_SERVICE_NAME must be set via authorized_keys environment= options" >&2
  exit 1
fi

# Non-interactive SSH sessions (forced command) do NOT source .bashrc/.profile,
# so make sure node/npm/pm2 are reachable. Adjust to your install.
export PATH="/usr/local/bin:/usr/bin:/bin:${PATH}"
# If we use nvm, source it instead:
# export NVM_DIR="${HOME}/.nvm"
# [ -s "${NVM_DIR}/nvm.sh" ] && . "${NVM_DIR}/nvm.sh"

cd "${MEDIASOUP_DEMO_PATH}"

# Get the latest committed state of branch v3 (includes the mediasoup bump
# pushed by the update-mediasoup workflow), discarding any local changes.
# Gitignored files (server/config.mjs, server/public, node_modules) are kept.
git fetch origin v3
git reset --hard origin/v3

# Build the browser client app (app/) with Vite and place its output into
# server/public, which is what the server serves.
cd app/
npm ci --legacy-peer-deps --foreground-scripts
npm run build
rm -rf ../server/public
mv dist ../server/public
cd ..

# Build the server: install deps (may download the mediasoup-worker prebuilt
# binary, that's fine) and transpile TypeScript (src/) to JavaScript (lib/).
cd server/
npm ci --foreground-scripts
npm run typescript:build
cd ..

# Restart the service. `pm2 restart <name>` talks to the PM2 daemon via its
# socket, so it does NOT depend on the cwd nor on ecosystem.config.js.
pm2 restart --update-env "${PM2_SERVICE_NAME}"

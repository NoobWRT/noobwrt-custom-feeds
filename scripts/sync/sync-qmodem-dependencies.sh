#!/bin/bash
# Wrapper to sync luci-app-internet-detector using the generic sync-repo.sh

set -e

# Environment parameters for luci-app-internet-detector
export SYNC_REPO_URL="https://github.com/FUjr/QModem.git"
export SYNC_REMOTE_PATH="/application"
export SYNC_DEST_DIR="packages/dependencies"
export SYNC_COPY_SUBDIRS=true
export SYNC_CLEAN_DEST=false

# Call the generic sync script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/sync-repo.sh"

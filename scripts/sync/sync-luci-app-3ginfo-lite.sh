#!/bin/bash
# Wrapper to sync luci-app-internet-detector using the generic sync-repo.sh

set -e


export SYNC_REPO_URL="https://github.com/4IceG/luci-app-3ginfo-lite.git"
export SYNC_REMOTE_PATH="/luci-app-3ginfo-lite"
export SYNC_DEST_DIR="package/luci-app-3ginfo-lite"
export SYNC_COPY_SUBDIRS=true
export SYNC_CLEAN_DEST=true

# Call the generic sync script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/sync-repo.sh"

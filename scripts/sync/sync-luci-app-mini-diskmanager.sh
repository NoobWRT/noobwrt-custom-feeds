#!/bin/bash

set -e


export SYNC_REPO_URL="https://github.com/4IceG/luci-app-mini-diskmanager.git"
export SYNC_REMOTE_PATH="/luci-app-mini-diskmanager"
export SYNC_DEST_DIR="package/luci-app-mini-diskmanager"
export SYNC_COPY_SUBDIRS=true
export SYNC_CLEAN_DEST=true

# Call the generic sync script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/sync-repo.sh"

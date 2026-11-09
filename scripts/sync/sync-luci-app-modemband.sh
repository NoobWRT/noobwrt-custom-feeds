#!/bin/bash
# Wrapper to sync luci-app-modemband using the generic sync-repo.sh

set -e

export SYNC_REPO_URL="https://github.com/4IceG/luci-app-modemband.git"
export SYNC_REMOTE_PATH="/luci-app-modemband"
export SYNC_DEST_DIR="package/luci-app-modemband"
export SYNC_COPY_SUBDIRS=true
export SYNC_CLEAN_DEST=true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/sync-repo.sh"

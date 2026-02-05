#!/bin/bash
# Wrapper to sync luci-app-internet-detector using the generic sync-repo.sh

set -e


export SYNC_REPO_URL="https://github.com/nooblk-98/luci-theme-noobwrt.git"
export SYNC_REMOTE_PATH="."
export SYNC_DEST_DIR="package/luci-theme-noobwrt"
export SYNC_COPY_SUBDIRS=true
export SYNC_CLEAN_DEST=true

# Call the generic sync script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/sync-repo.sh"

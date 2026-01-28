#!/bin/bash
# Wrapper to sync luci-app-wrtbwmon using the generic sync-repo.sh

set -e


export SYNC_REPO_URL="https://github.com/peditx/luci-theme-carbonpx.git"
export SYNC_REMOTE_PATH="."
export SYNC_DEST_DIR="package/luci-theme-carbonpx"
export SYNC_COPY_SUBDIRS=true
export SYNC_CLEAN_DEST=true

# Call the generic sync script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/sync-repo.sh"

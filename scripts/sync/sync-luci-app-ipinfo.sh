#!/bin/bash
# Wrapper to sync luci-app-wrtbwmon using the generic sync-repo.sh

set -e

# Environment parameters for luci-app-wrtbwmon
export SYNC_REPO_URL="https://github.com/animegasan/luci-app-ipinfo.git"
export SYNC_REMOTE_PATH="."
export SYNC_DEST_DIR="package/luci-app-ipinfo"
export SYNC_COPY_SUBDIRS=true
export SYNC_CLEAN_DEST=true

# Call the generic sync script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/sync-repo.sh"

#!/bin/bash
# Wrapper to sync luci-app-wrtbwmon using the generic sync-repo.sh

set -e

# Environment parameters for luci-app-wrtbwmon
export SYNC_REPO_URL="https://github.com/sirpdboy/luci-app-netspeedtest.git"
export SYNC_REMOTE_PATH="."
export SYNC_DEST_DIR="feeds/netspeedtest"
export SYNC_COPY_SUBDIRS=true
export SYNC_CLEAN_DEST=true

# Call the generic sync script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/sync-repo.sh"

#!/bin/bash
# Wrapper to sync luci-app-internet-detector using the generic sync-repo.sh

set -e


export SYNC_REPO_URL="https://github.com/gSpotx2f/luci-app-internet-detector.git"
export SYNC_REMOTE_PATH="."
export SYNC_DEST_DIR="packages"
export SYNC_COPY_SUBDIRS=true
export SYNC_CLEAN_DEST=true

# Call the generic sync script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/sync-repo.sh"


export SYNC_REPO_URL="https://github.com/gSpotx2f/luci-app-internet-detector.git"
export SYNC_REMOTE_PATH="/internet-detector"
export SYNC_DEST_DIR="modules/internet-detector"
export SYNC_COPY_SUBDIRS=true
export SYNC_CLEAN_DEST=false

# Call the generic sync script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/sync-repo.sh"


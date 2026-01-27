#!/bin/bash
# Wrapper to sync luci-app-wrtbwmon using the generic sync-repo.sh

set -e

export SYNC_REPO_URL="https://github.com/4IceG/luci-app-modemdata.git"
export SYNC_REMOTE_PATH="."
export SYNC_DEST_DIR="feeds/modemdata"
export SYNC_COPY_SUBDIRS=true
export SYNC_CLEAN_DEST=false

# Call the generic sync script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/sync-repo.sh"

export SYNC_REPO_URL="https://github.com/obsy/modemdata.git"
export SYNC_REMOTE_PATH="."
export SYNC_DEST_DIR="feeds/modemdata"
export SYNC_COPY_SUBDIRS=true
export SYNC_CLEAN_DEST=false

# Call the generic sync script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/sync-repo.sh"


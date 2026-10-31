#!/bin/bash
# Wrapper to sync luci-app-modemdata and modemdata using the generic sync-repo.sh

set -e

# Fork of 4IceG/luci-app-modemdata with the phone layout fix (upstream PR 4IceG/luci-app-modemdata#45)
export SYNC_REPO_URL="https://github.com/nooblk-98/luci-app-modemdata.git"
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


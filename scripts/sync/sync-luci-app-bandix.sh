#!/bin/bash


set -e


export SYNC_REPO_URL="https://github.com/timsaya/luci-app-bandix.git"
export SYNC_REMOTE_PATH="/luci-app-bandix"
export SYNC_DEST_DIR="feeds/bandix/luci-app-bandix"
export SYNC_COPY_SUBDIRS=true
export SYNC_CLEAN_DEST=true

# Call the generic sync script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/sync-repo.sh"


export SYNC_REPO_URL="https://github.com/timsaya/openwrt-bandix.git"
export SYNC_REMOTE_PATH="/openwrt-bandix"
export SYNC_DEST_DIR="feeds/bandix/openwrt-bandix"
export SYNC_COPY_SUBDIRS=true
export SYNC_CLEAN_DEST=false

# Call the generic sync script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/sync-repo.sh"

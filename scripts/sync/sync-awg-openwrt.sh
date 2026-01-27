#!/bin/bash

set -e

export SYNC_REPO_URL="https://github.com/Slava-Shchipunov/awg-openwrt.git"
export SYNC_REMOTE_PATH="."
export SYNC_DEST_DIR="feeds/awg_openwrt"
export SYNC_COPY_SUBDIRS=true
export SYNC_CLEAN_DEST=true

# Call the generic sync script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/sync-repo.sh"

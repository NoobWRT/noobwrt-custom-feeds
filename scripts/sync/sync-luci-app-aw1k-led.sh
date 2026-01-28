#!/bin/bash
set -e


export SYNC_REPO_URL="https://github.com/dotywrt/linux-5.15.git"
export SYNC_REMOTE_PATH="/package/custom_app/luci-app-aw1k-led"
export SYNC_DEST_DIR="package/luci-app-aw1k-led"
export SYNC_COPY_SUBDIRS=true
export SYNC_CLEAN_DEST=true

# Call the generic sync script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/sync-repo.sh"

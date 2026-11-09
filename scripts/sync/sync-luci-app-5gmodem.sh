#!/bin/bash
# Wrapper to sync luci-app-5gmodem using the generic sync-repo.sh

set -e

export SYNC_REPO_URL="https://github.com/fildunsky/luci-app-5gmodem.git"
export SYNC_REMOTE_PATH="/luci-app-5gmodem"
export SYNC_DEST_DIR="package/luci-app-5gmodem"
export SYNC_COPY_SUBDIRS=true
export SYNC_CLEAN_DEST=true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/sync-repo.sh"

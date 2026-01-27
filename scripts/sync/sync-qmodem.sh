#!/bin/bash
# Wrapper to sync QModem luci and dependencies using the generic sync-repo.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Sync QModem luci packages
export SYNC_REPO_URL="https://github.com/FUjr/QModem.git"
export SYNC_REMOTE_PATH="luci"
export SYNC_DEST_DIR="packages"
export SYNC_COPY_SUBDIRS=true
export SYNC_CLEAN_DEST=true

bash "${SCRIPT_DIR}/sync-repo.sh"

# Sync QModem dependencies
export SYNC_REPO_URL="https://github.com/FUjr/QModem.git"
export SYNC_REMOTE_PATH="/application"
export SYNC_DEST_DIR="modules"
export SYNC_COPY_SUBDIRS=true
export SYNC_CLEAN_DEST=false

bash "${SCRIPT_DIR}/sync-repo.sh"

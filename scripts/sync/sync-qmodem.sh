#!/bin/bash
# Wrapper to sync QModem luci packages using the generic sync-repo.sh

set -e

# Environment parameters for QModem
export SYNC_REPO_URL="https://github.com/FUjr/QModem.git"
export SYNC_REMOTE_PATH="luci"
export SYNC_DEST_DIR="packages/QModem"
export SYNC_COPY_SUBDIRS=true
# Uncomment to clean destination before copy
# export SYNC_CLEAN_DEST=true

# Call the generic sync script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/sync-repo.sh"

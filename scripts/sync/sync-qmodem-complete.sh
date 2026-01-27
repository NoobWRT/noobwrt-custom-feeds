#!/bin/bash
# Wrapper to sync all QModem packages (luci + dependencies)
# This script syncs both the QModem luci folder and the application dependencies
# All from the same upstream repository into different destination folders

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Starting complete QModem sync..."
echo ""

# Sync 1: QModem luci packages
echo "=========================================="
echo "Step 1: Syncing QModem luci packages..."
echo "=========================================="
export SYNC_REPO_URL="https://github.com/FUjr/QModem.git"
export SYNC_REMOTE_PATH="luci"
export SYNC_DEST_DIR="packages/QModem"
export SYNC_COPY_SUBDIRS=true
export SYNC_CLEAN_DEST=true

if ! bash "${SCRIPT_DIR}/sync-repo.sh"; then
    echo "ERROR: Failed to sync QModem luci packages"
    exit 1
fi

echo ""
echo "=========================================="
echo "Step 2: Syncing QModem dependencies..."
echo "=========================================="
# Sync 2: QModem dependencies (application folder)
export SYNC_REPO_URL="https://github.com/FUjr/QModem.git"
export SYNC_REMOTE_PATH="/application"
export SYNC_DEST_DIR="packages/dependencies"
export SYNC_COPY_SUBDIRS=true
export SYNC_CLEAN_DEST=false

if ! bash "${SCRIPT_DIR}/sync-repo.sh"; then
    echo "ERROR: Failed to sync QModem dependencies"
    exit 1
fi

echo ""
echo "=========================================="
echo "QModem complete sync finished successfully!"
echo "=========================================="
echo "Synced:"
echo "  - packages/QModem (luci packages)"
echo "  - packages/dependencies (application dependencies)"
exit 0

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

# Patch a fresh backend tree before copying it into the feed. Applying patches
# directly over the existing feed would fail on locally-added files at re-sync.
export SYNC_REPO_URL="https://github.com/obsy/modemdata.git"
export SYNC_REMOTE_PATH="."
export SYNC_COPY_SUBDIRS=true
export SYNC_CLEAN_DEST=false

if [ -n "${SYNC_CHECK_OUTPUT:-}" ]; then
    export SYNC_DEST_DIR="feeds/modemdata"
    bash "${SCRIPT_DIR}/sync-repo.sh"
    exit 0
fi

BACKEND_TMP=$(mktemp -d)
trap 'rm -rf -- "$BACKEND_TMP"' EXIT
export SYNC_DEST_DIR="$BACKEND_TMP"
bash "${SCRIPT_DIR}/sync-repo.sh"
(
    cd "$BACKEND_TMP"
    # Fail visibly on upstream conflicts; never silently discard the fixes.
    git apply --check "${SCRIPT_DIR}/../patches/modemdata-reporting.patch"
    git apply "${SCRIPT_DIR}/../patches/modemdata-reporting.patch"
)
cp -a "$BACKEND_TMP/." feeds/modemdata/

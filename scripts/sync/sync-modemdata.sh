#!/bin/bash
# Sync the LuCI source and apply its companion patch to the separate backend.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export SYNC_REPO_URL="https://github.com/nooblk-98/luci-app-modemdata.git"
# Optional override permits testing a pending source PR before it merges.
export SYNC_BRANCH="${MODEMDATA_LUCI_BRANCH:-main}"
export SYNC_REMOTE_PATH="."
export SYNC_COPY_SUBDIRS=true
export SYNC_CLEAN_DEST=false

if [ -n "${SYNC_CHECK_OUTPUT:-}" ]; then
    export SYNC_DEST_DIR="feeds/modemdata"
    bash "${SCRIPT_DIR}/sync-repo.sh"
    export SYNC_REPO_URL="https://github.com/obsy/modemdata.git"
    export SYNC_BRANCH=""
    bash "${SCRIPT_DIR}/sync-repo.sh"
    exit 0
fi

# Stage both sources first: a stale patch left by a previous sync must not
# substitute for a patch missing from the freshly fetched LuCI source.
STAGING_TMP=$(mktemp -d)
trap 'rm -rf -- "$STAGING_TMP"' EXIT
export SYNC_DEST_DIR="$STAGING_TMP/frontend"
bash "${SCRIPT_DIR}/sync-repo.sh"
BACKEND_PATCH="$STAGING_TMP/frontend/patches/modemdata/0001-quectel-reporting.patch"
if [ ! -f "$BACKEND_PATCH" ]; then
    echo "Missing companion backend patch in luci-app-modemdata source; sync aborted." >&2
    exit 1
fi

export SYNC_REPO_URL="https://github.com/obsy/modemdata.git"
export SYNC_BRANCH=""
export SYNC_DEST_DIR="$STAGING_TMP/backend"
bash "${SCRIPT_DIR}/sync-repo.sh"
(
    cd "$STAGING_TMP/backend"
    # Fail visibly on upstream conflicts; never silently discard the fixes.
    git apply --check "$BACKEND_PATCH"
    git apply "$BACKEND_PATCH"
)
mkdir -p feeds/modemdata
cp -a "$STAGING_TMP/frontend/." feeds/modemdata/
cp -a "$STAGING_TMP/backend/." feeds/modemdata/

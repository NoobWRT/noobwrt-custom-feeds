#!/bin/bash
# Script: check-upstream.sh
# Purpose: Record the current upstream commit of every synced repo (git ls-remote, no cloning)
#          so CI can skip the full sync when no upstream has moved since the last one
# Environment:
#   STATE_FILE - Where to write the sorted upstream state, default: ./.upstream-state

set -euo pipefail

SCRIPTS_DIR="${SCRIPTS_DIR:-./scripts}"
STATE_FILE="${STATE_FILE:-./.upstream-state}"

: > "${STATE_FILE}"
SYNC_CHECK_OUTPUT="$(realpath "${STATE_FILE}")" bash "${SCRIPTS_DIR}/run-sync-all.sh"

# The sync scripts themselves are part of the state, so editing one forces a resync
sha256sum "${SCRIPTS_DIR}"/sync/sync-*.sh >> "${STATE_FILE}"

sort -u -o "${STATE_FILE}" "${STATE_FILE}"

echo ""
echo "Upstream state ($(wc -l < "${STATE_FILE}" | tr -d ' ') entries):"
cat "${STATE_FILE}"

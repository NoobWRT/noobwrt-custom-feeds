#!/bin/bash
# Script: run-sync-all.sh
# Purpose: Discover and execute all sync-*.sh scripts under scripts/sync

set -euo pipefail

SCRIPTS_DIR="${SCRIPTS_DIR:-./scripts}"

if [ ! -d "${SCRIPTS_DIR}/sync" ]; then
  echo "ERROR: Missing ${SCRIPTS_DIR}/sync directory"
  exit 1
fi

echo 'Discovering all sync scripts in scripts/sync/...'
sync_scripts=$(find "${SCRIPTS_DIR}/sync" -name "sync-*.sh" -type f ! -name "sync-repo.sh" | sort || true)
if [ -z "${sync_scripts}" ]; then
  echo 'WARNING: No sync-*.sh scripts found in scripts/sync/'
else
  script_count=$(printf '%s\n' "${sync_scripts}" | sed '/^$/d' | wc -l | tr -d ' ')
  echo "Found ${script_count} sync script(s):"
  while IFS= read -r script; do
    [ -n "${script}" ] || continue
    echo "  - ${script}"
  done <<< "${sync_scripts}"
fi

if [ -n "${sync_scripts}" ]; then
  while IFS= read -r sync_script; do
    [ -n "${sync_script}" ] || continue
    script_name=$(basename "${sync_script}")
    echo ""
    echo "Executing: ${script_name}"
    bash "${sync_script}"
    echo "${script_name} completed successfully"
  done <<< "${sync_scripts}"
fi

if [ -n "${sync_scripts}" ]; then
  echo ""
  echo "All sync scripts executed successfully"
fi

#!/bin/bash
# Script: check-changes.sh
# Purpose: Check if there are any changes in synced directories (auto-discovers from sync scripts)

set -euo pipefail

SYNC_DIR="scripts/sync"

# Discover SYNC_DEST_DIR values from all sync wrapper scripts
discover_dest_dirs() {
    local scripts
    scripts=$(find "${SYNC_DIR}" -name "sync-*.sh" -type f ! -name "sync-repo.sh" 2>/dev/null || true)

    if [ -z "${scripts}" ]; then
        return 0
    fi

    # Extract SYNC_DEST_DIR assignments (quoted or unquoted)
    # shellcheck disable=SC2016
    printf '%s\n' "${scripts}" | while IFS= read -r script; do
        sed -n -E "s/^[[:space:]]*export[[:space:]]+SYNC_DEST_DIR[[:space:]]*=[[:space:]]*['\"]?([^'\"[:space:]]+)['\"]?.*/\1/p" "${script}" || true
    done
}

echo "Checking for changes in synced directories..."
echo ""

# Always ensure the file exists
echo "false" > .changes-detected

mapfile -t RAW_DEST_DIRS < <(discover_dest_dirs | sed '/^$/d' || true)

# De-duplicate while preserving order
declare -A SEEN_DESTS=()
DEST_DIRS=()
for dest in "${RAW_DEST_DIRS[@]:-}"; do
    if [ -n "${dest}" ] && [ -z "${SEEN_DESTS[${dest}]:-}" ]; then
        SEEN_DESTS["${dest}"]=1
        DEST_DIRS+=("${dest}")
    fi
done

if [ ${#DEST_DIRS[@]} -eq 0 ]; then
    echo "No SYNC_DEST_DIR values discovered under ${SYNC_DIR}/"
    echo "Nothing to check."
    exit 0
fi

echo "Discovered destination directories:"
printf '  - %s\n' "${DEST_DIRS[@]}"
echo ""

PACKAGE_DIRS=()
for dest in "${DEST_DIRS[@]}"; do
    if [ -d "${dest}" ]; then
        PACKAGE_DIRS+=("${dest}")
    else
        echo "Skipping missing directory: ${dest}"
    fi
done

if [ ${#PACKAGE_DIRS[@]} -eq 0 ]; then
    echo "No discovered destination directories exist yet."
    exit 0
fi

TOTAL_UNTRACKED=0
TOTAL_MODIFIED=0

for pkg in "${PACKAGE_DIRS[@]}"; do
    pkg_name="${pkg}"
    count_files=$(find "${pkg}" -type f 2>/dev/null | wc -l | tr -d ' ')
    echo "Files in ${pkg_name}: ${count_files}"
done
echo ""
echo "Checking for untracked files..."
for pkg in "${PACKAGE_DIRS[@]}"; do
    UNTRACKED=$(git ls-files --others --exclude-standard "${pkg}" 2>/dev/null | wc -l | tr -d ' ')
    TOTAL_UNTRACKED=$((TOTAL_UNTRACKED + UNTRACKED))
done
echo "Untracked files (all destinations): ${TOTAL_UNTRACKED}"

echo "Checking for modified files..."
for pkg in "${PACKAGE_DIRS[@]}"; do
    if git diff --quiet "${pkg}" 2>/dev/null; then
        MOD=0
    else
        MOD=$(git diff --name-only "${pkg}" 2>/dev/null | wc -l | tr -d ' ')
    fi
    TOTAL_MODIFIED=$((TOTAL_MODIFIED + MOD))
done
echo "Modified files (all destinations): ${TOTAL_MODIFIED}"

TOTAL_CHANGES=$((TOTAL_UNTRACKED + TOTAL_MODIFIED))

echo ""
echo "Total changes: ${TOTAL_CHANGES}"

if [ "${TOTAL_CHANGES}" -gt 0 ]; then
    echo "Changes detected"
    echo "true" > .changes-detected
    # Show first 20 new/modified files per destination
    for pkg in "${PACKAGE_DIRS[@]}"; do
        pkg_name="${pkg}"
        UNTRACKED_LIST=$(git ls-files --others --exclude-standard "${pkg}" 2>/dev/null | head -20 || true)
        MODIFIED_LIST=$(git diff --name-only "${pkg}" 2>/dev/null | head -20 || true)
        if [ -n "${UNTRACKED_LIST}" ]; then
            echo "New files in ${pkg_name} (first 20):"
            echo "${UNTRACKED_LIST}"
        fi
        if [ -n "${MODIFIED_LIST}" ]; then
            echo "Modified files in ${pkg_name} (first 20):"
            echo "${MODIFIED_LIST}"
        fi
    done
else
    echo "No changes detected"
    echo "false" > .changes-detected
fi

exit 0
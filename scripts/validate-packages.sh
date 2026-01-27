#!/bin/bash
# Script: validate-packages.sh
# Purpose: Validate that synced destinations contain files (auto-discovers from sync scripts)

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

echo "Validating synced destinations..."

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
    echo "WARNING: No SYNC_DEST_DIR values discovered under ${SYNC_DIR}/"
    echo "No destinations to validate."
    exit 0
fi

echo "Found destination directories:"
printf '  - %s\n' "${DEST_DIRS[@]}"

echo ""
echo "Destination summary:"
echo "=================="

PACKAGE_COUNT=0
TOTAL_FILES=0
TOTAL_DIRS=0

for dest in "${DEST_DIRS[@]}"; do
    if [ ! -d "${dest}" ]; then
        echo "${dest}: WARNING - directory does not exist"
        continue
    fi

    file_count=$(find "${dest}" -type f 2>/dev/null | wc -l | tr -d ' ')
    dir_count=$(find "${dest}" -type d 2>/dev/null | wc -l | tr -d ' ')

    if [ "${file_count}" -eq 0 ]; then
        echo "${dest}: WARNING - empty destination"
    else
        echo "${dest}: ${file_count} files, ${dir_count} directories"
    fi

    PACKAGE_COUNT=$((PACKAGE_COUNT + 1))
    TOTAL_FILES=$((TOTAL_FILES + file_count))
    TOTAL_DIRS=$((TOTAL_DIRS + dir_count))
done

echo "=================="
echo "Total destinations: ${PACKAGE_COUNT}"
echo "Total files: ${TOTAL_FILES}"
echo "Total directories: ${TOTAL_DIRS}"

if [ "${PACKAGE_COUNT}" -eq 0 ]; then
    echo "WARNING: No existing destination directories were found"
fi

exit 0
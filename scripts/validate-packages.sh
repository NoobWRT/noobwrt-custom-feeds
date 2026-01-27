#!/bin/bash
# Script: validate-packages.sh
# Purpose: Validate that packages were synced correctly (scans packages/, feeds/, etc.)

set -euo pipefail

# Scan for all potential package directories
SCAN_DIRS=("packages" "feeds")

echo "Validating packages in all directories..."

FOUND_DIRS=()
for dir in "${SCAN_DIRS[@]}"; do
    if [ -d "${dir}" ]; then
        FOUND_DIRS+=("${dir}")
    fi
done

if [ ${#FOUND_DIRS[@]} -eq 0 ]; then
    echo "WARNING: No package directories found (checked: ${SCAN_DIRS[*]})"
    echo "No packages to validate."
    exit 0
fi

echo "Found directories: ${FOUND_DIRS[*]}"

PACKAGE_COUNT=0
TOTAL_FILES=0
TOTAL_DIRS=0

echo ""
echo "Package summary:"
echo "=================="

# Iterate all directories
for base_dir in "${FOUND_DIRS[@]}"; do
    echo "Scanning ${base_dir}/..."
    while IFS= read -r -d '' pkg; do
        pkg_name="${base_dir}/$(basename "${pkg}")"
        file_count=$(find "${pkg}" -type f 2>/dev/null | wc -l | tr -d ' ')
        dir_count=$(find "${pkg}" -type d 2>/dev/null | wc -l | tr -d ' ')

        if [ "${file_count}" -eq 0 ]; then
            echo "  ${pkg_name}: WARNING - empty package"
        else
            echo "  ${pkg_name}: ${file_count} files, ${dir_count} directories"
        fi

        PACKAGE_COUNT=$((PACKAGE_COUNT + 1))
        TOTAL_FILES=$((TOTAL_FILES + file_count))
        TOTAL_DIRS=$((TOTAL_DIRS + dir_count))
    done < <(find "${base_dir}" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null)
done

echo "=================="
echo "Total packages: ${PACKAGE_COUNT}"
echo "Total files: ${TOTAL_FILES}"
echo "Total directories: ${TOTAL_DIRS}"

if [ "${PACKAGE_COUNT}" -eq 0 ]; then
    echo "WARNING: No packages found under ${PACKAGES_DIR}"
fi

exit 0

#!/bin/bash
# Script: validate-packages.sh
# Purpose: Validate that packages were synced correctly (generic, no hardcoding)

set -euo pipefail

# Default PACKAGES_DIR to ./packages if not provided
PACKAGES_DIR="${PACKAGES_DIR:-packages}"

echo "Validating packages under ${PACKAGES_DIR}..."

if [ ! -d "${PACKAGES_DIR}" ]; then
    echo "WARNING: ${PACKAGES_DIR} directory not found"
    echo "No packages to validate."
    exit 0
fi

PACKAGE_COUNT=0
TOTAL_FILES=0
TOTAL_DIRS=0

echo ""
echo "Package summary:"
echo "=================="

# Iterate all top-level directories inside PACKAGES_DIR
while IFS= read -r -d '' pkg; do
    pkg_name=$(basename "${pkg}")
    # Count files and directories within the package
    file_count=$(find "${pkg}" -type f 2>/dev/null | wc -l | tr -d ' ')
    dir_count=$(find "${pkg}" -type d 2>/dev/null | wc -l | tr -d ' ')

    if [ "${file_count}" -eq 0 ]; then
        echo "${pkg_name}: WARNING - empty package"
    else
        echo "${pkg_name}: ${file_count} files, ${dir_count} directories"
    fi

    PACKAGE_COUNT=$((PACKAGE_COUNT + 1))
    TOTAL_FILES=$((TOTAL_FILES + file_count))
    TOTAL_DIRS=$((TOTAL_DIRS + dir_count))
done < <(find "${PACKAGES_DIR}" -mindepth 1 -maxdepth 1 -type d -print0)

echo "=================="
echo "Total packages: ${PACKAGE_COUNT}"
echo "Total files: ${TOTAL_FILES}"
echo "Total directories: ${TOTAL_DIRS}"

if [ "${PACKAGE_COUNT}" -eq 0 ]; then
    echo "WARNING: No packages found under ${PACKAGES_DIR}"
fi

exit 0

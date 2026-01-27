#!/bin/bash
# Script: check-changes.sh
# Purpose: Check if there are any changes in packages/feeds folders (scans all)

set -euo pipefail

# Scan for all potential package directories
SCAN_DIRS=("packages" "feeds")

echo "Checking for changes in all directories..."
echo ""

# Always ensure the file exists
echo "false" > .changes-detected

PACKAGE_DIRS=()
for scan_dir in "${SCAN_DIRS[@]}"; do
    if [ -d "${scan_dir}" ]; then
        while IFS= read -r -d '' pkg; do
            PACKAGE_DIRS+=("${pkg}")
        done < <(find "${scan_dir}" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null)
    fi
done

if [ ${#PACKAGE_DIRS[@]} -eq 0 ]; then
    echo "No package subdirectories found in: ${SCAN_DIRS[*]}"
    exit 0
fi

TOTAL_UNTRACKED=0
TOTAL_MODIFIED=0

for pkg in "${PACKAGE_DIRS[@]}"; do
    pkg_name=$(basename "${pkg}")
    count_files=$(find "${pkg}" -type f | wc -l | tr -d ' ')
    echo "Files in ${pkg_name}: ${count_files}"
done
echo ""
echo "Checking for untracked files..."
for pkg in "${PACKAGE_DIRS[@]}"; do
    UNTRACKED=$(git ls-files --others --exclude-standard "${pkg}" | wc -l | tr -d ' ')
    TOTAL_UNTRACKED=$((TOTAL_UNTRACKED + UNTRACKED))
done
echo "Untracked files (all packages): ${TOTAL_UNTRACKED}"

echo "Checking for modified files..."
for pkg in "${PACKAGE_DIRS[@]}"; do
    if git diff --quiet "${pkg}" 2>/dev/null; then
        MOD=0
    else
        MOD=$(git diff --name-only "${pkg}" 2>/dev/null | wc -l | tr -d ' ')
    fi
    TOTAL_MODIFIED=$((TOTAL_MODIFIED + MOD))
done
echo "Modified files (all packages): ${TOTAL_MODIFIED}"

TOTAL_CHANGES=$((TOTAL_UNTRACKED + TOTAL_MODIFIED))

echo ""
echo "Total changes: ${TOTAL_CHANGES}"

if [ "${TOTAL_CHANGES}" -gt 0 ]; then
    echo "Changes detected"
    echo "true" > .changes-detected
    # Show first 20 new/modified files per package
    for pkg in "${PACKAGE_DIRS[@]}"; do
        pkg_name=$(basename "${pkg}")
        UNTRACKED_LIST=$(git ls-files --others --exclude-standard "${pkg}" | head -20 || true)
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

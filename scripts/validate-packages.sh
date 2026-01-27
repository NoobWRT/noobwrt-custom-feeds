#!/bin/bash
# Script: validate-packages.sh
# Purpose: Validate that packages were synced correctly

set -e

echo "Validating packages..."

if [ ! -d "${PACKAGES_DIR}" ]; then
    echo "ERROR: Packages directory not found"
    exit 1
fi

if [ -z "$(ls -A "${PACKAGES_DIR}")" ]; then
    echo "ERROR: Packages directory is empty"
    exit 1
fi

echo "✓ Packages directory exists and contains files"
echo ""
echo "Package summary:"
echo "=================="

PACKAGE_COUNT=0
for item in "${PACKAGES_DIR}"/*; do
    if [ -d "$item" ]; then
        PACKAGE_NAME=$(basename "$item")
        FILE_COUNT=$(find "$item" -type f | wc -l)
        DIR_COUNT=$(find "$item" -type d | wc -l)
        echo "  📦 ${PACKAGE_NAME}: ${FILE_COUNT} files, ${DIR_COUNT} directories"
        ((PACKAGE_COUNT++))
    elif [ -f "$item" ]; then
        PACKAGE_NAME=$(basename "$item")
        echo "  📄 ${PACKAGE_NAME} (file)"
        ((PACKAGE_COUNT++))
    fi
done

echo "=================="
echo "✓ Total packages: ${PACKAGE_COUNT}"

#!/bin/bash
# Script: validate-packages.sh
# Purpose: Validate that packages were synced correctly

echo "Validating packages in packages/QModem..."

if [ ! -d "${PACKAGES_DIR}/QModem" ]; then
    echo "ERROR: packages/QModem directory not found"
    exit 1
fi

if [ -z "$(ls -A "${PACKAGES_DIR}/QModem")" ]; then
    echo "ERROR: packages/QModem directory is empty"
    exit 1
fi

echo "✓ packages/QModem directory exists and contains files"
echo ""
echo "Package summary:"
echo "=================="

PACKAGE_COUNT=0
for item in "${PACKAGES_DIR}/QModem"/*; do
    if [ -d "$item" ]; then
        PACKAGE_NAME=$(basename "$item")
        FILE_COUNT=$(find "$item" -type f 2>/dev/null | wc -l)
        DIR_COUNT=$(find "$item" -type d 2>/dev/null | wc -l)
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

if [ "${PACKAGE_COUNT}" -eq 0 ]; then
    echo "ERROR: No packages found in packages/QModem directory"
    exit 1
fi

#!/bin/bash
# Script: cleanup.sh
# Purpose: Clean up temporary files and folders

echo "Cleaning up temporary files..."

# Remove temporary QModem clone
if [ -d "${TEMP_DIR}" ]; then
    echo "  → Removing temporary directory: ${TEMP_DIR}"
    rm -rf "${TEMP_DIR}"
fi

# Remove changes detection file
if [ -f ".changes-detected" ]; then
    rm -f ".changes-detected"
fi

# Clean up any build artifacts
if [ -d ".git/objects/tmp_*" ]; then
    echo "  → Cleaning git tmp objects"
    rm -rf .git/objects/tmp_*
fi

echo "✓ Cleanup completed successfully"
echo ""
echo "Remaining workspace state:"
echo "=============================="
du -sh . 2>/dev/null | head -1 || echo "  (unable to calculate workspace size)"
echo ""
echo "Packages folder size:"
du -sh "${PACKAGES_DIR}" 2>/dev/null || echo "  (packages folder not found)"

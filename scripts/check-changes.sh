#!/bin/bash
# Script: check-changes.sh
# Purpose: Check if there are any changes in the packages folder

echo "Checking for changes in packages folder..."

if git diff --quiet "${PACKAGES_DIR}"; then
    echo "No changes detected in packages"
    echo "false" > .changes-detected
    exit 0
else
    echo "✓ Changes detected in packages"
    echo "true" > .changes-detected
    
    echo ""
    echo "Changed files:"
    git diff --name-status "${PACKAGES_DIR}" | head -20
    
    TOTAL_CHANGES=$(git diff --name-only "${PACKAGES_DIR}" | wc -l)
    echo ""
    echo "Total changed files: ${TOTAL_CHANGES}"
    exit 0
fi

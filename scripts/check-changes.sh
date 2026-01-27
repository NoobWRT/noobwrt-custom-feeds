#!/bin/bash
# Script: check-changes.sh
# Purpose: Check if there are any changes in the packages folder

echo "Checking for changes in packages folder..."

# Always ensure the file exists
echo "false" > .changes-detected

# Check if packages directory exists
if [ ! -d "packages" ]; then
    echo "Packages directory not found, nothing to check"
    exit 0
fi

# Check for git changes
if git diff --quiet packages/ 2>/dev/null; then
    echo "No changes detected in packages"
    echo "false" > .changes-detected
    exit 0
else
    echo "✓ Changes detected in packages"
    echo "true" > .changes-detected
    
    echo ""
    echo "Changed files:"
    git diff --name-status packages/ 2>/dev/null | head -20 || true
    
    TOTAL_CHANGES=$(git diff --name-only packages/ 2>/dev/null | wc -l)
    echo ""
    echo "Total changed files: ${TOTAL_CHANGES}"
    exit 0
fi

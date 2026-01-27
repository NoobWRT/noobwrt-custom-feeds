#!/bin/bash
# Script: check-changes.sh
# Purpose: Check if there are any changes in the packages folder

echo "Checking for changes in packages/QModem folder..."
echo ""

# Always ensure the file exists
echo "false" > .changes-detected

# Check if packages/QModem directory exists
if [ ! -d "packages/QModem" ]; then
    echo "packages/QModem directory not found, nothing to check"
    exit 0
fi

echo "Packages/QModem folder contents:"
find packages/QModem -type f | wc -l
echo "files in packages/QModem folder"
echo ""

# Check for untracked files
echo "Checking for untracked files..."
UNTRACKED=$(git ls-files --others --exclude-standard packages/QModem | wc -l)
echo "Untracked files: ${UNTRACKED}"

# Check for git changes (modified files)
echo "Checking for modified files..."
if git diff --quiet packages/QModem 2>/dev/null; then
    MODIFIED=0
else
    MODIFIED=$(git diff --name-only packages/QModem 2>/dev/null | wc -l)
fi
echo "Modified files: ${MODIFIED}"

TOTAL_CHANGES=$((UNTRACKED + MODIFIED))
echo ""
echo "Total changes: ${TOTAL_CHANGES}"

# If there are any changes (new or modified), mark as detected
if [ "${TOTAL_CHANGES}" -gt 0 ]; then
    echo "✓ Changes detected in packages/QModem"
    echo "true" > .changes-detected
    
    if [ "${UNTRACKED}" -gt 0 ]; then
        echo ""
        echo "New files (first 20):"
        git ls-files --others --exclude-standard packages/QModem | head -20
    fi
    
    if [ "${MODIFIED}" -gt 0 ]; then
        echo ""
        echo "Modified files (first 20):"
        git diff --name-only packages/QModem 2>/dev/null | head -20 || true
    fi
else
    echo "No changes detected in packages/QModem"
    echo "false" > .changes-detected
fi

exit 0

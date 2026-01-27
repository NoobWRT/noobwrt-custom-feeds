#!/bin/bash
# Script: check-changes.sh
# Purpose: Check if there are any changes in the packages folder

echo "Checking for changes in packages/QModem and packages/internet_detector..."
echo ""

# Always ensure the file exists
echo "false" > .changes-detected

# Check if packages/QModem directory exists
if [ ! -d "packages/QModem" ] && [ ! -d "packages/internet_detector" ]; then
    echo "No target package directories found, nothing to check"
    exit 0
fi

COUNT_QM=0
COUNT_ID=0
if [ -d packages/QModem ]; then
    COUNT_QM=$(find packages/QModem -type f | wc -l)
fi
if [ -d packages/internet_detector ]; then
    COUNT_ID=$(find packages/internet_detector -type f | wc -l)
fi
echo "files in QModem: ${COUNT_QM}, internet_detector: ${COUNT_ID}"
echo ""

# Check for untracked files
echo "Checking for untracked files..."
UNTRACKED_QM=0
UNTRACKED_ID=0
if [ -d packages/QModem ]; then
    UNTRACKED_QM=$(git ls-files --others --exclude-standard packages/QModem | wc -l)
fi
if [ -d packages/internet_detector ]; then
    UNTRACKED_ID=$(git ls-files --others --exclude-standard packages/internet_detector | wc -l)
fi
UNTRACKED=$((UNTRACKED_QM + UNTRACKED_ID))
echo "Untracked files: ${UNTRACKED}"

# Check for git changes (modified files)
echo "Checking for modified files..."
MODIFIED_QM=0
MODIFIED_ID=0
if [ -d packages/QModem ] && git diff --quiet packages/QModem 2>/dev/null; then
    MODIFIED=0
else
    if [ -d packages/QModem ]; then
      MODIFIED_QM=$(git diff --name-only packages/QModem 2>/dev/null | wc -l)
    fi
fi
if [ -d packages/internet_detector ] && git diff --quiet packages/internet_detector 2>/dev/null; then
    :
else
    if [ -d packages/internet_detector ]; then
      MODIFIED_ID=$(git diff --name-only packages/internet_detector 2>/dev/null | wc -l)
    fi
fi
MODIFIED=$((MODIFIED_QM + MODIFIED_ID))
echo "Modified files: ${MODIFIED}"

TOTAL_CHANGES=$((UNTRACKED + MODIFIED))
echo ""
echo "Total changes: ${TOTAL_CHANGES}"

# If there are any changes (new or modified), mark as detected
if [ "${TOTAL_CHANGES}" -gt 0 ]; then
    echo "✓ Changes detected in packages/QModem"
    echo "true" > .changes-detected
    
    if [ "${UNTRACKED_QM}" -gt 0 ]; then
        echo "New files in QModem (first 20):"
        git ls-files --others --exclude-standard packages/QModem | head -20
    fi
    if [ "${UNTRACKED_ID}" -gt 0 ]; then
        echo "New files in internet_detector (first 20):"
        git ls-files --others --exclude-standard packages/internet_detector | head -20
    fi
    if [ "${MODIFIED_QM}" -gt 0 ]; then
        echo "Modified files in QModem (first 20):"
        git diff --name-only packages/QModem 2>/dev/null | head -20 || true
    fi
    if [ "${MODIFIED_ID}" -gt 0 ]; then
        echo "Modified files in internet_detector (first 20):"
        git diff --name-only packages/internet_detector 2>/dev/null | head -20 || true
    fi
else
    echo "No changes detected in packages/QModem"
    echo "false" > .changes-detected
fi

exit 0

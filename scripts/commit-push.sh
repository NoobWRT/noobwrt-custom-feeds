#!/bin/bash
# Script: commit-push.sh
# Purpose: Commit and push changes to the repository

set -e

echo "Preparing to commit and push changes..."

# Stage all changes in packages folder
echo "Staging packages folder..."
git add -A "${PACKAGES_DIR}"

echo ""
echo "Git Status:"
git status

echo ""
echo "Checking staged files..."
STAGED_FILES=$(git diff --cached --name-only | wc -l)
echo "Staged files: ${STAGED_FILES}"

if [ "${STAGED_FILES}" -eq 0 ]; then
    echo "No files staged for commit"
    exit 0
fi

# Show what will be committed
echo ""
echo "Files to be committed:"
git diff --cached --name-only | head -20

if [ "$(git diff --cached --name-only | wc -l)" -gt 20 ]; then
    echo "... and more (showing first 20)"
fi

# Commit changes
echo ""
echo "Committing changes..."
git commit -m "chore: sync QModem packages from upstream repository"

# Get commit details
COMMIT_HASH=$(git rev-parse --short HEAD)
COMMIT_MSG=$(git log -1 --pretty=%B)
echo "✓ Committed: ${COMMIT_HASH}"
echo "  Message: ${COMMIT_MSG}"

# Push changes
echo ""
echo "Pushing changes to repository..."
git push origin HEAD:main

echo "✓ Changes pushed successfully"

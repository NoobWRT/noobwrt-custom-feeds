#!/bin/bash
# Script: commit-push.sh
# Purpose: Commit and push changes to the repository

echo "Preparing to commit and push changes..."
echo ""

# Add git config
git config user.name "${GIT_AUTHOR_NAME}"
git config user.email "${GIT_AUTHOR_EMAIL}"

# Stage all changes in packages folder
echo "Staging packages folder..."
git add -A packages/

echo ""
echo "Git Status:"
git status

echo ""
echo "Checking staged files..."
STAGED_FILES=$(git diff --cached --name-only 2>/dev/null | wc -l)
echo "Staged files: ${STAGED_FILES}"

if [ "${STAGED_FILES}" -eq 0 ]; then
    echo "No changes to commit"
    exit 0
fi

# Show what will be committed
echo ""
echo "Files to be committed:"
git diff --cached --name-only | head -20

TOTAL=$(git diff --cached --name-only | wc -l)
if [ "${TOTAL}" -gt 20 ]; then
    echo "... and $((TOTAL - 20)) more files"
fi

# Commit changes
echo ""
echo "Committing changes..."
if ! git commit -m "chore: sync QModem packages from upstream repository"; then
    echo "ERROR: Failed to commit changes"
    exit 1
fi

# Get commit details
COMMIT_HASH=$(git rev-parse --short HEAD)
COMMIT_MSG=$(git log -1 --pretty=%B)
echo "✓ Committed: ${COMMIT_HASH}"
echo "  Message: ${COMMIT_MSG}"

# Push changes
echo ""
echo "Pushing changes to repository..."
if ! git push origin HEAD:main 2>&1; then
    echo "ERROR: Failed to push changes"
    exit 1
fi

echo "✓ Changes pushed successfully to origin/main"

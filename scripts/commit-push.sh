#!/bin/bash
# Script: commit-push.sh
# Purpose: Commit and push changes to the repository

echo "Preparing to commit and push changes..."
echo ""

# Add git config
git config user.name "${GIT_AUTHOR_NAME}"
git config user.email "${GIT_AUTHOR_EMAIL}"
git config core.safecrlf false
git config core.autocrlf false

echo "Current branch:"
git branch -vv

echo ""
echo "Git remote:"
git remote -v

echo ""
echo "Current working directory:"
pwd

echo ""
echo "Packages folder contents:"
ls -la packages/ | head -20

echo ""
echo "Staging ALL packages folder..."
# Force add all files in packages, including new ones
git add packages/

echo ""
echo "Git Status:"
git status packages/

echo ""
echo "Checking staged files..."
STAGED_FILES=$(git diff --cached --name-only 2>/dev/null | wc -l)
echo "Total staged files: ${STAGED_FILES}"

if [ "${STAGED_FILES}" -eq 0 ]; then
    echo ""
    echo "⚠️  No changes detected in packages folder"
    echo "This could mean:"
    echo "  1. Packages are already committed"
    echo "  2. No new packages were synced"
    echo "  3. Files exist but haven't changed"
    exit 0
fi

# Show what will be committed
echo ""
echo "Files to be committed (showing first 30):"
git diff --cached --name-only | head -30

TOTAL=$(git diff --cached --name-only | wc -l)
if [ "${TOTAL}" -gt 30 ]; then
    echo "... and $((TOTAL - 30)) more files"
    echo ""
    echo "Total files being committed: ${TOTAL}"
fi

# Commit changes
echo ""
echo "Committing ${TOTAL} files..."
if ! git commit -m "chore: sync QModem packages from upstream repository

- Synced packages from QModem luci folder
- Total files: ${TOTAL}
- Timestamp: $(date)"; then
    echo "ERROR: Failed to create commit"
    git status
    exit 1
fi

# Get commit details
COMMIT_HASH=$(git rev-parse --short HEAD)
COMMIT_FULL=$(git rev-parse HEAD)
echo "✓ Committed: ${COMMIT_HASH}"

# Verify commit
echo ""
echo "Verifying commit..."
git log --oneline -1

# Push changes with verbose output
echo ""
echo "Pushing changes to origin/main..."
echo "Remote URL: $(git config --get remote.origin.url)"

if ! git push -u origin main -v 2>&1; then
    echo ""
    echo "❌ Push failed. Checking status..."
    git status
    echo ""
    echo "Checking remote:"
    git remote -v
    exit 1
fi

echo ""
echo "✓ Changes pushed successfully!"
echo "Commit: ${COMMIT_HASH}"
echo "Branch: main"

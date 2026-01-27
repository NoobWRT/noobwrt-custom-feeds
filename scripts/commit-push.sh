#!/bin/bash
# Script: commit-push.sh
# Purpose: Commit and push changes to the repository

echo "Preparing to commit and push changes..."
echo ""

# Add git config
git config user.name "Jenkins CI Bot"
git config user.email "jenkins@noreply.github.com"
git config core.safecrlf false
git config core.autocrlf false

echo "Current git state:"
git log --oneline -1
echo ""

# Check if in detached HEAD state
if ! git symbolic-ref -q HEAD; then
    echo "⚠️  In detached HEAD state, attempting to checkout main branch..."
    git checkout -B main || {
        echo "ERROR: Failed to checkout main branch"
        exit 1
    }
fi

echo "Current branch:"
git branch -vv

echo ""
echo "Git remote:"
git remote -v

echo ""
echo "Current working directory:"
pwd

echo ""
echo "Packages/QModem folder contents:"
ls -la packages/QModem/ | head -20

echo ""
echo "Staging ALL packages/QModem folder..."
# Force add all files in packages/QModem, including new ones
git add packages/QModem/

echo ""
echo "Git Status:"
git status

echo ""
echo "Checking staged files..."
STAGED_FILES=$(git diff --cached --name-only 2>/dev/null | wc -l)
echo "Total staged files: ${STAGED_FILES}"

if [ "${STAGED_FILES}" -eq 0 ]; then
    echo ""
    echo "⚠️  No changes detected in packages folder"
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
echo "✓ Committed: ${COMMIT_HASH}"

# Verify commit
echo ""
echo "Verifying commit..."
git log --oneline -1

# Ensure we're on main branch before pushing
CURRENT_BRANCH=$(git branch --show-current)
echo ""
echo "Current branch: ${CURRENT_BRANCH}"

if [ "${CURRENT_BRANCH}" != "main" ]; then
    echo "⚠️  Not on main branch, switching..."
    git checkout main || {
        echo "ERROR: Failed to checkout main"
        exit 1
    }
fi

# Push changes
echo ""
echo "Pushing changes to origin/main..."
echo "Remote URL: $(git config --get remote.origin.url | sed 's/https:\/\/.*@/https:\/\/[TOKEN]@/')"

if ! git push origin main 2>&1; then
    echo ""
    echo "❌ Push failed. Debugging..."
    echo "Git status:"
    git status
    echo ""
    echo "Git branch:"
    git branch -a
    echo ""
    echo "Trying force push..."
    if git push -f origin main 2>&1; then
        echo "✓ Force push succeeded"
    else
        echo "ERROR: Even force push failed"
        exit 1
    fi
fi

echo ""
echo "✓ Changes pushed successfully!"
echo "Commit: ${COMMIT_HASH}"
echo "Branch: main"

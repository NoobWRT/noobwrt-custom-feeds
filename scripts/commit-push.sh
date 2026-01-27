#!/bin/bash
# Script: commit-push.sh
# Purpose: Commit and push changes to the repository (scans packages/, feeds/, etc.)

set -euo pipefail

# Scan for all potential package directories
SCAN_DIRS=("packages" "feeds" "modules")

echo "Preparing to commit and push changes..."
echo ""

# Add git config
git config user.name "Jenkins CI Bot"
git config user.email "jenkins@noreply.github.com"
git config core.safecrlf false
git config core.autocrlf false

echo "Current git state:"
git log --oneline -1 || true
echo ""

# Check if in detached HEAD state
if ! git symbolic-ref -q HEAD; then
    echo "In detached HEAD state, attempting to checkout main branch..."
    git checkout -B main || {
        echo "ERROR: Failed to checkout main branch"
        exit 1
    }
fi

echo "Current branch:"
git branch -vv || true

echo ""
echo "Git remote:"
git remote -v || true

echo ""
echo "Current working directory:"
pwd

echo ""
echo "Staging all package directories..."
# Force add all files in discovered directories
for dir in "${SCAN_DIRS[@]}"; do
    if [ -d "${dir}" ]; then
        echo "Staging ${dir}/..."
        git add "${dir}/" 2>/dev/null || true
    fi
done

echo ""
echo "Git Status:"
git status

echo ""
echo "Checking staged files..."
STAGED_FILES=$(git diff --cached --name-only 2>/dev/null | wc -l)
echo "Total staged files: ${STAGED_FILES}"

if [ "${STAGED_FILES}" -eq 0 ]; then
    echo "No changes detected in ${PACKAGES_DIR}"
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

# Determine changed package names from all scanned directories
CHANGED_PACKAGES=$(git diff --cached --name-only | awk -F'/' '{if ($1=="packages" || $1=="feeds") print $1"/"$2}' | sort -u | tr '\n' ', ' | sed 's/, $//')

# Commit changes
echo ""
echo "Committing ${TOTAL} files..."
COMMIT_MSG="chore: sync packages from upstream repositories

- Packages: ${CHANGED_PACKAGES:-none}
- Total files: ${TOTAL}
- Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
if ! git commit -m "${COMMIT_MSG}"; then
    echo "ERROR: Failed to create commit"
    git status
    exit 1
fi

# Get commit details
COMMIT_HASH=$(git rev-parse --short HEAD)
echo "Committed: ${COMMIT_HASH}"

# Verify commit
echo ""
echo "Verifying commit..."
git log --oneline -1 || true

# Ensure we're on main branch before pushing
CURRENT_BRANCH=$(git branch --show-current)
echo ""
echo "Current branch: ${CURRENT_BRANCH}"

if [ "${CURRENT_BRANCH}" != "main" ]; then
    echo "Not on main branch, switching..."
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
    echo "Push failed. Debugging..."
    echo "Git status:"
    git status
    echo ""
    echo "Git branch:"
    git branch -a
    echo ""
    echo "Trying force push..."
    if git push -f origin main 2>&1; then
        echo "Force push succeeded"
    else
        echo "ERROR: Even force push failed"
        exit 1
    fi
fi

echo ""
echo "Changes pushed successfully!"
echo "Commit: ${COMMIT_HASH}"
echo "Branch: main"

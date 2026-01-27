#!/bin/bash
# Script: commit-push.sh
# Purpose: Commit and push changes to the repository (auto-discovers destinations from sync scripts)

set -euo pipefail

SYNC_DIR="scripts/sync"

# Discover SYNC_DEST_DIR values from all sync wrapper scripts
discover_dest_dirs() {
    local scripts
    scripts=$(find "${SYNC_DIR}" -name "sync-*.sh" -type f ! -name "sync-repo.sh" 2>/dev/null || true)

    if [ -z "${scripts}" ]; then
        return 0
    fi

    # Extract SYNC_DEST_DIR assignments (quoted or unquoted)
    # shellcheck disable=SC2016
    printf '%s\n' "${scripts}" | while IFS= read -r script; do
        sed -n -E "s/^[[:space:]]*export[[:space:]]+SYNC_DEST_DIR[[:space:]]*=[[:space:]]*['\"]?([^'\"[:space:]]+)['\"]?.*/\1/p" "${script}" || true
    done
}

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
echo "Discovering destination directories from ${SYNC_DIR}/..."
mapfile -t RAW_DEST_DIRS < <(discover_dest_dirs | sed '/^$/d' || true)

# De-duplicate while preserving order
declare -A SEEN_DESTS=()
DEST_DIRS=()
for dest in "${RAW_DEST_DIRS[@]:-}"; do
    if [ -n "${dest}" ] && [ -z "${SEEN_DESTS[${dest}]:-}" ]; then
        SEEN_DESTS["${dest}"]=1
        DEST_DIRS+=("${dest}")
    fi
done

if [ ${#DEST_DIRS[@]} -eq 0 ]; then
    echo "No SYNC_DEST_DIR values discovered under ${SYNC_DIR}/"
    echo "Nothing to stage."
    exit 0
fi

echo "Discovered destinations:"
printf '  - %s\n' "${DEST_DIRS[@]}"

echo ""
echo "Staging all discovered destination directories..."
STAGED_ANY=false
for dest in "${DEST_DIRS[@]}"; do
    if [ -d "${dest}" ]; then
        echo "Staging ${dest}/..."
        git add "${dest}/" 2>/dev/null || true
        STAGED_ANY=true
    else
        echo "Skipping missing directory: ${dest}"
    fi
done

echo ""
echo "Git Status:"
git status

echo ""
echo "Checking staged files..."
STAGED_FILES=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')
echo "Total staged files: ${STAGED_FILES}"

if [ "${STAGED_FILES}" -eq 0 ]; then
    echo "No changes detected in discovered destinations"
    exit 0
fi

# Show what will be committed
echo ""
echo "Files to be committed (showing first 30):"
# Avoid SIGPIPE (141) under pipefail when head exits early
git diff --cached --name-only | head -30 || true

TOTAL=$(git diff --cached --name-only | wc -l | tr -d ' ')
if [ "${TOTAL}" -gt 30 ]; then
    echo "... and $((TOTAL - 30)) more files"
    echo ""
    echo "Total files being committed: ${TOTAL}"
fi

# Determine which discovered destinations have staged changes
CHANGED_DESTS=()
for dest in "${DEST_DIRS[@]}"; do
    if git diff --cached --name-only -- "${dest}" 2>/dev/null | grep -q .; then
        CHANGED_DESTS+=("${dest}")
    fi
done

if [ ${#CHANGED_DESTS[@]} -gt 0 ]; then
    CHANGED_DESTS_STR=$(printf '%s, ' "${CHANGED_DESTS[@]}" | sed 's/, $//')
else
    CHANGED_DESTS_STR="none"
fi

# Commit changes
echo ""
echo "Committing ${TOTAL} files..."
COMMIT_MSG="chore: sync packages from upstream repositories

- Destinations: ${CHANGED_DESTS_STR}
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

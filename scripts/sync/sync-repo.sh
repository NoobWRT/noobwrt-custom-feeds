#!/bin/bash
# Script: sync-repo.sh
# Purpose: Generic repository sync script driven by environment variables
# Required environment variables:
#   SYNC_REPO_URL - Git repository URL to clone from
#   SYNC_REMOTE_PATH - Path within repo to sync (e.g., "luci" or ".")
#   SYNC_DEST_DIR - Destination directory under packages/
#   SYNC_COPY_SUBDIRS - Copy subdirectories (true/false), default: false
#   SYNC_CLEAN_DEST - Clean destination before sync (true/false), default: false
#   SYNC_TEMP_DIR - Temporary directory for clone, default: ./temp_sync

set -euo pipefail

# Validate required environment variables
if [ -z "${SYNC_REPO_URL:-}" ]; then
    echo "ERROR: SYNC_REPO_URL is not set"
    exit 1
fi

if [ -z "${SYNC_DEST_DIR:-}" ]; then
    echo "ERROR: SYNC_DEST_DIR is not set"
    exit 1
fi

# Set defaults
SYNC_REMOTE_PATH="${SYNC_REMOTE_PATH:-.}"
SYNC_COPY_SUBDIRS="${SYNC_COPY_SUBDIRS:-false}"
SYNC_CLEAN_DEST="${SYNC_CLEAN_DEST:-false}"
SYNC_TEMP_DIR="${SYNC_TEMP_DIR:-./temp_sync}"

# Normalize paths:
# - Allow SYNC_REMOTE_PATH values like "/luci-app-foo" by stripping the leading slash
# - Ensure destination parent directories exist even if they are new
SYNC_REMOTE_PATH="${SYNC_REMOTE_PATH#/}"
DEST_PARENT_DIR="$(dirname "${SYNC_DEST_DIR}")"

echo "Syncing from: ${SYNC_REPO_URL}"
echo "Remote path: ${SYNC_REMOTE_PATH}"
echo "Destination: ${SYNC_DEST_DIR}"
echo "Copy subdirs: ${SYNC_COPY_SUBDIRS}"
echo "Clean dest: ${SYNC_CLEAN_DEST}"
echo ""

# Create temp directory
if [ -d "${SYNC_TEMP_DIR}" ]; then
    echo "Removing existing temp directory: ${SYNC_TEMP_DIR}"
    rm -rf "${SYNC_TEMP_DIR}"
fi

mkdir -p "${SYNC_TEMP_DIR}"

# Clone repository
echo "Cloning repository..."
if ! git clone --depth 1 "${SYNC_REPO_URL}" "${SYNC_TEMP_DIR}"; then
    echo "ERROR: Failed to clone repository"
    rm -rf "${SYNC_TEMP_DIR}"
    exit 1
fi

echo "Repository cloned successfully"
echo ""

# Source path is the cloned repo + remote path
SOURCE_PATH="${SYNC_TEMP_DIR}/${SYNC_REMOTE_PATH}"

if [ ! -d "${SOURCE_PATH}" ]; then
    echo "ERROR: Source path does not exist: ${SOURCE_PATH}"
    rm -rf "${SYNC_TEMP_DIR}"
    exit 1
fi

# Create destination directory (and its parents) if it doesn't exist
mkdir -p "${DEST_PARENT_DIR}"
mkdir -p "${SYNC_DEST_DIR}"

# Clean destination if requested
if [ "${SYNC_CLEAN_DEST}" = "true" ]; then
    echo "Cleaning destination: ${SYNC_DEST_DIR}"
    # Use nullglob so an empty directory does not pass a literal '*' to rm
    shopt -s nullglob dotglob
    rm -rf "${SYNC_DEST_DIR:?}"/* || true
    shopt -u nullglob dotglob
fi

# Copy files based on SYNC_COPY_SUBDIRS
if [ "${SYNC_COPY_SUBDIRS}" = "true" ]; then
    echo "Copying subdirectories from ${SOURCE_PATH}..."
    
    # Copy only top-level subdirectories
    for subdir in "${SOURCE_PATH}"/*/; do
        if [ -d "${subdir}" ]; then
            subdir_name=$(basename "${subdir}")
            echo "  → Copying ${subdir_name}/"
            cp -r "${subdir}" "${SYNC_DEST_DIR}/"
        fi
    done
    
    # Also copy top-level files if any
    for file in "${SOURCE_PATH}"/*; do
        if [ -f "${file}" ]; then
            file_name=$(basename "${file}")
            echo "  → Copying ${file_name}"
            cp "${file}" "${SYNC_DEST_DIR}/"
        fi
    done
else
    echo "Copying entire path from ${SOURCE_PATH}..."
    shopt -s nullglob dotglob
    cp -r "${SOURCE_PATH}"/* "${SYNC_DEST_DIR}/" 2>/dev/null || true
    shopt -u nullglob dotglob
fi

# Remove .git directories to avoid nested repos
find "${SYNC_DEST_DIR}" -type d -name ".git" -exec rm -rf {} + 2>/dev/null || true

# Cleanup temp directory
echo "Cleaning up temporary directory..."
rm -rf "${SYNC_TEMP_DIR}"

echo ""
echo "Sync completed successfully!"
echo "Destination: ${SYNC_DEST_DIR}"
ls -la "${SYNC_DEST_DIR}" | head -10 || true

exit 0

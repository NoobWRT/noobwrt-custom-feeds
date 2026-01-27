#!/bin/bash
# Generic repo sync script using environment variables
# Env params:
#   SYNC_REPO_URL       (required)  - Git repo URL to clone
#   SYNC_REMOTE_PATH    (optional)  - Path inside repo to copy (default ".")
#   SYNC_DEST_DIR       (required)  - Destination folder in this workspace
#   SYNC_COPY_SUBDIRS   (optional)  - If "true", copy each subdirectory of remote path
#   SYNC_TEMP_DIR       (optional)  - Temporary clone directory (default derived)
#   SYNC_CLEAN_DEST     (optional)  - If "true", remove existing dest before copy

set -e

if [ -z "${SYNC_REPO_URL}" ] || [ -z "${SYNC_DEST_DIR}" ]; then
  echo "ERROR: SYNC_REPO_URL and SYNC_DEST_DIR must be set"
  exit 1
fi

SYNC_REMOTE_PATH=${SYNC_REMOTE_PATH:-.}
SYNC_COPY_SUBDIRS=${SYNC_COPY_SUBDIRS:-false}

# Derive temp dir name if not provided
if [ -z "${SYNC_TEMP_DIR}" ]; then
  base=$(basename "${SYNC_REPO_URL}" .git)
  SYNC_TEMP_DIR="temp_${base}"
fi

# Prepare destination
if [ "${SYNC_CLEAN_DEST}" = "true" ]; then
  rm -rf "${SYNC_DEST_DIR}"
fi
mkdir -p "${SYNC_DEST_DIR}"

# Clone
rm -rf "${SYNC_TEMP_DIR}"
echo "Cloning ${SYNC_REPO_URL} -> ${SYNC_TEMP_DIR}"
if ! git clone "${SYNC_REPO_URL}" "${SYNC_TEMP_DIR}" 2>&1; then
  echo "ERROR: Failed to clone ${SYNC_REPO_URL}"
  exit 1
fi

SOURCE_PATH="${SYNC_TEMP_DIR}/${SYNC_REMOTE_PATH}"
if [ ! -d "${SOURCE_PATH}" ]; then
  echo "ERROR: Remote path ${SYNC_REMOTE_PATH} not found in repo"
  ls -la "${SYNC_TEMP_DIR}" || true
  exit 1
fi

echo "Copying from ${SOURCE_PATH} to ${SYNC_DEST_DIR}"

if [ "${SYNC_COPY_SUBDIRS}" = "true" ]; then
  # Copy each subdirectory separately
  find "${SOURCE_PATH}" -maxdepth 1 -mindepth 1 -type d | sort | while read dir; do
    name=$(basename "$dir")
    echo "Syncing subdir: ${name}"
    rm -rf "${SYNC_DEST_DIR}/${name}"
    mkdir -p "${SYNC_DEST_DIR}/${name}"
    if ! cp -r "$dir"/* "${SYNC_DEST_DIR}/${name}/" 2>/dev/null; then
      cp -r "$dir" "${SYNC_DEST_DIR}/${name}" 2>/dev/null || true
    fi
  done
  # Also copy root-level files under the remote path
  find "${SOURCE_PATH}" -maxdepth 1 -type f -exec cp {} "${SYNC_DEST_DIR}/" \; 2>/dev/null || true
else
  # Copy whole path contents
  if ! cp -r "${SOURCE_PATH}"/* "${SYNC_DEST_DIR}/" 2>/dev/null; then
    cp -r "${SOURCE_PATH}" "${SYNC_DEST_DIR}" 2>/dev/null || true
  fi
fi

# Remove nested git metadata if present
rm -rf "${SYNC_DEST_DIR}/.git"

# Cleanup
rm -rf "${SYNC_TEMP_DIR}"

# Summary
FILES=$(find "${SYNC_DEST_DIR}" -type f | wc -l)
DIRS=$(find "${SYNC_DEST_DIR}" -type d | wc -l)
echo "Sync complete. Dest: ${SYNC_DEST_DIR} (files: ${FILES}, dirs: ${DIRS})"

#!/bin/bash
# Script: clone-sync-packages.sh
# Purpose: Clone the upstream QModem repository and sync packages from luci folder

set -e

echo "Creating packages directory..."
mkdir -p "${PACKAGES_DIR}"

echo "Cloning QModem repository from: ${REPO_URL}"

# Remove temp directory if it exists
rm -rf "${TEMP_DIR}"

# Clone the repository
git clone "${REPO_URL}" "${TEMP_DIR}"

# Check if luci folder exists
if [ ! -d "${TEMP_DIR}/luci" ]; then
    echo "ERROR: luci folder not found in QModem repository"
    echo "Available folders:"
    ls -la "${TEMP_DIR}/"
    exit 1
fi

echo "✓ QModem repository cloned successfully"
echo "Syncing packages from luci folder..."

# Copy all subdirectories from luci folder to packages
SYNC_COUNT=0
for dir in "${TEMP_DIR}"/luci/*/; do
    if [ -d "$dir" ]; then
        dir_name=$(basename "$dir")
        echo "  → Syncing package: ${dir_name}"
        mkdir -p "${PACKAGES_DIR}/${dir_name}"
        
        # Copy contents with proper handling
        if cp -r "$dir"* "${PACKAGES_DIR}/${dir_name}/" 2>/dev/null; then
            ((SYNC_COUNT++))
        else
            cp -r "$dir" "${PACKAGES_DIR}/" 2>/dev/null || true
            ((SYNC_COUNT++))
        fi
    fi
done

# Copy any files directly in luci folder
if [ -n "$(find "${TEMP_DIR}/luci" -maxdepth 1 -type f)" ]; then
    echo "  → Syncing root level files from luci folder..."
    cp "${TEMP_DIR}"/luci/*.* "${PACKAGES_DIR}/" 2>/dev/null || true
fi

echo "✓ Synced ${SYNC_COUNT} packages from luci folder"
echo ""
echo "Packages folder contents:"
ls -la "${PACKAGES_DIR}/" | head -30

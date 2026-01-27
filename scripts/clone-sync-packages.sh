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
if ! git clone "${REPO_URL}" "${TEMP_DIR}"; then
    echo "ERROR: Failed to clone repository"
    exit 1
fi

# Check if luci folder exists
if [ ! -d "${TEMP_DIR}/luci" ]; then
    echo "ERROR: luci folder not found in QModem repository"
    echo "Available folders:"
    ls -la "${TEMP_DIR}/"
    exit 1
fi

echo "✓ QModem repository cloned successfully"
echo "Syncing packages from luci folder..."
echo ""

# Copy all subdirectories from luci folder to packages
SYNC_COUNT=0
for dir in "${TEMP_DIR}"/luci/*/; do
    if [ -d "$dir" ]; then
        dir_name=$(basename "$dir")
        echo "  → Syncing package: ${dir_name}"
        
        # Remove existing directory to avoid conflicts
        if [ -d "${PACKAGES_DIR}/${dir_name}" ]; then
            echo "      Removing existing directory..."
            rm -rf "${PACKAGES_DIR}/${dir_name}"
        fi
        
        # Copy entire directory to packages
        if cp -r "$dir" "${PACKAGES_DIR}/${dir_name}"; then
            echo "      ✓ Successfully synced: ${dir_name}"
            ((SYNC_COUNT++))
        else
            echo "      ✗ Failed to sync: ${dir_name}"
            echo "      Attempting alternative copy method..."
            mkdir -p "${PACKAGES_DIR}/${dir_name}"
            if cp -r "${dir}"* "${PACKAGES_DIR}/${dir_name}/" 2>/dev/null; then
                echo "      ✓ Alternative copy succeeded"
                ((SYNC_COUNT++))
            else
                echo "      ⚠ Warning: Could not sync ${dir_name}, continuing..."
            fi
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

# If no packages were synced, exit with error
if [ "${SYNC_COUNT}" -eq 0 ]; then
    echo ""
    echo "ERROR: No packages were synced"
    exit 1
fi

echo ""
echo "✓ Package synchronization completed successfully"

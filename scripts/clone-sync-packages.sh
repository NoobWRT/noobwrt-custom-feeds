#!/bin/bash
# Script: clone-sync-packages.sh
# Purpose: Clone the upstream QModem repository and sync packages from luci folder

echo "Creating packages directory..."
mkdir -p "${PACKAGES_DIR}"

echo "Cloning QModem repository from: ${REPO_URL}"

# Remove temp directory if it exists
rm -rf "${TEMP_DIR}"

# Clone the repository
if ! git clone "${REPO_URL}" "${TEMP_DIR}" 2>&1; then
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
echo ""
echo "Listing luci folder contents:"
find "${TEMP_DIR}/luci" -maxdepth 1 -type d | sort
echo ""
echo "Syncing packages from luci folder..."
echo ""

# Copy all subdirectories from luci folder to packages
SYNC_COUNT=0
FAILED_PACKAGES=""

find "${TEMP_DIR}/luci" -maxdepth 1 -mindepth 1 -type d | sort | while read dir; do
    dir_name=$(basename "$dir")
    echo "  → Syncing package: ${dir_name}"
    
    # Remove existing directory to avoid conflicts
    if [ -d "${PACKAGES_DIR}/${dir_name}" ]; then
        echo "      Removing existing directory..."
        rm -rf "${PACKAGES_DIR}/${dir_name}" || {
            echo "      ✗ Failed to remove existing directory"
            continue
        }
    fi
    
    # Copy entire directory to packages
    if cp -r "$dir" "${PACKAGES_DIR}/${dir_name}" 2>/dev/null; then
        echo "      ✓ Successfully synced: ${dir_name}"
        SYNC_COUNT=$((SYNC_COUNT + 1))
    else
        echo "      ✗ Direct copy failed, trying alternative method..."
        mkdir -p "${PACKAGES_DIR}/${dir_name}"
        if cp -r "${dir}"/* "${PACKAGES_DIR}/${dir_name}/" 2>/dev/null; then
            echo "      ✓ Alternative copy succeeded"
            SYNC_COUNT=$((SYNC_COUNT + 1))
        else
            echo "      ⚠ Warning: Could not sync ${dir_name}"
        fi
    fi
done

# Copy any files directly in luci folder
if [ -n "$(find "${TEMP_DIR}/luci" -maxdepth 1 -type f 2>/dev/null)" ]; then
    echo ""
    echo "  → Syncing root level files from luci folder..."
    find "${TEMP_DIR}/luci" -maxdepth 1 -type f -exec cp {} "${PACKAGES_DIR}/" \; 2>/dev/null || true
fi

echo ""
echo "Packages folder contents:"
ls -la "${PACKAGES_DIR}/" 2>/dev/null | head -40

# Verify packages were synced by checking folder contents
ACTUAL_COUNT=$(find "${PACKAGES_DIR}" -maxdepth 1 -mindepth 1 | wc -l)
echo ""
echo "✓ Synced ${ACTUAL_COUNT} items from luci folder"

# If no packages were synced, exit with error
if [ "${ACTUAL_COUNT}" -eq 0 ]; then
    echo ""
    echo "ERROR: No packages were synced"
    exit 1
fi

echo "✓ Package synchronization completed successfully"

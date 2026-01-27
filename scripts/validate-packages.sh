#!/bin/bash
# Script: validate-packages.sh
# Purpose: Validate that packages were synced correctly

echo "Validating packages in packages/QModem and packages/internet_detector..."

MISSING=0
if [ ! -d "${PACKAGES_DIR}/QModem" ]; then
    echo "WARNING: packages/QModem directory not found"
    MISSING=$((MISSING+1))
else
  if [ -z "$(ls -A "${PACKAGES_DIR}/QModem")" ]; then
      echo "WARNING: packages/QModem directory is empty"
  else
      echo "packages/QModem directory exists and contains files"
  fi
fi

if [ ! -d "${PACKAGES_DIR}/internet_detector" ]; then
    echo "WARNING: packages/internet_detector directory not found"
else
  if [ -z "$(ls -A "${PACKAGES_DIR}/internet_detector")" ]; then
      echo "WARNING: packages/internet_detector directory is empty"
  else
      echo "packages/internet_detector directory exists and contains files"
  fi
fi
echo ""
echo "Package summary:"
echo "=================="

PACKAGE_COUNT=0
for item in "${PACKAGES_DIR}/QModem"/*; do
    if [ -d "$item" ]; then
        PACKAGE_NAME=$(basename "$item")
        FILE_COUNT=$(find "$item" -type f 2>/dev/null | wc -l)
        DIR_COUNT=$(find "$item" -type d 2>/dev/null | wc -l)
        echo "Package ${PACKAGE_NAME}: ${FILE_COUNT} files, ${DIR_COUNT} directories"
        ((PACKAGE_COUNT++))
    elif [ -f "$item" ]; then
        PACKAGE_NAME=$(basename "$item")
        echo "File ${PACKAGE_NAME}"
        ((PACKAGE_COUNT++))
    fi
done

echo "=================="
echo "Total packages: ${PACKAGE_COUNT}"

if [ "${PACKAGE_COUNT}" -eq 0 ]; then
    echo "WARNING: No packages found in packages/QModem or internet_detector"
fi

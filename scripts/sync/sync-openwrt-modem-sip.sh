#!/bin/bash
# Wrapper to sync openwrt-modem-sip (modem-sip, luci-app-modem-sip) using the generic sync-repo.sh

set -e

export SYNC_REPO_URL="https://github.com/Perz3us/openwrt-modem-sip.git"
export SYNC_REMOTE_PATH="."
export SYNC_DEST_DIR="package/openwrt-modem-sip"
export SYNC_COPY_SUBDIRS=true
export SYNC_CLEAN_DEST=true

# Call the generic sync script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/sync-repo.sh"

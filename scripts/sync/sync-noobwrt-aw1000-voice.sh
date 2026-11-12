#!/bin/bash
# Wrapper to sync noobwrt-aw1000-voice (AW1000 phone stack: kmod-aw1000-fxs,
# fxsd, modem-sip, aw1000-voice-web, luci-app-aw1000-voice) using the generic
# sync-repo.sh. It replaces the separate openwrt-aw1000-phone and
# openwrt-modem-sip syncs and their luci-app-fxs / luci-app-modem-sip pages.

set -e

export SYNC_REPO_URL="https://github.com/nooblk-98/noobwrt-aw1000-voice.git"
export SYNC_REMOTE_PATH="."
export SYNC_DEST_DIR="package/noobwrt-aw1000-voice"
export SYNC_COPY_SUBDIRS=true
export SYNC_CLEAN_DEST=true

# Call the generic sync script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/sync-repo.sh"

#!/bin/bash
# Sync the auto-pci-cell package from its canonical PCI-Cell-Lock repository.
set -euo pipefail

export SYNC_REPO_URL="https://github.com/Perz3us/PCI-Cell-Lock.git"
export SYNC_REMOTE_PATH="."
export SYNC_DEST_DIR="package/auto-pci-cell"
export SYNC_COPY_SUBDIRS=true
export SYNC_CLEAN_DEST=true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/sync-repo.sh"

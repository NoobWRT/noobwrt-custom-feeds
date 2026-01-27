#!/bin/bash
# Script: configure-git.sh
# Purpose: Configure Git settings for safe operations

set -e

echo "Configuring Git settings..."

git config --global core.safecrlf false
git config --global core.autocrlf false
git config user.name "${GIT_AUTHOR_NAME}"
git config user.email "${GIT_AUTHOR_EMAIL}"

echo "✓ Git configured successfully"
git config --global --list | grep -E "core\.(safe)?crlf|autocrlf|user"

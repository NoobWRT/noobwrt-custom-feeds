# Scripts Directory

This directory contains modular shell scripts used by the Jenkins pipeline for syncing QModem packages.

## Scripts Overview

### 1. configure-git.sh
**Purpose**: Configure Git settings for safe operations

Configures:
- CRLF handling to prevent line ending issues
- Author name and email for commits
- Global Git settings

### 2. clone-sync-packages.sh
**Purpose**: Clone the upstream QModem repository and sync packages from the luci folder

Actions:
- Creates packages directory
- Clones QModem repository from GitHub
- Verifies luci folder exists
- Copies all packages from luci folder to local packages directory
- Displays sync summary

### 3. validate-packages.sh
**Purpose**: Validate that packages were synced correctly

Checks:
- Packages directory exists
- Packages directory is not empty
- Lists all synced packages with file/directory counts

### 4. check-changes.sh
**Purpose**: Detect changes in the packages folder

Outputs:
- Changes detected status (written to .changes-detected file)
- List of modified files
- Total change count

### 5. commit-push.sh
**Purpose**: Commit and push changes to the repository

Operations:
- Stages all changes in packages folder
- Creates a commit with descriptive message
- Pushes to main branch
- Displays commit hash and details

### 6. cleanup.sh
**Purpose**: Clean up temporary files and folders

Removes:
- Temporary QModem clone directory
- Changes detection marker file
- Git temporary objects
- Displays final workspace state

## Environment Variables

These variables are set by the Jenkinsfile and used by the scripts:

- `REPO_URL`: GitHub repository URL (QModem)
- `SCRIPTS_DIR`: Path to scripts directory
- `PACKAGES_DIR`: Path to packages directory
- `TEMP_DIR`: Path for temporary downloads
- `GIT_AUTHOR_NAME`: Author name for commits
- `GIT_AUTHOR_EMAIL`: Author email for commits

## Manual Execution

To run scripts manually:

```bash
# Configure git
bash scripts/configure-git.sh

# Clone and sync
bash scripts/clone-sync-packages.sh

# Validate
bash scripts/validate-packages.sh

# Check changes
bash scripts/check-changes.sh

# Commit and push
bash scripts/commit-push.sh

# Cleanup
bash scripts/cleanup.sh
```

## Jenkins Pipeline Integration

The Jenkinsfile orchestrates these scripts in the following order:

1. Checkout - Clones the repository
2. Configure Git - Sets up Git configuration
3. Clone & Sync - Downloads and syncs packages
4. Validate Packages - Verifies sync was successful
5. Check Changes - Detects modifications
6. Commit & Push - Commits and pushes (if changes detected)
7. Cleanup - Removes temporary files

## Error Handling

All scripts use `set -e` which causes them to exit immediately if any command fails. This prevents cascading errors in the pipeline.

## Logging

Scripts provide detailed console output with:
- Status indicators (✓, →, 📦, 📄, etc.)
- Stage descriptions
- File counts and directory summaries
- Error messages with context

#!/bin/bash
# Script: create-release.sh
# Purpose: Tag HEAD with the next auto-incremented version and publish a GitHub
#          release whose notes list every package and its current version
# Env:     GH_TOKEN            token with contents:write (required)
#          TAG_PREFIX          tag prefix (default: v)
#          INITIAL_VERSION     first version when no tag exists yet (default: 1.0.0)

set -euo pipefail

SCRIPTS_DIR="${SCRIPTS_DIR:-$(dirname "$0")}"
TAG_PREFIX="${TAG_PREFIX:-v}"
INITIAL_VERSION="${INITIAL_VERSION:-1.0.0}"

git fetch --tags --force --quiet origin || true

HEAD_SHA=$(git rev-parse HEAD)

# Skip if this commit is already released
EXISTING=$(git tag --points-at HEAD --list "${TAG_PREFIX}[0-9]*" | head -1)
if [ -n "${EXISTING}" ]; then
    echo "HEAD (${HEAD_SHA:0:7}) is already tagged as ${EXISTING}; skipping release."
    exit 0
fi

# Latest existing version tag, e.g. v1.0.7
PREV_TAG=$(git tag --list "${TAG_PREFIX}[0-9]*.[0-9]*.[0-9]*" --sort=-v:refname | head -1)

if [ -z "${PREV_TAG}" ]; then
    NEW_TAG="${TAG_PREFIX}${INITIAL_VERSION}"
else
    IFS=. read -r MAJOR MINOR PATCH <<< "${PREV_TAG#"${TAG_PREFIX}"}"
    NEW_TAG="${TAG_PREFIX}${MAJOR}.${MINOR}.$((PATCH + 1))"
fi

echo "Previous tag: ${PREV_TAG:-none}"
echo "New tag:      ${NEW_TAG} -> ${HEAD_SHA:0:7}"

NOTES_FILE=$(mktemp)
trap 'rm -f "${NOTES_FILE}"' EXIT

NEW_TAG="${NEW_TAG}" bash "${SCRIPTS_DIR}/generate-release-notes.sh" HEAD "${PREV_TAG}" > "${NOTES_FILE}"

echo ""
echo "Release notes preview:"
head -40 "${NOTES_FILE}"
echo ""

gh release create "${NEW_TAG}" \
    --target "${HEAD_SHA}" \
    --title "${NEW_TAG} · $(date -u +%Y-%m-%d)" \
    --notes-file "${NOTES_FILE}" \
    --latest

echo "Published release ${NEW_TAG}"

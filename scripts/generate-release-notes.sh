#!/bin/bash
# Script: generate-release-notes.sh
# Purpose: Build Markdown release notes listing every package and its current version,
#          plus what changed since the previous release
# Usage:   generate-release-notes.sh <ref> [previous-ref]
# Env:     NEW_TAG            tag being released (used for the compare link)
#          GITHUB_REPOSITORY  owner/repo (used for the compare link)

set -euo pipefail

REF="${1:?Usage: generate-release-notes.sh <ref> [previous-ref]}"
PREV_REF="${2:-}"
SCRIPTS_DIR="${SCRIPTS_DIR:-$(dirname "$0")}"

WORK_DIR=$(mktemp -d)
trap 'rm -rf "${WORK_DIR}"' EXIT

CURRENT="${WORK_DIR}/current.tsv"
PREVIOUS="${WORK_DIR}/previous.tsv"
CHANGED="${WORK_DIR}/changed.txt"

bash "${SCRIPTS_DIR}/list-packages.sh" "${REF}" > "${CURRENT}"
: > "${PREVIOUS}"
: > "${CHANGED}"
if [ -n "${PREV_REF}" ]; then
    bash "${SCRIPTS_DIR}/list-packages.sh" "${PREV_REF}" > "${PREVIOUS}"
    git diff --name-only "${PREV_REF}" "${REF}" -- package feeds > "${CHANGED}" || true
fi

PKG_COUNT=$(wc -l < "${CURRENT}" | tr -d ' ')
SRC_COUNT=$(cut -f1 "${CURRENT}" | sort -u | wc -l | tr -d ' ')
SHORT_SHA=$(git rev-parse --short "${REF}")
SYNC_DATE=$(TZ=UTC git log -1 --format=%cd --date=format-local:'%Y-%m-%d %H:%M' "${REF}")

echo "Automated package sync · ${SYNC_DATE} UTC · commit \`${SHORT_SHA}\`"
echo ""
echo "**${PKG_COUNT} packages** from **${SRC_COUNT} sources**"
echo ""

if [ -n "${PREV_REF}" ]; then
    # TSV columns: source, package, version, path (path is the join key)
    awk -F '\t' -v prev_ref="${PREV_REF}" '
        FILENAME == ARGV[1] { prev[$4] = $3; prev_line[$4] = $0; next }
        FILENAME == ARGV[2] { changed[++n_changed] = $0; next }
        {
            cur[$4] = 1
            if (!($4 in prev)) {
                added[++n_added] = sprintf("| `%s` | %s | %s |", $2, $1, $3)
            } else if (prev[$4] != $3) {
                updated[++n_updated] = sprintf("| `%s` | %s | %s | **%s** |", $2, $1, prev[$4], $3)
            } else {
                for (i = 1; i <= n_changed; i++) {
                    if (index(changed[i], $4 "/") == 1) {
                        touched[++n_touched] = sprintf("`%s`", $2)
                        break
                    }
                }
            }
        }
        END {
            for (p in prev_line) {
                if (!(p in cur)) {
                    split(prev_line[p], f, "\t")
                    removed[++n_removed] = sprintf("| `%s` | %s | %s |", f[2], f[1], f[3])
                }
            }

            if (n_updated + n_added + n_removed + n_touched == 0) {
                printf "No package changes since `%s`.\n\n", prev_ref
                exit
            }
            if (n_updated) {
                printf "### ⬆️ Updated (%d)\n\n| Package | Source | Previous | Current |\n|---|---|---|---|\n", n_updated
                for (i = 1; i <= n_updated; i++) print updated[i]
                print ""
            }
            if (n_added) {
                printf "### ✨ New (%d)\n\n| Package | Source | Version |\n|---|---|---|\n", n_added
                for (i = 1; i <= n_added; i++) print added[i]
                print ""
            }
            if (n_removed) {
                printf "### 🗑️ Removed (%d)\n\n| Package | Source | Last version |\n|---|---|---|\n", n_removed
                for (i = 1; i <= n_removed; i++) print removed[i]
                print ""
            }
            if (n_touched) {
                printf "### 🔄 Changed without a version bump (%d)\n\n", n_touched
                line = touched[1]
                for (i = 2; i <= n_touched; i++) line = line ", " touched[i]
                print line
                print ""
            }
        }
    ' "${PREVIOUS}" "${CHANGED}" "${CURRENT}"
    DETAILS_TAG="<details>"
else
    echo "First tagged release of the feed."
    echo ""
    DETAILS_TAG="<details open>"
fi

echo "${DETAILS_TAG}"
echo "<summary>📦 All packages (${PKG_COUNT})</summary>"
echo ""
echo "| Package | Version | Source |"
echo "|---|---|---|"
awk -F '\t' '{ printf "| `%s` | %s | %s |\n", $2, $3, $1 }' "${CURRENT}"
echo ""
echo "</details>"

if [ -n "${PREV_REF}" ] && [ -n "${NEW_TAG:-}" ] && [ -n "${GITHUB_REPOSITORY:-}" ]; then
    echo ""
    echo "**Full Changelog**: https://github.com/${GITHUB_REPOSITORY}/compare/${PREV_REF}...${NEW_TAG}"
fi

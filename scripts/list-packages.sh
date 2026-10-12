#!/bin/bash
# Script: list-packages.sh
# Purpose: Discover every OpenWrt package in the feed and print its name and version
# Usage:   list-packages.sh [git-ref]        (default: HEAD)
# Output:  TSV lines "<source>\t<package>\t<version>\t<path>", sorted by source then package
#
# Files are read from the given git ref (not the working tree), so the same
# script can describe any tag or commit, e.g. the previous release.

set -euo pipefail

REF="${1:-HEAD}"
ROOTS=(package feeds)

read_file() {
    git show "${REF}:$1" 2>/dev/null || true
}

# Collapse "a/b/../c/./d" into "a/c/d"
normalize_path() {
    local IFS=/ part
    local -a out=()
    for part in $1; do
        case "${part}" in
            ''|.) ;;
            ..) [ ${#out[@]} -gt 0 ] && unset 'out[${#out[@]}-1]' ;;
            *) out+=("${part}") ;;
        esac
    done
    printf '%s' "${out[*]}"
}

# Reads make assignments on stdin (includes first, then the Makefile) and
# prints "<name>\t<version>" with simple $(VAR) references expanded.
# shellcheck disable=SC2016
AWK_PROG='
function expand(s,    out, name, guard) {
    out = ""
    guard = 0
    while (match(s, /\$\([A-Za-z_][A-Za-z0-9_]*\)/) && guard++ < 50) {
        name = substr(s, RSTART + 2, RLENGTH - 3)
        if (name in vars) {
            s = substr(s, 1, RSTART - 1) vars[name] substr(s, RSTART + RLENGTH)
        } else {
            out = out substr(s, 1, RSTART + RLENGTH - 1)
            s = substr(s, RSTART + RLENGTH)
        }
    }
    return out s
}
function resolved(s) { return s != "" && s !~ /\$\(/ }

/^[[:space:]]*define[[:space:]]/ { indef = 1; next }
/^[[:space:]]*endef/             { indef = 0; next }
indef { next }

/^[[:space:]]*(override[[:space:]]+)?[A-Za-z_][A-Za-z0-9_]*[[:space:]]*[:?]?=/ {
    line = $0
    sub(/^[[:space:]]*(override[[:space:]]+)?/, "", line)
    name = line
    sub(/[[:space:]]*[:?]?=.*/, "", name)
    op = line
    sub(/^[A-Za-z0-9_]*[[:space:]]*/, "", op)
    val = line
    sub(/^[^=]*=[[:space:]]*/, "", val)
    sub(/[[:space:]]+$/, "", val)
    if (op ~ /^\?=/ && (name in vars)) next
    vars[name] = val
}

END {
    name = expand(vars["PKG_NAME"])
    if (!resolved(name)) name = dirbase

    ver = expand(vars["PKG_VERSION"])
    if (!resolved(ver)) ver = expand(vars["PKG_SOURCE_DATE"])
    if (!resolved(ver)) {
        ver = expand(vars["PKG_SOURCE_VERSION"])
        if (length(ver) >= 12 && ver ~ /^[0-9a-f]+$/) ver = substr(ver, 1, 7)
    }
    if (!resolved(ver)) ver = "-"

    rel = expand(vars["PKG_RELEASE"])
    if (ver != "-" && resolved(rel)) ver = ver "-" rel

    printf "%s\t%s\n", name, ver
}'

mapfile -t MAKEFILES < <(
    git ls-tree -r --name-only "${REF}" -- "${ROOTS[@]}" 2>/dev/null \
        | grep -E '/Makefile$' \
        | grep -v -E '/(src|tools|node_modules)/' \
        | sort || true
)

for makefile in "${MAKEFILES[@]}"; do
    content=$(read_file "${makefile}")

    # Only real package Makefiles (skip helper/build Makefiles)
    if ! grep -q -E 'include .*(package|luci)\.mk' <<< "${content}"; then
        continue
    fi

    dir=$(dirname "${makefile}")
    source=$(cut -d/ -f1-2 <<< "${dir}")

    # Pull in relative includes such as "include ../../version.mk"
    includes=""
    while IFS= read -r inc; do
        [ -n "${inc}" ] || continue
        includes+=$(read_file "$(normalize_path "${dir}/${inc}")")$'\n'
    done < <(sed -n -E 's/^[[:space:]]*-?include[[:space:]]+([^$[:space:]][^[:space:]]*).*/\1/p' <<< "${content}")

    printf '%s\n%s\n' "${includes}" "${content}" \
        | awk -v dirbase="$(basename "${dir}")" "${AWK_PROG}" \
        | while IFS=$'\t' read -r name version; do
            printf '%s\t%s\t%s\t%s\n' "${source}" "${name}" "${version}" "${dir}"
        done
done | LC_ALL=C sort -t $'\t' -k1,1 -k2,2f

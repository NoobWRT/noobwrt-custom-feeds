#!/bin/sh
set -e
cd "$(dirname "$0")"
export MSYS_NO_PATHCONV=1
SRC=$(pwd -W 2>/dev/null || pwd)

docker image inspect owrt-sdk-env >/dev/null 2>&1 || docker build -t owrt-sdk-env -f scripts/Dockerfile.sdk scripts
docker run --rm -v "$SRC:/work" -v owrt-sdk-cache:/cache owrt-sdk-env sh /work/scripts/build_pkgs.sh

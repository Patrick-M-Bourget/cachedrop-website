#!/bin/sh
set -eu
exec node "$(dirname "$0")/stage-release.ts" "$@"

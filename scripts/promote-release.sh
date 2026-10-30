#!/bin/sh
# Explicit promotion of an already staged release; uploads and builds nothing.
set -eu
exec node "$(dirname "$0")/promote-release.ts" "$@"

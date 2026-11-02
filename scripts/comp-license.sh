#!/bin/sh
# Owner-run: gives someone a free license (Decision 45). See scripts/comp-license.ts.
set -eu
exec node "$(dirname "$0")/comp-license.ts" "$@"

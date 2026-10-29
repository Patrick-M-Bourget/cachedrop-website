#!/bin/sh
# Publishes CacheDrop-x.y.z.dmg to the private releases bucket and marks it latest (Decision 15).
# Run it after mac-cleaner's release.sh:
#   scripts/publish-dmg.sh dev  path/to/CacheDrop-x.y.z.dmg   # reads .env.local
#   scripts/publish-dmg.sh prod path/to/CacheDrop-x.y.z.dmg   # reads SUPABASE_URL and SUPABASE_SECRET_KEY from the shell
set -eu
exec node "$(dirname "$0")/publish-dmg.ts" "$@"

#!/bin/sh
# Publishes a signed, verified release to production in one command: stages it, then promotes the website's latest
# release and the appcast, which ends by checking the served feed and DMG byte for byte (docs/RELEASING.md).
# Run only when the owner has said "publish" for this version (Decision 55).
#
# The production secret key is read from the login Keychain only while this runs, never printed and never written to
# a file. Store it once (the prompt doesn't echo):
#   security add-generic-password -U -s cachedrop.prod.supabase -a secret-key -w
set -eu

usage() { echo "usage: scripts/publish-release.sh ARTIFACT_DIRECTORY" >&2; exit 64; }
[ $# -eq 1 ] || usage
directory=$1
dmg=$(ls "$directory"/CacheDrop-*.dmg 2>/dev/null | head -n 1)
[ -n "$dmg" ] && [ -f "$directory/release-identity.json" ] && [ -f "$directory/appcast.xml" ] \
  || { echo "No CacheDrop-x.y.z.dmg, release-identity.json and appcast.xml in $directory." >&2; exit 1; }

key=$(security find-generic-password -s cachedrop.prod.supabase -a secret-key -w 2>/dev/null) \
  || { echo "No production key in the login Keychain. Store it once with:" >&2
       echo "  security add-generic-password -U -s cachedrop.prod.supabase -a secret-key -w" >&2; exit 1; }
SUPABASE_URL=https://dqpvfcthotskzfvdpjdm.supabase.co SUPABASE_SECRET_KEY=$key
export SUPABASE_URL SUPABASE_SECRET_KEY
unset key

here=$(dirname "$0")
# Each production command asks to type prod; this script is that confirmation.
echo prod | "$here/stage-release.sh" prod "$dmg" "$directory/release-identity.json"
echo prod | "$here/promote-release.sh" prod "$directory" https://cachedrop.io/updates/appcast.xml
echo "Published $(basename "$dmg"): https://cachedrop.io/updates/appcast.xml offers it."

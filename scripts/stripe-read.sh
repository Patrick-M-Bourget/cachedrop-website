#!/bin/bash
# Read-only Stripe lookups for the agent (#80): GET https://api.stripe.com/v1/<path> with a restricted,
# read-only key the owner keeps in ~/.config/cachedrop/stripe-readonly.key (docs/licensing.md). GET only.
#
#   scripts/stripe-read.sh 'events?type=checkout.session.completed&limit=3'
#   scripts/stripe-read.sh webhook_endpoints
#   scripts/stripe-read.sh 'payment_links?active=true'
set -euo pipefail
key_file="$HOME/.config/cachedrop/stripe-readonly.key"
path="${1:-}"
[[ "$path" =~ ^[a-z_]+(/[A-Za-z0-9_]+)*(\?[A-Za-z0-9_.=\&\[\]-]*)?$ ]] || { echo "usage: scripts/stripe-read.sh <api path>, e.g. 'events?limit=3'" >&2; exit 2; }
[[ -r "$key_file" ]] || { echo "No read-only Stripe key at $key_file (docs/licensing.md, Agent read access)." >&2; exit 2; }
key=$(<"$key_file")
[[ "$key" == rk_* ]] || { echo "$key_file must hold a restricted key (rk_…), never a secret key." >&2; exit 2; }
exec curl -sS --fail-with-body -G "https://api.stripe.com/v1/$path" -u "$key:"

#!/bin/bash
# The license Edge Function's recent logs for the agent (#80), read from the Supabase Management API with a
# token the owner keeps in ~/.config/cachedrop/supabase-logs.token (docs/licensing.md). Read only.
#
#   scripts/function-logs.sh dev        last 60 minutes
#   scripts/function-logs.sh prod 1440  last day
set -euo pipefail
token_file="$HOME/.config/cachedrop/supabase-logs.token"
case "${1:-}" in
  dev) ref=nyefnnwhnlyovpdmzxiw ;;
  prod) ref=dqpvfcthotskzfvdpjdm ;;
  *) echo "usage: scripts/function-logs.sh <dev|prod> [minutes]" >&2; exit 2 ;;
esac
minutes="${2:-60}"
[[ "$minutes" =~ ^[0-9]+$ && "$minutes" -ge 1 && "$minutes" -le 10080 ]] || { echo "minutes must be 1–10080" >&2; exit 2; }
[[ -r "$token_file" ]] || { echo "No Supabase token at $token_file (docs/licensing.md, Agent read access)." >&2; exit 2; }
start=$(date -u -v-"${minutes}"M +%Y-%m-%dT%H:%M:%SZ)
end=$(date -u +%Y-%m-%dT%H:%M:%SZ)
sql="select timestamp, event_message, metadata.level from function_logs cross join unnest(metadata) as metadata order by timestamp desc limit 200"
curl -sS --fail-with-body -G "https://api.supabase.com/v1/projects/$ref/analytics/endpoints/logs.all" \
  -H "Authorization: Bearer $(<"$token_file")" \
  --data-urlencode "sql=$sql" --data-urlencode "iso_timestamp_start=$start" --data-urlencode "iso_timestamp_end=$end" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s);if(r.error){console.error(JSON.stringify(r.error));process.exit(1)}for(const e of (r.result??[]).reverse())console.log(new Date(e.timestamp/1000).toISOString(),e.level??"",e.event_message.trim())})'

#!/bin/bash
# #48: fills a staged "demo" macOS account with about 12 GB of real, rebuildable-looking data that CacheDrop's
# catalog recommends, for the site demo and the Meta ads. See docs/demo-video.md for which rule each path hits.
#
# Every byte is written for real (dd/head from /dev/urandom), never sparse, never an APFS clone: CacheDrop's
# Results measure free space before and after each item, so clones would show almost nothing freed on camera.
#
# Usage:
#   scripts/demo/seed.sh [seed|reset|remove] [--dry-run] [--target DIR --i-know]
#     seed     write the plan (default). Refuses when anything it would write already exists.
#     reset    delete only what the last seed wrote (its manifest), plus its marked items in the Trash, then seed again.
#     remove   like reset, without seeding again.
#     --dry-run         print the plan, the total and the free-space verdict; write nothing.
#     --target DIR      seed DIR instead of $HOME (tests). Needs --i-know, and DIR may not be your real home or above it.
#
# Without --target it runs only as the user "demo", in that user's own home.
#
# Sizes (decimal GB, as CacheDrop shows them), all optional:
#   MUSIC_GB=4.5 DEV_GB=6 LEFTOVERS_GB=0.5 DOWNLOADS_GB=1   per audience group
#   SIZE_SCALE=1            multiplies everything (tests use 0.0001)
#   INCLUDE_HOMEBREW=1      0 leaves the Homebrew cache out (its cleanup runs `brew`, see the doc)
#   DELETED_APP_ID=com.driftwave.LoopSmith   the synthetic deleted app's bundle ID
#   FREE_HEADROOM_GB=5      free space that must remain after seeding
set -euo pipefail

MARKER_ATTR="io.cachedrop.demo-seed"
STATE_DIR_NAME=".cachedrop-demo-seed"

command="seed"; dry_run=0; target=""; i_know=0
while [ $# -gt 0 ]; do
  case "$1" in
    seed|reset|remove) command="$1" ;;
    --dry-run) dry_run=1 ;;
    --target) [ $# -ge 2 ] || { echo "--target needs a folder" >&2; exit 2; }; target="$2"; shift ;;
    --i-know) i_know=1 ;;
    -h|--help) sed -n '2,26p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $1 (see --help)" >&2; exit 2 ;;
  esac
  shift
done

SIZE_SCALE="${SIZE_SCALE:-1}"
MUSIC_GB="${MUSIC_GB:-4.5}"
DEV_GB="${DEV_GB:-6}"
LEFTOVERS_GB="${LEFTOVERS_GB:-0.5}"
DOWNLOADS_GB="${DOWNLOADS_GB:-1}"
INCLUDE_HOMEBREW="${INCLUDE_HOMEBREW:-1}"
DELETED_APP_ID="${DELETED_APP_ID:-com.driftwave.LoopSmith}"
FREE_HEADROOM_GB="${FREE_HEADROOM_GB:-5}"

die() { echo "seed.sh: $*" >&2; exit 1; }

[ "$(uname -s)" = "Darwin" ] || die "macOS only."

# --- Where, and whether we may ---------------------------------------------------------------------------
real_home="$(cd "$HOME" && pwd -P)"
me="$(id -un)"
if [ -z "$target" ]; then
  target="$HOME"
  [ "$me" = "demo" ] || [ "$dry_run" = 1 ] || die "refusing: run this as the macOS user \"demo\" (you are \"$me\"), or use --target DIR --i-know for a test folder."
else
  [ "$i_know" = 1 ] || die "refusing: --target needs --i-know."
fi
[ -d "$target" ] || die "no such folder: $target"
target="$(cd "$target" && pwd -P)"
[ "$target" != "/" ] || die "refusing to seed /."
owner="$(stat -f %Su "$target")"
if [ "$target" = "$real_home" ]; then
  # Seeding a home: only the demo account's own.
  [ "$owner" = "demo" ] && [ "$me" = "demo" ] || [ "$dry_run" = 1 ] || die "refusing: $target belongs to \"$owner\", not \"demo\"."
else
  case "$real_home/" in "$target"/*) [ "$me" = "demo" ] || die "refusing: $target contains your home folder." ;; esac
  [ "$owner" = "$me" ] || [ "$dry_run" = 1 ] || die "refusing: $target is owned by \"$owner\"; CacheDrop only offers items you own."
fi
state_dir="$target/$STATE_DIR_NAME"
manifest="$state_dir/manifest"

# --- The plan ---------------------------------------------------------------------------------------------
# group|weight in group|fixed bytes|folder (relative to the home)|files|file name|extension|age in days|item root|rule
# A row with weight 0 has a fixed size (scaled). The item root is what CacheDrop offers, moves and the reset un-trashes.
# Rule IDs are mac-cleaner's (Packages/CacheDropCore/Sources/CacheDropCore); docs/demo-video.md cites file and line.
dd1="BeatGrid-gkqhzrtuvbnwyxeplomcjdfasiqh"        # Xcode's `<project>-<28 lowercase letters>` (#545)
dd2="SampleBrowser-dwpfnxkzaqylhbeutrmvocgjsiwe"
ds="Library/Developer/Xcode/iOS DeviceSupport"
app_support="Library/Application Support/$DELETED_APP_ID"
app_word="${DELETED_APP_ID##*.}"
plan() {
  cat <<EOF
music|0.60|0|Library/Caches/Ableton/Cache/Decoding|24|Sample|wav|0|Library/Caches/Ableton/Cache|ableton-cache
music|0.06|0|Library/Caches/com.ableton.live/fsCachedData|12|blob||0|Library/Caches/com.ableton.live|app-caches
music|0.13|0|Library/Caches/com.native-instruments.nativeaccess2/fsCachedData|10|blob||0|Library/Caches/com.native-instruments.nativeaccess2|app-caches
music|0.11|0|Library/Caches/com.uaudio.ua-connect/fsCachedData|8|blob||0|Library/Caches/com.uaudio.ua-connect|app-caches
music|0.10|0|Library/Caches/com.landr.app/fsCachedData|8|blob||0|Library/Caches/com.landr.app|app-caches
dev|0.30|0|Library/Developer/Xcode/DerivedData/$dd1/Build/Intermediates.noindex|20|object|o|0|Library/Developer/Xcode/DerivedData/$dd1|xcode-derived-data
dev|0.20|0|Library/Developer/Xcode/DerivedData/$dd2/Index.noindex/DataStore|10|unit|idx|0|Library/Developer/Xcode/DerivedData/$dd2|xcode-derived-data
dev|0.10|0|$ds/iPhone17,1 18.5 (22F76)/Symbols/usr/lib|6|lib|dylib|0|$ds/iPhone17,1 18.5 (22F76)|xcode-device-support
dev|0.10|0|$ds/iPhone17,1 18.6 (22G86)/Symbols/usr/lib|6|lib|dylib|0|$ds/iPhone17,1 18.6 (22G86)|xcode-device-support
dev|0|1000000|$ds/iPhone17,1 26.0 (23A341)/Symbols|1|dyld_shared_cache|bin|0|$ds/iPhone17,1 26.0 (23A341)|kept:newest-2
dev|0|1000000|$ds/iPhone17,1 26.1 (23B85)/Symbols|1|dyld_shared_cache|bin|0|$ds/iPhone17,1 26.1 (23B85)|kept:newest-2
dev|0.18|0|.npm/_cacache/content-v2/sha512/3f|40|package|tgz|0|.npm/_cacache|npm-cache
EOF
  if [ "$INCLUDE_HOMEBREW" = 1 ]; then
    cat <<EOF
dev|0.12|0|Library/Caches/Homebrew/downloads|6|bottle|tar.gz|0|Library/Caches/Homebrew|homebrew
dev|0|20000|Library/Caches/Homebrew/api|1|formula.jws|json|0|Library/Caches/Homebrew|homebrew
EOF
  fi
  cat <<EOF
leftovers|0.70|0|$app_support/Analysis|16|analysis|dat|60|$app_support|removed-app-leftovers
leftovers|0.30|0|$app_support/Previews|12|preview|png|60|$app_support|removed-app-leftovers
leftovers|0|2000|Library/Preferences|1|$DELETED_APP_ID|plist|60|Library/Preferences/$DELETED_APP_ID.plist|removed-app-leftovers
leftovers|0|8000|Library/Saved Application State/$DELETED_APP_ID.savedState|1|data|data|60|Library/Saved Application State/$DELETED_APP_ID.savedState|removed-app-leftovers
downloads|0.45|0|Downloads|1|$app_word-2.4.1|dmg|21|Downloads/$app_word-2.4.1.dmg|downloads
downloads|0.30|0|Downloads|1|TapeEcho-3.0-Installer|dmg|45|Downloads/TapeEcho-3.0-Installer.dmg|downloads
downloads|0.25|0|Downloads|1|SampleBrowser-Beta-0.9|dmg|9|Downloads/SampleBrowser-Beta-0.9.dmg|downloads
EOF
}

group_gb() { case "$1" in music) echo "$MUSIC_GB" ;; dev) echo "$DEV_GB" ;; leftovers) echo "$LEFTOVERS_GB" ;; downloads) echo "$DOWNLOADS_GB" ;; esac; }
# Bytes for one row: weight x group GB (decimal) x scale, or the fixed size x scale (at least 64 bytes).
row_bytes() {
  awk -v w="$1" -v fixed="$2" -v gb="$3" -v s="$SIZE_SCALE" 'BEGIN {
    b = (w > 0) ? w * gb * 1e9 * s : fixed * s; if (b < 64) b = 64; printf "%.0f\n", b }'
}
human() { awk -v b="$1" 'BEGIN { if (b >= 1e9) printf "%.2f GB", b/1e9; else if (b >= 1e6) printf "%.1f MB", b/1e6; else if (b >= 1e3) printf "%.1f KB", b/1e3; else printf "%d B", b }'; }

total=0; to_trash=0; kept=0
while IFS='|' read -r group weight fixed _ _ _ _ _ _ rule; do
  b=$(row_bytes "$weight" "$fixed" "$(group_gb "$group")")
  total=$((total + b))
  case "$rule" in
    downloads|removed-app-leftovers) to_trash=$((to_trash + b)) ;;
    kept:*) kept=$((kept + b)) ;;
  esac
done < <(plan)
free_bytes=$(( $(df -k "$target" | awk 'NR==2 {print $4}') * 1024 ))
headroom=$(awk -v g="$FREE_HEADROOM_GB" 'BEGIN { printf "%.0f\n", g * 1e9 }')

# --- Dry run ----------------------------------------------------------------------------------------------
if [ "$dry_run" = 1 ]; then
  echo "CacheDrop demo seed: plan for $target (command: $command, scale $SIZE_SCALE)"
  printf '%-22s %-10s %s\n' "RULE" "SIZE" "FOLDER"
  while IFS='|' read -r group weight fixed dir count name ext age _ rule; do
    b=$(row_bytes "$weight" "$fixed" "$(group_gb "$group")")
    note=""; if [ "$age" != 0 ]; then note=" (dated $age days ago)"; fi
    shown="$dir/  [$count files]"; if [ "$count" = 1 ]; then shown="$dir/$name${ext:+.$ext}"; fi
    printf '%-22s %-10s ~/%s%s\n' "$rule" "$(human "$b")" "$shown" "$note"
  done < <(plan)
  echo
  echo "Total written:            $(human $total) ($total bytes)"
  echo "  deleted permanently:    $(human $((total - to_trash - kept)))  (Overview's estimate and Results' Measured freed space should land near this)"
  echo "  moved to the Trash:     $(human $to_trash)  (Downloads and Files from deleted apps; freed only when the Trash is emptied)"
  echo "  not offered:            $(human $kept)  (the 2 newest device support versions Xcode keeps)"
  echo "Free on this volume:      $(human $free_bytes); needs $(human $((total + headroom))) (seed + ${FREE_HEADROOM_GB} GB)"
  if [ "$free_bytes" -lt $((total + headroom)) ]; then echo "Verdict: would REFUSE (not enough free space)."; else echo "Verdict: would seed."; fi
  exit 0
fi

# --- Remove what a seed wrote ----------------------------------------------------------------------------
remove_seeded() {
  [ -f "$manifest" ] || { echo "Nothing to remove: no manifest at $manifest."; return 0; }
  local kind path removed=0
  # Files first; never a folder wholesale.
  while IFS=' ' read -r kind path; do
    [ "$kind" = F ] || continue
    if [ -f "$target/$path" ] && [ ! -L "$target/$path" ]; then rm -f "$target/$path"; removed=$((removed + 1)); fi
  done < "$manifest"
  # Items CacheDrop moved to the Trash: same name and still carrying the seed's marker.
  while IFS=' ' read -r kind path; do
    [ "$kind" = R ] || continue
    local trashed="$target/.Trash/$(basename "$path")"
    if [ -e "$trashed" ] && xattr -p "$MARKER_ATTR" "$trashed" >/dev/null 2>&1; then rm -rf "$trashed"; removed=$((removed + 1)); fi
  done < "$manifest"
  # Folders the seed created, deepest first, only when empty.
  { grep '^D ' "$manifest" || true; } | cut -c3- | awk '{ print length, $0 }' | sort -rn | cut -d' ' -f2- | while IFS= read -r path; do
    rmdir "$target/$path" 2>/dev/null || true
  done
  rm -f "$manifest"; rmdir "$state_dir" 2>/dev/null || true
  echo "Removed $removed seeded files and Trash items from $target."
}

if [ "$command" = reset ] || [ "$command" = remove ]; then
  remove_seeded
  if [ "$command" = remove ]; then exit 0; fi
fi

# --- Seed --------------------------------------------------------------------------------------------------
[ ! -f "$manifest" ] || die "already seeded ($manifest exists); run \"reset\" to re-seed."
[ "$free_bytes" -ge $((total + headroom)) ] || die "refusing: $(human $free_bytes) free, needs $(human $((total + headroom))) (seed + ${FREE_HEADROOM_GB} GB)."
while IFS='|' read -r _ _ _ _ _ _ _ _ root _; do
  [ ! -e "$target/$root" ] || die "refusing: ~/$root already exists and the seed didn't write it."
done < <(plan | awk -F'|' '!seen[$9]++')

mkdir -p "$state_dir"
: > "$manifest"
# mkdir -p that records each folder it creates, so the reset can remove exactly those.
make_dir() {
  local rel="$1" path="" part
  local IFS=/
  for part in $rel; do
    path="${path:+$path/}$part"
    if [ ! -d "$target/$path" ]; then mkdir "$target/$path"; echo "D $path" >> "$manifest"; fi
  done
}
write_bytes() {
  local file="$1" bytes="$2" mb rem
  mb=$((bytes / 1048576)); rem=$((bytes % 1048576))
  : > "$file"
  if [ "$mb" -gt 0 ]; then dd if=/dev/urandom of="$file" bs=1048576 count="$mb" 2>/dev/null; fi
  if [ "$rem" -gt 0 ]; then head -c "$rem" /dev/urandom >> "$file"; fi
  # Real bytes only: the exact size, and every byte allocated (no sparse file).
  [ "$(stat -f %z "$file")" = "$bytes" ] || die "short write: $file"
  [ $(( $(stat -f %b "$file") * 512 )) -ge "$bytes" ] || die "not fully allocated: $file"
}
write_plist() {
  cat > "$1" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>LastProjectFolder</key><string>~/Music/$app_word</string><key>SUEnableAutomaticChecks</key><false/></dict></plist>
EOF
}

echo "Seeding $(human $total) into $target ..."
written=0
while IFS='|' read -r group weight fixed dir count name ext age root rule; do
  bytes=$(row_bytes "$weight" "$fixed" "$(group_gb "$group")")
  make_dir "$dir"
  each=$((bytes / count))
  i=1
  while [ "$i" -le "$count" ]; do
    if [ "$count" = 1 ]; then file="$name"; else file="$(printf '%s-%03d' "$name" "$i")"; fi
    if [ -n "$ext" ]; then file="$file.$ext"; fi
    size=$each; if [ "$i" = "$count" ]; then size=$((bytes - each * (count - 1))); fi
    if [ "$ext" = plist ]; then write_plist "$target/$dir/$file"; else write_bytes "$target/$dir/$file" "$size"; fi
    echo "F $dir/$file" >> "$manifest"
    if [ "$age" != 0 ]; then
      # mtime and atime; an mtime older than the creation date moves the creation date back too (APFS),
      # which is what CacheDrop's Downloads age reads (mtime, creation, Spotlight's last-opened).
      stamp=$(date -v-"${age}"d +%Y%m%d%H%M.%S)
      touch -a -m -t "$stamp" "$target/$dir/$file"
    fi
    i=$((i + 1))
  done
  written=$((written + bytes))
  printf '  %-22s %-10s ~/%s\n' "$rule" "$(human "$bytes")" "$dir"
done < <(plan)

# Mark each item root, so the reset can recognise it in the Trash; then date the trash-bound roots like their files.
while IFS='|' read -r _ _ _ _ _ _ _ age root _; do
  grep -qxF "R $root" "$manifest" || echo "R $root" >> "$manifest"
  xattr -w "$MARKER_ATTR" 1 "$target/$root"
  if [ "$age" != 0 ] && [ -d "$target/$root" ]; then
    stamp=$(date -v-"${age}"d +%Y%m%d%H%M.%S)
    find "$target/$root" -type d -exec touch -a -m -t "$stamp" {} +
  elif [ "$age" != 0 ]; then
    stamp=$(date -v-"${age}"d +%Y%m%d%H%M.%S)
    touch -a -m -t "$stamp" "$target/$root"
  fi
done < <(plan)

echo "Done: $(human $written) written ($(human $to_trash) of it goes to the Trash when cleaned). Manifest: $manifest"

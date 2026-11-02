#!/bin/bash
# Fails when docs/DECISIONS.md's Decisions aren't numbered uniquely and in increasing order (#78).
#
# DECISIONS.md merges with git's union driver (.gitattributes), so parallel branches that each append a Decision merge
# without conflicts, though their Decisions may land in either order, and two branches that took the same number keep
# both. This check catches both; reorder or renumber the lines it names. Ported from mac-cleaner's script of the same name.
#
#   scripts/check-decisions.sh        exit 0 when clean; otherwise prints each offending number
set -uo pipefail
cd "$(dirname "$0")/.."
grep -E '^[0-9]+\. \*\*' docs/DECISIONS.md | sed -E 's/^([0-9]+)\..*/\1/' | awk '
  NR > 1 && $1 <= last { printf "Decision %d follows %d in docs/DECISIONS.md: renumber it or remove the duplicate.\n", $1, last; bad = 1 }
  { last = $1 }
  END { exit bad }
'

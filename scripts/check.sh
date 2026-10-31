#!/bin/sh
# #43: use the pinned npm for the shared local/CI checks; no global npm changes.
set -eu
cd "$(dirname "$0")/.."
expected_node=$(cat .node-version)
if [ "$(node -p 'process.versions.node')" != "$expected_node" ]; then
  echo "Use Node $expected_node from .node-version before running checks." >&2
  exit 2
fi
npm_version=$(node -p 'require("./package.json").packageManager.slice(4)')
exec npx --yes --package "npm@$npm_version" npm run check -- "$@"

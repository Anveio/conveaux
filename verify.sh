#!/bin/bash
set -e

# Lightweight entry point for the validation pipeline.
# Builds the validation-pipeline app if needed, then delegates to it.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIPELINE_CLI="$SCRIPT_DIR/apps/validation-pipeline/dist/cli.js"

# Build validation-pipeline if not already built
if [ ! -f "$PIPELINE_CLI" ]; then
  echo "Building validation-pipeline..."
  npm install --silent
  npm run build --workspace=@conveaux/validation-pipeline --silent
fi

# Forward all arguments to the validation-pipeline CLI
exec node "$PIPELINE_CLI" "$@"

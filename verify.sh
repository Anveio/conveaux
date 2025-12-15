#!/bin/bash
set -e

# Lightweight entry point for the validation pipeline.
# Uses tsx to run TypeScript directly (no build step needed).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIPELINE_CLI="$SCRIPT_DIR/apps/validation-pipeline/src/cli.ts"

# Install dependencies if node_modules doesn't exist
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
  echo "Installing dependencies..."
  npm install --silent
fi

# Forward all arguments to the validation-pipeline CLI via tsx
exec npx tsx "$PIPELINE_CLI" "$@"

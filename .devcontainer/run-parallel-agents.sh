#!/bin/bash
# Run multiple Claude Code instances in parallel
# Usage: ./run-parallel-agents.sh <num_instances> <prompt_file>

set -euo pipefail

NUM_INSTANCES=${1:-5}
PROMPT_FILE=${2:-""}
WORKSPACE="/workspace"
LOG_DIR="/tmp/claude-agents"

mkdir -p "$LOG_DIR"

echo "Starting $NUM_INSTANCES Claude Code instances..."

# Copy permissive settings to home
mkdir -p ~/.claude
cp /workspace/.devcontainer/claude-settings.json ~/.claude/settings.json

for i in $(seq 1 "$NUM_INSTANCES"); do
  LOG_FILE="$LOG_DIR/agent-$i.log"

  if [ -n "$PROMPT_FILE" ] && [ -f "$PROMPT_FILE" ]; then
    PROMPT=$(cat "$PROMPT_FILE")
    echo "Starting agent $i with prompt from $PROMPT_FILE..."
    (cd "$WORKSPACE" && claude --dangerously-skip-permissions -p "$PROMPT" > "$LOG_FILE" 2>&1) &
  else
    echo "Starting agent $i in interactive mode..."
    echo "Agent $i: Use 'claude --dangerously-skip-permissions' to start"
  fi
done

echo ""
echo "Agents running. Logs in: $LOG_DIR"
echo "Monitor with: tail -f $LOG_DIR/agent-*.log"

# Wait for all background jobs
wait
echo "All agents completed."

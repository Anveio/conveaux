#!/bin/bash
set -e

# Parse arguments
UI_MODE=true
E2E_TIER=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --ui=false)
      UI_MODE=false
      shift
      ;;
    --ui=true)
      UI_MODE=true
      shift
      ;;
    --e2e=*)
      E2E_TIER="${1#*=}"
      shift
      ;;
    *)
      shift
      ;;
  esac
done

# Stage runner with mode-aware output
run_stage() {
  local name=$1
  local cmd=$2

  if [ "$UI_MODE" = true ]; then
    echo "=== $name ==="
  else
    echo "STAGE:$name:START"
  fi

  if eval "$cmd"; then
    if [ "$UI_MODE" = true ]; then
      echo "   $name passed"
      echo ""
    else
      echo "STAGE:$name:PASS"
    fi
    return 0
  else
    if [ "$UI_MODE" = true ]; then
      echo "   $name FAILED"
    else
      echo "STAGE:$name:FAIL"
    fi
    return 1
  fi
}

# Header
if [ "$UI_MODE" = true ]; then
  echo "=== Conveaux Verification Pipeline ==="
  echo ""
else
  echo "VERIFICATION:START"
fi

# Run stages
run_stage "install" "npm install --silent"
run_stage "build" "npx turbo build --output-logs=errors-only"
run_stage "test" "npx turbo test --output-logs=errors-only"

# Optional E2E stage
if [ -n "$E2E_TIER" ]; then
  run_stage "e2e:$E2E_TIER" "npx turbo e2e --filter=@conveaux/cli -- --tier=$E2E_TIER"
fi

# Summary
if [ "$UI_MODE" = true ]; then
  echo "=== All checks passed ==="
else
  echo "VERIFICATION:PASS"
fi

exit 0

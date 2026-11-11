#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p artifacts
trap 'result=$?; printf "%s\n" "$result" > artifacts/verification-exit-code.txt' EXIT
export APP_MODE=local AI_PROVIDER=mock INSTABOX_HEADLESS=1
bun run format:check > artifacts/format.log 2>&1
bun run typecheck > artifacts/typecheck.log 2>&1
bun run test > artifacts/unit-tests.log 2>&1
bun run lint > artifacts/lint.log 2>&1
bun run build > artifacts/build.log 2>&1
bun run test:e2e > artifacts/e2e.log 2>&1

#!/usr/bin/env bash
# Keep test selection beside the E2E tests. Changing this file does not require
# rebuilding production Functions; CI still executes it before release.
set -euo pipefail

cd "$(dirname "$0")/.."

case "${1:-}" in
  ssr)
    npx playwright test e2e/home-personal.spec.ts e2e/player-stats.spec.ts --grep 'SSR remediation|SSR detail stream|canonical competition|personal league carousel|J19|J10|J08|J12' --workers=1 --trace=on
    ;;
  briefing)
    BRIEFING_PUBLIC_ENABLED=true npx playwright test e2e/briefing.spec.ts --grep-invert 'feature-disabled' --workers=1 --trace=on --output=test-results/briefing-enabled
    BRIEFING_PUBLIC_ENABLED=false npx playwright test e2e/briefing.spec.ts --grep 'feature-disabled' --workers=1 --trace=on --output=test-results/briefing-disabled
    ;;
  *)
    echo 'Usage: bash e2e/run-fixture-suite.sh {ssr|briefing}' >&2
    exit 2
    ;;
esac

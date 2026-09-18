#!/usr/bin/env bash
# Keep test selection beside the E2E tests. Changing this file does not require
# rebuilding production Functions; CI still executes it before release.
set -euo pipefail

cd "$(dirname "$0")/.."

case "${1:-}" in
  ssr)
    npx playwright test e2e/home-personal.spec.ts e2e/player-stats.spec.ts --grep 'SSR remediation|SSR detail stream|canonical competition|personal league carousel|J19|J10|J08|J12' --workers=1 --trace=on
    PLAYWRIGHT_USE_EXISTING_BUILD=1 bash e2e/run-fixture-suite.sh horizon
    PLAYWRIGHT_USE_EXISTING_BUILD=1 bash e2e/run-fixture-suite.sh trends-unpublished
    ;;
  horizon)
    E2E_NONTERMINAL_HORIZON=1 npx playwright test e2e/nonterminal-horizon.spec.ts --workers=1 --trace=on --output=test-results/horizon
    ;;
  trends-unpublished)
    E2E_TRENDS_UNPUBLISHED=1 npx playwright test e2e/trends-unpublished.spec.ts --workers=1 --trace=on --output=test-results/trends-unpublished
    E2E_TRENDS_UNPUBLISHED=1 E2E_SSR_REMEDIATION=1 PLAYWRIGHT_USE_EXISTING_BUILD=1 npx playwright test e2e/home-personal.spec.ts --grep 'TR03 planned.*unpublished' --workers=1 --trace=on --output=test-results/trends-unpublished-bound
    ;;
  briefing)
    BRIEFING_PUBLIC_ENABLED=true npx playwright test e2e/briefing.spec.ts --grep-invert 'feature-disabled' --workers=1 --trace=on --output=test-results/briefing-enabled
    BRIEFING_PUBLIC_ENABLED=false npx playwright test e2e/briefing.spec.ts --grep 'feature-disabled' --workers=1 --trace=on --output=test-results/briefing-disabled
    ;;
  *)
    echo 'Usage: bash e2e/run-fixture-suite.sh {ssr|horizon|trends-unpublished|briefing}' >&2
    exit 2
    ;;
esac

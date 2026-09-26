#!/usr/bin/env bash
# Keep test selection beside the E2E tests. Changing this file does not require
# rebuilding production Functions; CI still executes it before release.
set -euo pipefail

cd "$(dirname "$0")/.."

case "${1:-}" in
  ssr)
    npx playwright test e2e/navigation-metrics.spec.ts --workers=1 --trace=on --output=test-results/navigation-metrics
    npx playwright test e2e/home-personal.spec.ts e2e/player-stats.spec.ts e2e/match-fallback.spec.ts --grep 'SSR remediation|SSR detail stream|canonical competition|personal league carousel|R23 actual internal competition entry|J19|J10|J08|J12|live board layout fixture' --workers=1 --trace=on
    E2E_MARKET_READINESS=1 PLAYWRIGHT_USE_EXISTING_BUILD=1 npx playwright test e2e/market-readiness.spec.ts --workers=1 --trace=on --output=test-results/market-readiness
    PLAYWRIGHT_USE_EXISTING_BUILD=1 bash e2e/run-fixture-suite.sh horizon
    PLAYWRIGHT_USE_EXISTING_BUILD=1 bash e2e/run-fixture-suite.sh trends-unpublished
    E2E_MARKET_HISTORY=1 PLAYWRIGHT_USE_EXISTING_BUILD=1 npx playwright test e2e/market-historical-freshness.spec.ts --workers=1 --trace=on --output=test-results/market-history
    E2E_MARKET_READINESS=1 PLAYWRIGHT_USE_EXISTING_BUILD=1 npx playwright test e2e/market-controls.spec.ts --grep 'C09 text share' --workers=1 --trace=on --output=test-results/market-share
    for status in READY PARTIAL STALE UNAVAILABLE; do
      E2E_MARKET_READINESS=1 PLAYWRIGHT_USE_EXISTING_BUILD=1 npx playwright test e2e/market-controls.spec.ts --grep "PRED03 board states $status " --workers=1 --trace=on --output="test-results/prediction-$status"
    done
    E2E_MARKET_READINESS=1 PLAYWRIGHT_USE_EXISTING_BUILD=1 npx playwright test e2e/market-controls.spec.ts --grep "PRED03 cached board" --workers=1 --trace=on --output=test-results/prediction-cache
    PLAYWRIGHT_USE_EXISTING_BUILD=1 bash e2e/run-fixture-suite.sh governance
    npx playwright test e2e/match-missing-stats.spec.ts --workers=1 --trace=on --output=test-results/match-missing-stats
    ;;
  governance)
    E2E_GOVERNANCE=1 LETLETME_DATA_URL="http://127.0.0.1:${E2E_GRAPHQL_PORT:-4100}" LETLETME_DATA_API_KEY=isolated-governance-test-key PLATFORM_ADMIN_USER_IDS=e2e-governance-admin PLATFORM_ADMIN_FPL_ENTRY_IDS=909090 npx playwright test e2e/home-personal.spec.ts --grep "GOV REST sections" --workers=1 --trace=on --output=test-results/governance
    ;;
  horizon)
    E2E_NONTERMINAL_HORIZON=1 npx playwright test e2e/nonterminal-horizon.spec.ts --workers=1 --trace=on --output=test-results/horizon
    ;;
  trends-unpublished)
    E2E_TRENDS_UNPUBLISHED=1 npx playwright test e2e/trends-unpublished.spec.ts --workers=1 --trace=on --output=test-results/trends-unpublished
    E2E_TRENDS_UNPUBLISHED=1 E2E_SSR_REMEDIATION=1 PLAYWRIGHT_USE_EXISTING_BUILD=1 npx playwright test e2e/home-personal.spec.ts --grep 'TR03 planned.*unpublished' --workers=1 --trace=on --output=test-results/trends-unpublished-bound
    ;;
  briefing)
    BRIEFING_PUBLIC_ENABLED=true npx playwright test e2e/briefing.spec.ts e2e/briefing-state-metrics.spec.ts --grep-invert 'feature-disabled' --workers=1 --trace=on --output=test-results/briefing-enabled
    BRIEFING_PUBLIC_ENABLED=false npx playwright test e2e/briefing.spec.ts --grep 'feature-disabled' --workers=1 --trace=on --output=test-results/briefing-disabled
    E2E_BRIEFING_ADMIN=1 BRIEFING_ADMIN_ENABLED=true BRIEFING_EDITOR_EMAILS=editor@briefing.e2e.test,both@briefing.e2e.test BRIEFING_PUBLISHER_EMAILS=publisher@briefing.e2e.test,both@briefing.e2e.test npx playwright test e2e/briefing-admin.spec.ts --workers=1 --trace=on --output=test-results/briefing-admin
    E2E_BRIEFING_ADMIN=1 BRIEFING_ADMIN_ENABLED=false BRIEFING_EDITOR_EMAILS=editor@briefing.e2e.test,both@briefing.e2e.test BRIEFING_PUBLISHER_EMAILS=publisher@briefing.e2e.test,both@briefing.e2e.test npx playwright test e2e/briefing-admin.spec.ts --workers=1 --trace=on --output=test-results/briefing-admin-disabled
    E2E_BRIEFING_ADMIN=1 BRIEFING_ADMIN_ENABLED=true BRIEFING_PUBLISHER_EMAILS=publisher@briefing.e2e.test npx playwright test e2e/briefing-authorization.spec.ts --workers=1 --trace=on --output=test-results/briefing-authorization
    ;;
  *)
    echo 'Usage: bash e2e/run-fixture-suite.sh {ssr|governance|horizon|trends-unpublished|briefing}' >&2
    exit 2
    ;;
esac

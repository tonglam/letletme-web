#!/usr/bin/env bash
set -euo pipefail

readonly slot_lock=/var/lib/letletme-graphql/switch-slot.lock

if [[ ${1:-} != --slot-lock-held ]]; then
  [[ $# -eq 0 ]] || {
    echo 'usage: sudo env EXPECTED_GRAPHQL_SHA=<sha> EXPECTED_WEB_SHA=<sha> ops/overseas/activate-api-ingress.sh' >&2
    exit 2
  }
  [[ -f $slot_lock ]] || {
    echo "GraphQL slot lock is missing: $slot_lock" >&2
    exit 1
  }
  exec flock -x "$slot_lock" "$0" --slot-lock-held
fi

[[ $EUID -eq 0 ]] || {
  echo 'API ingress activation must run as root' >&2
  exit 1
}
[[ ${EXPECTED_GRAPHQL_SHA:-} =~ ^[0-9a-f]{40}$ ]] || {
  echo 'EXPECTED_GRAPHQL_SHA must be exactly 40 lowercase hex characters' >&2
  exit 1
}
[[ ${EXPECTED_WEB_SHA:-} =~ ^[0-9a-f]{40}$ ]] || {
  echo 'EXPECTED_WEB_SHA must be exactly 40 lowercase hex characters' >&2
  exit 1
}

readonly repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)
readonly selector=/etc/nginx/snippets/letletme-graphql-active.conf
readonly selector_include='include /etc/nginx/snippets/letletme-graphql-active.conf;'
readonly loader=/etc/nginx/conf.d/letletme-graphql-active-loader.conf

active_slot=''
active_port=''

validate_selected_graphql() {
  [[ -L $selector ]]
  [[ -x /usr/local/sbin/letletme-graphql-switch-slot ]]
  [[ -f /var/lib/letletme-graphql/active-slot ]]

  active_slot=$(tr -d '[:space:]' < /var/lib/letletme-graphql/active-slot)
  case "$active_slot" in
    blue) active_port=4000 ;;
    green) active_port=4002 ;;
    *)
      echo 'invalid GraphQL active-slot state' >&2
      exit 1
      ;;
  esac

  local active_target selector_endpoint
  active_target=$(readlink -- "$selector")
  [[ $active_target == "/etc/nginx/snippets/letletme-graphql.$active_slot.conf" ]]
  selector_endpoint=$(
    sed -nE 's/^[[:space:]]*server[[:space:]]+([^;[:space:]]+);.*$/\1/p' \
      "$active_target"
  )
  [[ $selector_endpoint == "127.0.0.1:$active_port" ]] || {
    echo "GraphQL selector endpoint does not match active-slot: $selector_endpoint" >&2
    exit 1
  }

  curl --fail --silent --show-error --max-time 10 \
    "http://127.0.0.1:$active_port/health/deploy" |
    python3 -c '
import json, os, sys
payload = json.load(sys.stdin)
if payload.get("status") != "ok":
    raise SystemExit("selected GraphQL slot is not deploy-ready")
if payload.get("contractVersion") != "live-points-v2":
    raise SystemExit("selected GraphQL slot is not the V2 contract")
if payload.get("deploySha") != os.environ["EXPECTED_GRAPHQL_SHA"]:
    raise SystemExit("selected GraphQL slot release identity does not match")
'
}

effective_config=$(nginx -T 2>&1)
include_count=$(grep -Fc -- "$selector_include" <<<"$effective_config" || true)
case "$include_count" in
  0)
    install -o root -g root -m 0644 \
      "$repo_root/ops/overseas/nginx/letletme-graphql-active-loader.conf" \
      "$loader"
    ;;
  1) ;;
  *)
    echo "GraphQL active selector is included $include_count times" >&2
    exit 1
    ;;
esac

validate_selected_graphql

install -o root -g root -m 0644 \
  "$repo_root/ops/overseas/nginx/letletme-client-ip.conf" \
  /etc/nginx/conf.d/letletme-client-ip.conf
install -o root -g root -m 0644 \
  "$repo_root/ops/overseas/nginx/letletme-data.conf" \
  /etc/nginx/sites-enabled/letletme-data
install -o root -g root -m 0644 \
  "$repo_root/ops/overseas/nginx/hermes-direct.conf" \
  /etc/nginx/sites-enabled/zz-hermes-direct

nginx -t
effective_config=$(nginx -T 2>&1)
include_count=$(grep -Fc -- "$selector_include" <<<"$effective_config" || true)
upstream_count=$(
  grep -Ec '^[[:space:]]*upstream letletme_graphql_active[[:space:]]*\{' \
    <<<"$effective_config" || true
)
[[ $include_count -eq 1 && $upstream_count -eq 1 ]] || {
  echo 'effective Nginx config does not contain exactly one active GraphQL selector' >&2
  exit 1
}

systemctl reload nginx
validate_selected_graphql

probe_headers=$(mktemp)
probe_body=$(mktemp)
cleanup_probe() {
  rm -f -- "$probe_headers" "$probe_body"
}
trap cleanup_probe EXIT

curl --fail --silent --show-error --max-time 10 \
  --dump-header "$probe_headers" \
  --output "$probe_body" \
  http://127.0.0.1:3000/healthz
tr -d '\r' < "$probe_headers" |
  grep -Eiq "^x-letletme-release:[[:space:]]*$EXPECTED_WEB_SHA$"
python3 -c '
import json, os, sys
payload = json.load(open(sys.argv[1], encoding="utf-8"))
if payload.get("status") != "ok":
    raise SystemExit("selected Web runtime is not healthy")
if payload.get("release") != os.environ["EXPECTED_WEB_SHA"]:
    raise SystemExit("selected Web release identity does not match")
' "$probe_body"

curl --fail --silent --show-error --max-time 15 \
  --resolve api.letletme.top:443:127.0.0.1 \
  --dump-header "$probe_headers" \
  --output "$probe_body" \
  --header 'content-type: application/json' \
  --header 'accept: application/json' \
  --header 'X-LetLetMe-Contract: live-points-v2' \
  --data '{"query":"query IngressActivationProbe { liveContext { season } }"}' \
  https://api.letletme.top/api/graphql

python3 -c '
import json, sys
payload = json.load(open(sys.argv[1], encoding="utf-8"))
season = payload.get("data", {}).get("liveContext", {}).get("season")
if not isinstance(season, str) or not season:
    raise SystemExit("Web GraphQL proxy did not return a V2 live context")
' "$probe_body"

echo "API ingress activated on Web $EXPECTED_WEB_SHA and GraphQL $active_slot ($EXPECTED_GRAPHQL_SHA)"

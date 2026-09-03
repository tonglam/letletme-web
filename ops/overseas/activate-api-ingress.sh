#!/usr/bin/env bash
set -euo pipefail

readonly slot_lock=/var/lib/letletme-graphql/switch-slot.lock
readonly web_slot_lock=/var/lib/letletme-web/switch-slot.lock

if [[ ${1:-} != --slot-lock-held ]]; then
  [[ $# -eq 0 ]] || {
    echo 'usage: sudo env EXPECTED_GRAPHQL_SHA=<sha> EXPECTED_WEB_SHA=<sha> ops/overseas/activate-api-ingress.sh' >&2
    exit 2
  }
  [[ -f $slot_lock && ! -L $slot_lock ]] || {
    echo "GraphQL slot lock is missing: $slot_lock" >&2
    exit 1
  }
  [[ -f $web_slot_lock && ! -L $web_slot_lock ]] || {
    echo "Web slot lock is missing: $web_slot_lock" >&2
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

repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)
readonly repo_root
readonly selector=/etc/nginx/snippets/letletme-graphql-active.conf
readonly selector_include='include /etc/nginx/snippets/letletme-graphql-active.conf;'
readonly loader=/etc/nginx/conf.d/letletme-graphql-active-loader.conf
readonly web_active_slot_file=/var/lib/letletme-web/active-slot
readonly web_selector=/etc/nginx/snippets/letletme-web-active.conf
readonly web_selector_include='include /etc/nginx/snippets/letletme-web-active.conf;'
readonly web_site=/etc/nginx/sites-enabled/letletme-web
readonly acme_root=/var/www/letletme-acme
readonly web_env_file=/etc/letletme/web.env
readonly web_origin_token_file=/etc/letletme/web-origin-token

active_slot=''
active_port=''
web_active_slot=''
web_active_port=''

exec 8<>"$web_slot_lock"
flock -x 8

validate_selected_graphql() {
  [[ -L $selector ]]
  [[ -x /usr/local/sbin/letletme-graphql-switch-slot ]]
  [[ -f /var/lib/letletme-graphql/active-slot && ! -L /var/lib/letletme-graphql/active-slot ]]

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

validate_web_origin_secret() {
  python3 - "$web_env_file" "$web_origin_token_file" <<'PY'
import hashlib
import pathlib
import re
import stat
import sys

env_path = pathlib.Path(sys.argv[1])
token_path = pathlib.Path(sys.argv[2])
for path in (env_path, token_path):
    if path.is_symlink() or not path.is_file():
        raise SystemExit("Web origin-auth input is missing or unsafe")
    metadata = path.stat()
    if metadata.st_uid != 0 or stat.S_IMODE(metadata.st_mode) != 0o600:
        raise SystemExit("Web origin-auth input has unsafe ownership or mode")

token_lines = token_path.read_text(encoding="utf-8").splitlines()
if len(token_lines) != 1 or not re.fullmatch(r"[A-Za-z0-9._~+/=-]{16,256}", token_lines[0]):
    raise SystemExit("Web origin token is invalid")

secret = None
for raw_line in env_path.read_text(encoding="utf-8").splitlines():
    if not raw_line.strip() or raw_line.lstrip().startswith("#"):
        continue
    key, separator, value = raw_line.partition("=")
    if separator and key == "LETLETME_LOCAL_PROXY_SECRET":
        if secret is not None:
            raise SystemExit("Web environment contains duplicate proxy secrets")
        secret = value
if not secret:
    raise SystemExit("Web environment is missing its local proxy secret")
if hashlib.sha256(secret.encode()).digest() != hashlib.sha256(token_lines[0].encode()).digest():
    raise SystemExit("Web environment proxy secret does not match the origin token")
PY
}

validate_selected_web() {
  [[ -x /usr/local/sbin/letletme-web-switch-slot ]]
  [[ -f $web_active_slot_file && ! -L $web_active_slot_file ]]
  [[ -L $web_selector ]]
  validate_web_origin_secret

  web_active_slot=$(tr -d '[:space:]' < "$web_active_slot_file")
  case "$web_active_slot" in
    blue) web_active_port=3100 ;;
    green) web_active_port=3101 ;;
    *)
      echo 'invalid Web active-slot state' >&2
      exit 1
      ;;
  esac

  local web_active_target
  web_active_target=$(readlink -- "$web_selector")
  [[ $web_active_target == "/etc/nginx/snippets/letletme-web.$web_active_slot.conf" ]]
  local web_selector_endpoint
  web_selector_endpoint=$(
    sed -nE 's/^[[:space:]]*server[[:space:]]+([^;[:space:]]+);.*$/\1/p' \
      "$web_active_target"
  )
  [[ $web_selector_endpoint == "127.0.0.1:$web_active_port" ]] || {
    echo "Web selector endpoint does not match active-slot: $web_selector_endpoint" >&2
    exit 1
  }

  local web_headers
  web_headers=$(curl --fail --silent --show-error --max-time 10 \
    --dump-header - -o /dev/null "http://127.0.0.1:$web_active_port/healthz")
  tr -d '\r' <<< "$web_headers" |
    grep -Eiq "^x-letletme-origin:[[:space:]]*overseas$"
  tr -d '\r' <<< "$web_headers" |
    grep -Eiq "^x-letletme-release:[[:space:]]*$EXPECTED_WEB_SHA$"
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
validate_selected_web

install -o root -g root -m 0644 \
  "$repo_root/ops/overseas/nginx/letletme-client-ip.conf" \
  /etc/nginx/conf.d/letletme-client-ip.conf
install -o root -g root -m 0644 \
  "$repo_root/ops/overseas/nginx/letletme-data.conf" \
  /etc/nginx/sites-enabled/letletme-data
install -o root -g root -m 0644 \
  "$repo_root/ops/overseas/nginx/hermes-direct.conf" \
  /etc/nginx/sites-enabled/zz-hermes-direct
if [ -L "$web_site" ] || { [ -e "$web_site" ] && [ ! -f "$web_site" ]; }; then
  echo "refusing unsafe Web Nginx site target: $web_site" >&2
  exit 1
fi
install -o root -g root -m 0644 \
  "$repo_root/ops/overseas/nginx/letletme-web.conf" \
  "$web_site"
install -d -o root -g root -m 0755 "$acme_root"

nginx -t
effective_config=$(nginx -T 2>&1)
include_count=$(grep -Fc -- "$selector_include" <<<"$effective_config" || true)
upstream_count=$(
  grep -Ec '^[[:space:]]*upstream letletme_graphql_active[[:space:]]*\{' \
    <<<"$effective_config" || true
)
web_include_count=$(grep -Fc -- "$web_selector_include" <<<"$effective_config" || true)
web_upstream_count=$(
  grep -Ec '^[[:space:]]*upstream letletme_web_active[[:space:]]*\{' \
    <<<"$effective_config" || true
)
[[ $include_count -eq 1 && $upstream_count -eq 1 && $web_include_count -eq 1 && $web_upstream_count -eq 1 ]] || {
  echo 'effective Nginx config does not contain exactly one active GraphQL and Web selector' >&2
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
  "http://127.0.0.1:$web_active_port/healthz"
tr -d '\r' < "$probe_headers" |
  grep -Eiq "^x-letletme-release:[[:space:]]*$EXPECTED_WEB_SHA$"
tr -d '\r' < "$probe_headers" |
  grep -Eiq '^x-letletme-origin:[[:space:]]*overseas$'
python3 -c '
import json, os, sys
payload = json.load(open(sys.argv[1], encoding="utf-8"))
if payload.get("status") != "ok":
    raise SystemExit("selected Web runtime is not healthy")
if payload.get("release") != os.environ["EXPECTED_WEB_SHA"]:
    raise SystemExit("selected Web release identity does not match")
' "$probe_body"

curl --fail --silent --show-error --max-time 15 \
  --resolve letletme.top:443:127.0.0.1 \
  --dump-header "$probe_headers" \
  --output "$probe_body" \
  --header 'content-type: application/json' \
  --header 'accept: application/json' \
  --header 'X-LetLetMe-Perf-Source: synthetic' \
  --header 'X-LetLetMe-Contract: live-points-v2' \
  --data '{"query":"query IngressActivationProbe { liveContext { season } }"}' \
  https://letletme.top/api/graphql

python3 -c '
import json, sys
payload = json.load(open(sys.argv[1], encoding="utf-8"))
season = payload.get("data", {}).get("liveContext", {}).get("season")
if not isinstance(season, str) or not season:
    raise SystemExit("Web GraphQL proxy did not return a V2 live context")
' "$probe_body"

echo "API ingress activated on Web $web_active_slot ($EXPECTED_WEB_SHA) and GraphQL $active_slot ($EXPECTED_GRAPHQL_SHA)"

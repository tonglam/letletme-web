#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
	echo "run as root" >&2
	exit 1
fi

web_env=/etc/letletme/web.env
if [[ -L $web_env || ! -f $web_env ]]; then
	echo "missing or unsafe Web environment: $web_env" >&2
	exit 1
fi

# web.env is a root-owned shell-compatible file already consumed by the Web
# release scripts. Only pass the cleanup bearer to curl; do not inherit the
# rest of the production environment into the request process.
CRON_SECRET=''
# shellcheck disable=SC1090
source "$web_env"
cron_secret_length=$(printf '%s' "$CRON_SECRET" | wc -c | tr -d ' ')
if [[ $cron_secret_length -lt 32 ]]; then
	echo "CRON_SECRET must contain at least 32 bytes" >&2
	exit 1
fi

exec env -i PATH=/usr/bin:/bin /usr/bin/curl \
	--fail \
	--silent \
	--show-error \
	--max-time 30 \
	--header "Authorization: Bearer $CRON_SECRET" \
	http://127.0.0.1:3000/api/cron/auth-event-cleanup

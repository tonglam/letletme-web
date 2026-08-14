#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
	echo "run as root" >&2
	exit 1
fi
if [[ $# -ne 1 || ! $1 =~ ^[a-f0-9]{7,64}$ ]]; then
	echo "usage: $0 <release-sha>" >&2
	exit 1
fi

release_sha=$1
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
template=$(cd -- "$script_dir/../nginx" && pwd)/letletme-origin-auth.conf.template
origin_token=$(< /etc/letletme/origin-token)
proxy_secret=$(< /etc/letletme/local-proxy-secret)

if [[ ! $origin_token =~ ^[a-f0-9]{64,128}$ ]]; then
	echo "origin token must be 32-64 random bytes encoded as hex" >&2
	exit 1
fi
if [[ ! $proxy_secret =~ ^[a-f0-9]{64,128}$ ]]; then
	echo "local proxy secret must be 32-64 random bytes encoded as hex" >&2
	exit 1
fi

rendered=$(< "$template")
rendered=${rendered//__ORIGIN_TOKEN__/$origin_token}
rendered=${rendered//__LOCAL_PROXY_SECRET__/$proxy_secret}
rendered=${rendered//__RELEASE_SHA__/$release_sha}
printf '%s\n' "$rendered" | install -o root -g www-data -m 0640 /dev/stdin \
	/etc/nginx/conf.d/letletme-origin-auth.conf

nginx -t
systemctl reload nginx

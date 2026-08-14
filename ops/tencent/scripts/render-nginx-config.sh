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
static_dir=/opt/letletme/static-releases/$release_sha
if [[ -L $static_dir || ! -d $static_dir ]]; then
	echo "missing static release directory: $static_dir" >&2
	exit 1
fi
site_template=$(cd -- "$script_dir/../nginx" && pwd)/letletme.conf
if [[ ! -f $site_template ]]; then
	echo "missing Nginx site template: $site_template" >&2
	exit 1
fi
static_try_files=$'try_files\n'
static_try_files+=$'\t'"$static_dir"'/\$letletme_static_suffix\n'
while IFS= read -r candidate; do
	if [[ -d $candidate && ! -L $candidate ]]; then
		static_try_files+=$'\t'"$candidate"'/\$letletme_static_suffix\n'
	fi
done < <(
	find /opt/letletme/static-releases -mindepth 1 -maxdepth 1 \
		-regextype posix-extended -type d -regex '.*/[a-f0-9]{40}' \
		! -path "$static_dir" -printf '%T@ %p\n' |
		sort -nr | cut -d' ' -f2-
)
static_try_files+=$'\t=404;'
install -o root -g root -m 0644 "$site_template" \
	/etc/nginx/sites-available/letletme
printf '%s\n' "$static_try_files" | install -o root -g www-data -m 0640 \
	/dev/stdin /etc/nginx/snippets/letletme-static-try-files.conf
# Older candidate installs briefly placed this location-only include in the
# automatically loaded conf.d directory. Keep that path harmless and empty.
install -o root -g root -m 0644 /dev/null \
	/etc/nginx/conf.d/letletme-static-try-files.conf
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
rendered=${rendered//__STATIC_TRY_FILES__/$static_try_files}
printf '%s\n' "$rendered" | install -o root -g www-data -m 0640 /dev/stdin \
	/etc/nginx/conf.d/letletme-origin-auth.conf

nginx -t
systemctl reload-or-restart nginx.service

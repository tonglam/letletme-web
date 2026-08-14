#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
	echo "run as root" >&2
	exit 1
fi

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
ops_dir=$(cd -- "$script_dir/.." && pwd)

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg nginx rsync

install -d -m 0755 /etc/apt/keyrings
key_tmp=$(mktemp)
trap 'rm -f -- "$key_tmp"' EXIT
curl --fail --silent --show-error --location \
	https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
	--output "$key_tmp"
gpg --dearmor --yes --output /etc/apt/keyrings/nodesource.gpg "$key_tmp"
printf '%s\n' \
	'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main' \
	> /etc/apt/sources.list.d/nodesource.list
apt-get update
apt-get install -y nodejs

node_major=$(node --version | sed -E 's/^v([0-9]+).*/\1/')
if [[ $node_major != 22 ]]; then
	echo "Node.js 22 is required; found $(node --version)" >&2
	exit 1
fi

if ! id letletme >/dev/null 2>&1; then
	useradd --system --home-dir /nonexistent --shell /usr/sbin/nologin letletme
fi

install -d -o root -g letletme -m 0750 /etc/letletme
install -d -o root -g root -m 0700 /etc/letletme/tls
install -d -o root -g letletme -m 0750 /opt/letletme
install -d -o root -g letletme -m 0750 /opt/letletme/releases
install -d -o root -g letletme -m 0750 /opt/letletme/builds
install -d -o root -g www-data -m 0750 /opt/letletme/static
install -d -o letletme -g letletme -m 0750 /var/cache/letletme-next
printf '%s\n' 'LETLETME_RELEASE_SHA=development' | install -o root -g root -m 0644 \
	/dev/stdin /etc/letletme/release.env

install -o root -g root -m 0644 \
	"$ops_dir/systemd/letletme-web.service" \
	/etc/systemd/system/letletme-web.service
install -o root -g root -m 0644 \
	"$ops_dir/nginx/letletme.conf" \
	/etc/nginx/sites-available/letletme
ln -sfn /etc/nginx/sites-available/letletme /etc/nginx/sites-enabled/letletme
rm -f /etc/nginx/sites-enabled/default
systemctl daemon-reload
systemctl enable letletme-web.service nginx.service

echo "Host prerequisites installed. Add web.env, TLS material and origin secrets before starting services."

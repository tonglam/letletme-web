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
apt-get install -y ca-certificates curl git gnupg nginx openssl rsync sudo

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
if ! id deploy >/dev/null 2>&1; then
	useradd --system --create-home --home-dir /home/deploy --shell /bin/bash deploy
fi
install -d -o deploy -g deploy -m 0700 /home/deploy/.ssh
authorized_keys=/home/deploy/.ssh/authorized_keys
if [[ -n ${TENCENT_DEPLOY_PUBLIC_KEY:-} ]]; then
	if [[ ! $TENCENT_DEPLOY_PUBLIC_KEY =~ ^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp[0-9]+)[[:space:]] ]]; then
		echo "TENCENT_DEPLOY_PUBLIC_KEY is not a supported SSH public key" >&2
		exit 1
	fi
	if [[ -e $authorized_keys && ! -f $authorized_keys ]]; then
		echo "deploy authorized_keys path is unsafe" >&2
		exit 1
	fi
	if [[ -f $authorized_keys ]] && [[ $(tr -d '\n' < "$authorized_keys") != "$TENCENT_DEPLOY_PUBLIC_KEY" ]]; then
		echo "deploy authorized_keys already contains a different key" >&2
		exit 1
	fi
	printf '%s\n' "$TENCENT_DEPLOY_PUBLIC_KEY" | install -o deploy -g deploy -m 0600 /dev/stdin "$authorized_keys"
elif [[ ! -s $authorized_keys ]]; then
	echo "set TENCENT_DEPLOY_PUBLIC_KEY on the first host install or provision /home/deploy/.ssh/authorized_keys before enabling automation" >&2
	exit 1
fi

install -d -o root -g letletme -m 0750 /etc/letletme
install -d -o root -g root -m 0700 /etc/letletme/tls
install -d -o root -g root -m 0755 /etc/nginx/snippets
install -d -o root -g root -m 0755 /usr/local/libexec
install -d -o root -g root -m 0755 /usr/local/share/letletme/nginx
install -d -o root -g root -m 0700 /var/lib/letletme
install -d -o root -g letletme -m 0751 /opt/letletme
chmod 0751 /opt/letletme
install -d -o root -g letletme -m 0750 /opt/letletme/releases
install -d -o root -g letletme -m 0750 /opt/letletme/builds
install -d -o root -g www-data -m 0751 /opt/letletme/static-releases
chmod 0751 /opt/letletme/static-releases
install -d -o root -g root -m 0755 /var/cache/letletme-next
release_env=/etc/letletme/release.env
if [[ -L $release_env || -e $release_env && ! -f $release_env ]]; then
	echo "release environment path is unsafe: $release_env" >&2
	exit 1
fi
if [[ ! -e $release_env ]]; then
	printf '%s\n' 'LETLETME_RELEASE_SHA=development' | install -o root -g root -m 0644 \
		/dev/stdin "$release_env"
fi

install -o root -g root -m 0644 \
	"$ops_dir/systemd/letletme-web.service" \
	/etc/systemd/system/letletme-web.service
install -o root -g root -m 0644 \
	"$ops_dir/nginx/letletme.conf" \
	/etc/nginx/sites-available/letletme
install -o root -g root -m 0644 \
	"$ops_dir/nginx/letletme.conf" \
	/usr/local/share/letletme/nginx/letletme.conf
install -o root -g root -m 0644 \
	"$ops_dir/nginx/letletme-origin-auth.conf.template" \
	/usr/local/share/letletme/nginx/letletme-origin-auth.conf.template
static_try_files=/etc/nginx/snippets/letletme-static-try-files.conf
if [[ -L $static_try_files || -e $static_try_files && ! -f $static_try_files ]]; then
	echo "static try-files path is unsafe: $static_try_files" >&2
	exit 1
fi
if [[ ! -e $static_try_files ]]; then
	install -o root -g www-data -m 0640 /dev/null "$static_try_files"
fi
ln -sfn /etc/nginx/sites-available/letletme /etc/nginx/sites-enabled/letletme
rm -f /etc/nginx/sites-enabled/default

install -o root -g root -m 0750 \
	"$script_dir/deploy-release.sh" /usr/local/libexec/letletme-deploy-release.sh
install -o root -g root -m 0750 \
	"$script_dir/activate-release.sh" /usr/local/libexec/letletme-activate-release.sh
install -o root -g root -m 0750 \
	"$script_dir/rollback-release.sh" /usr/local/libexec/letletme-rollback-release.sh
install -o root -g root -m 0750 \
	"$script_dir/render-nginx-config.sh" /usr/local/libexec/render-nginx-config.sh
install -o root -g root -m 0750 \
	"$script_dir/verify-staged-release.sh" /usr/local/libexec/letletme-verify-staged-release.sh
install -o root -g root -m 0750 \
	"$script_dir/cleanup-release.sh" /usr/local/libexec/letletme-cleanup-release.sh
install -o root -g root -m 0755 \
	"$script_dir/letletme-release-wrapper.sh" /usr/local/libexec/letletme-release
install -o root -g root -m 0440 /dev/stdin /etc/sudoers.d/letletme-release <<'EOF'
Defaults:deploy !setenv
deploy ALL=(root) NOPASSWD: /usr/local/libexec/letletme-release
EOF
visudo --check --file=/etc/sudoers.d/letletme-release
systemctl daemon-reload
systemctl enable letletme-web.service nginx.service

echo "Host prerequisites installed. Add web.env, TLS material and origin secrets before starting services."

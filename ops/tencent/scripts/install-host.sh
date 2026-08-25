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
apt-get install -y ca-certificates curl git gnupg nginx openssl python3 rsync sudo

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
deploy_uid=$(id -u deploy)
deploy_gid=$(id -g deploy)
if [[ -n ${TENCENT_DEPLOY_PUBLIC_KEY:-} ]]; then
	if [[ ! $TENCENT_DEPLOY_PUBLIC_KEY =~ ^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp[0-9]+)[[:space:]] ]]; then
		echo "TENCENT_DEPLOY_PUBLIC_KEY is not a supported SSH public key" >&2
		exit 1
	fi
fi
export LETLETME_DEPLOY_PUBLIC_KEY=${TENCENT_DEPLOY_PUBLIC_KEY:-}
export LETLETME_DEPLOY_UID=$deploy_uid
export LETLETME_DEPLOY_GID=$deploy_gid
python3 - <<'PY'
import errno
import os
import stat

uid = int(os.environ['LETLETME_DEPLOY_UID'])
gid = int(os.environ['LETLETME_DEPLOY_GID'])
expected_key = os.environ.get('LETLETME_DEPLOY_PUBLIC_KEY', '')
flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW


def fail(message):
	print(message, file=os.sys.stderr)
	raise SystemExit(1)


def open_authorized_keys(ssh_fd):
	try:
		return os.open('authorized_keys', os.O_RDWR | os.O_NOFOLLOW, dir_fd=ssh_fd)
	except FileNotFoundError:
		if not expected_key:
			fail('set TENCENT_DEPLOY_PUBLIC_KEY on the first host install or provision /home/deploy/.ssh/authorized_keys before enabling automation')
		try:
			fd = os.open(
				'authorized_keys',
				os.O_RDWR | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
				0o600,
				dir_fd=ssh_fd,
			)
		except OSError as error:
			if error.errno == errno.ELOOP:
				fail('deploy authorized_keys path is a symlink')
			raise
		os.fchown(fd, uid, gid)
		os.fchmod(fd, 0o600)
		os.write(fd, (expected_key + '\n').encode())
		return fd


home_fd = None
deploy_fd = None
ssh_fd = None
authorized_fd = None
try:
	home_fd = os.open('/home', flags)
	deploy_fd = os.open('deploy', flags, dir_fd=home_fd)
	try:
		ssh_fd = os.open('.ssh', flags, dir_fd=deploy_fd)
	except FileNotFoundError:
		try:
			os.mkdir('.ssh', 0o700, dir_fd=deploy_fd)
			ssh_fd = os.open('.ssh', flags, dir_fd=deploy_fd)
		except OSError as error:
			if error.errno in (errno.ELOOP, errno.EEXIST):
				fail('deploy SSH directory changed to an unsafe path')
			raise

	ssh_stat = os.fstat(ssh_fd)
	if not stat.S_ISDIR(ssh_stat.st_mode):
		fail('deploy SSH path is not a directory')
	os.fchown(ssh_fd, uid, gid)
	os.fchmod(ssh_fd, 0o700)

	authorized_fd = open_authorized_keys(ssh_fd)
	authorized_stat = os.fstat(authorized_fd)
	if not stat.S_ISREG(authorized_stat.st_mode):
		fail('deploy authorized_keys path is not a regular file')
	data = os.pread(authorized_fd, 1024 * 1024, 0).decode()
	if expected_key:
		if data.replace('\n', '') != expected_key:
			fail('deploy authorized_keys already contains a different key')
	elif not data:
		fail('deploy authorized_keys is empty')
	os.fchown(authorized_fd, uid, gid)
	os.fchmod(authorized_fd, 0o600)
except OSError as error:
	if error.errno == errno.ELOOP:
		fail('deploy SSH or authorized_keys path is a symlink')
	raise
finally:
	for fd in (authorized_fd, ssh_fd, deploy_fd, home_fd):
		if fd is not None:
			os.close(fd)
PY
unset LETLETME_DEPLOY_PUBLIC_KEY LETLETME_DEPLOY_UID LETLETME_DEPLOY_GID

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
install -o root -g root -m 0750 \
	"$script_dir/auth-event-cleanup.sh" /usr/local/libexec/letletme-auth-event-cleanup.sh
install -o root -g root -m 0755 \
	"$script_dir/letletme-release-wrapper.sh" /usr/local/libexec/letletme-release
install -o root -g root -m 0644 \
	"$ops_dir/systemd/letletme-auth-event-cleanup.service" \
	/etc/systemd/system/letletme-auth-event-cleanup.service
install -o root -g root -m 0644 \
	"$ops_dir/systemd/letletme-auth-event-cleanup.timer" \
	/etc/systemd/system/letletme-auth-event-cleanup.timer
install -o root -g root -m 0440 /dev/stdin /etc/sudoers.d/letletme-release <<'EOF'
Defaults:deploy !setenv
deploy ALL=(root) NOPASSWD: /usr/local/libexec/letletme-release
EOF
visudo --check --file=/etc/sudoers.d/letletme-release
systemctl daemon-reload
systemctl enable letletme-web.service nginx.service
systemctl enable --now letletme-auth-event-cleanup.timer

echo "Host prerequisites installed. Add web.env, TLS material and origin secrets before starting services."

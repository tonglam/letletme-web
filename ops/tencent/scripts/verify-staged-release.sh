#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
	echo "run as root" >&2
	exit 1
fi
if [[ $# -ne 1 || ! $1 =~ ^[a-f0-9]{40}$ ]]; then
	echo "usage: $0 <40-char-git-sha>" >&2
	exit 1
fi

release_sha=$1
release_dir=/opt/letletme/releases/$release_sha
verify_port=3101
pid=''
log_file=/tmp/letletme-verify-$release_sha.log

if [[ ! -d $release_dir || -L $release_dir || ! -f $release_dir/server.js || ! -d $release_dir/.next ]]; then
	echo "staged release is incomplete: $release_dir" >&2
	exit 1
fi
if [[ ! -d /opt/letletme/static-releases/$release_sha || -L /opt/letletme/static-releases/$release_sha ]]; then
	echo "staged static release is incomplete: /opt/letletme/static-releases/$release_sha" >&2
	exit 1
fi

cleanup() {
	if [[ -n $pid ]]; then
		kill "$pid" 2>/dev/null || true
		for _ in $(seq 1 20); do
			if ! kill -0 "$pid" 2>/dev/null; then break; fi
			sleep 0.25
		done
		kill -KILL "$pid" 2>/dev/null || true
		wait "$pid" 2>/dev/null || true
	fi
	rm -f -- "$log_file"
}
trap cleanup EXIT

# Keep the real host environment, including the secrets required by server
# startup, while overriding only the release identity and loopback port.
set -a
# shellcheck disable=SC1091
source /etc/letletme/web.env
set +a
export NODE_ENV=production
export HOSTNAME=127.0.0.1
export PORT=$verify_port
export LETLETME_ORIGIN=tencent
export LETLETME_RELEASE_SHA=$release_sha
export NEXT_DEPLOYMENT_ID=${release_sha:0:32}
export NODE_OPTIONS=--max-old-space-size=768

runuser --user letletme --preserve-environment -- \
	/usr/bin/node "$release_dir/server.js" \
	>"$log_file" 2>&1 &
pid=$!

for _ in $(seq 1 45); do
	if headers=$(curl --fail --silent --show-error --max-time 3 \
		--dump-header - "http://127.0.0.1:$verify_port/healthz" 2>/dev/null); then
		if grep -qi "^X-Letletme-Release: $release_sha" <<<"$headers"; then
			echo "staged release $release_sha passed isolated health verification"
			exit 0
		fi
	fi
	sleep 1
done

echo "staged release $release_sha failed isolated health verification" >&2
sed -n '1,120p' "$log_file" >&2 || true
exit 1

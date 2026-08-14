#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
	echo "run as root" >&2
	exit 1
fi
if [[ $# -ne 2 || ! $2 =~ ^[a-f0-9]{40}$ ]]; then
	echo "usage: $0 <source-directory> <40-char-git-sha>" >&2
	exit 1
fi

source_dir=$(realpath "$1")
release_sha=$2
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
release_root=/opt/letletme/releases
release_dir=$release_root/$release_sha
build_root=/opt/letletme/builds
build_dir=$build_root/$release_sha
current_link=/opt/letletme/current
previous_release=$(readlink -f "$current_link" 2>/dev/null || true)

for required in package.json package-lock.json next.config.js; do
	if [[ ! -f $source_dir/$required ]]; then
		echo "missing $source_dir/$required" >&2
		exit 1
	fi
done
for required in \
	/etc/letletme/web.env \
	/etc/letletme/origin-token \
	/etc/letletme/local-proxy-secret \
	/etc/letletme/tls/origin.pem \
	/etc/letletme/tls/origin-key.pem; do
	if [[ ! -f $required ]]; then
		echo "missing $required" >&2
		exit 1
	fi
done
if [[ -e $release_dir ]]; then
	echo "release already exists: $release_dir" >&2
	exit 1
fi

install -d -o root -g letletme -m 0750 "$build_dir"
rsync -a --delete \
	--exclude .git \
	--exclude .next \
	--exclude node_modules \
	--exclude '.env*.local' \
	"$source_dir/" "$build_dir/"
install -o root -g root -m 0600 /etc/letletme/web.env \
	"$build_dir/.env.production.local"

cleanup_build() {
	if [[ $build_dir == "$build_root/"* && -d $build_dir ]]; then
		rm -rf -- "$build_dir"
	fi
}
trap cleanup_build EXIT

(
	cd "$build_dir"
	export NODE_ENV=production
	export LETLETME_ORIGIN=tencent
	export LETLETME_RELEASE_SHA=$release_sha
	export NEXT_DEPLOYMENT_ID=${release_sha:0:32}
	export NODE_OPTIONS=--max-old-space-size=1536
	npm ci
	npm run build
	node -e 'const f=require("./.next/required-server-files.json"); if(f.config.deploymentId !== process.env.LETLETME_RELEASE_SHA.slice(0, 32)) process.exit(1)'
)

stage_dir=$(mktemp -d "$release_root/.staging-$release_sha.XXXXXX")
rsync -a "$build_dir/.next/standalone/" "$stage_dir/"
install -d -m 0750 "$stage_dir/.next"
rsync -a "$build_dir/.next/static/" "$stage_dir/.next/static/"
if [[ -d $build_dir/public ]]; then
	rsync -a "$build_dir/public/" "$stage_dir/public/"
fi
find "$stage_dir" -maxdepth 1 -type f -name '.env*' -delete

cache_dir=/var/cache/letletme-next/$release_sha
install -d -o letletme -g letletme -m 0750 "$cache_dir"
rm -rf -- "$stage_dir/.next/cache"
ln -s "$cache_dir" "$stage_dir/.next/cache"
chown -R root:letletme "$stage_dir"
chmod -R u=rwX,g=rX,o= "$stage_dir"
mv -- "$stage_dir" "$release_dir"

rsync -a --ignore-existing "$release_dir/.next/static/" /opt/letletme/static/
chown -R root:www-data /opt/letletme/static
chmod -R u=rwX,g=rX,o= /opt/letletme/static

next_link=$current_link.next
ln -s "$release_dir" "$next_link"
mv -Tf "$next_link" "$current_link"
printf 'LETLETME_RELEASE_SHA=%s\n' "$release_sha" | install -o root -g root -m 0644 \
	/dev/stdin /etc/letletme/release.env
systemctl restart letletme-web.service

healthy=0
for _ in $(seq 1 45); do
	if health_headers=$(curl --fail --silent --show-error --max-time 3 \
		--dump-header - http://127.0.0.1:3000/healthz 2>/dev/null); then
		if grep -qi "^X-Letletme-Release: $release_sha" <<<"$health_headers"; then
			healthy=1
			break
		fi
	fi
	sleep 1
done

if [[ $healthy -ne 1 ]]; then
	echo "new release failed health verification; rolling back" >&2
	if [[ -n $previous_release && -d $previous_release ]]; then
		ln -s "$previous_release" "$next_link"
		mv -Tf "$next_link" "$current_link"
		printf 'LETLETME_RELEASE_SHA=%s\n' "$(basename "$previous_release")" | \
			install -o root -g root -m 0644 /dev/stdin /etc/letletme/release.env
		systemctl restart letletme-web.service
		"$script_dir/render-nginx-config.sh" "$(basename "$previous_release")"
	fi
	exit 1
fi

"$script_dir/render-nginx-config.sh" "$release_sha"
echo "deployed release $release_sha"
if [[ -n $previous_release ]]; then
	echo "rollback release retained at $previous_release"
fi

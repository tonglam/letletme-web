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
previous_release=''
if [[ -L $current_link ]]; then
	previous_release=$(readlink -e "$current_link" 2>/dev/null || true)
fi
activation_started=0
deployment_succeeded=0
rollback_in_progress=0

if ! git -C "$source_dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
	echo "source directory is not a Git worktree: $source_dir" >&2
	exit 1
fi
repo_root=$(realpath "$(git -C "$source_dir" rev-parse --show-toplevel)")
if [[ $repo_root != "$source_dir" ]]; then
	echo "source directory must be the Git worktree root: $repo_root" >&2
	exit 1
fi
checkout_sha=$(git -C "$source_dir" rev-parse HEAD)
if [[ $checkout_sha != "$release_sha" ]]; then
	echo "checkout HEAD $checkout_sha does not match release SHA $release_sha" >&2
	exit 1
fi
if [[ -n $(git -C "$source_dir" status --porcelain=v1 --untracked-files=all) ]]; then
	echo "source checkout is dirty: $source_dir" >&2
	exit 1
fi

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
if [[ -e $build_dir ]]; then
	echo "build directory already exists: $build_dir" >&2
	exit 1
fi

install -d -o root -g letletme -m 0750 "$build_dir"
git -C "$source_dir" archive --format=tar "$release_sha" | \
	tar -xf - -C "$build_dir"
install -o root -g root -m 0600 /etc/letletme/web.env \
	"$build_dir/.env.production.local"

stage_dir=''
rollback_activation() {
	if [[ $activation_started != 1 || $deployment_succeeded == 1 || $rollback_in_progress == 1 ]]; then
		return 0
	fi
	rollback_in_progress=1
	echo "activation failed; rolling back release" >&2
	current_target=$(readlink -f "$current_link" 2>/dev/null || true)
	if [[ -n $previous_release && -d $previous_release ]]; then
		if [[ $current_target == "$release_dir" ]]; then
			rollback_link=$current_link.rollback
			rm -f -- "$rollback_link"
			ln -s "$previous_release" "$rollback_link" || true
			mv -Tf "$rollback_link" "$current_link" || true
		fi
		printf 'LETLETME_RELEASE_SHA=%s\n' "$(basename "$previous_release")" | \
			install -o root -g root -m 0644 /dev/stdin /etc/letletme/release.env || true
		systemctl restart letletme-web.service || true
		"$script_dir/render-nginx-config.sh" "$(basename "$previous_release")" || true
	else
		if [[ $current_target == "$release_dir" ]]; then
			rm -f -- "$current_link"
		fi
		printf '%s\n' 'LETLETME_RELEASE_SHA=development' | \
			install -o root -g root -m 0644 /dev/stdin /etc/letletme/release.env || true
		systemctl stop letletme-web.service || true
		rm -f -- /etc/nginx/conf.d/letletme-origin-auth.conf
	fi
}

cleanup_build() {
	rollback_activation
	if [[ $build_dir == "$build_root/"* && -d $build_dir ]]; then
		rm -rf -- "$build_dir"
	fi
	if [[ $stage_dir == "$release_root/.staging-$release_sha."* && -d $stage_dir ]]; then
		rm -rf -- "$stage_dir"
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
	npm ci --include=dev
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
activation_started=1
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
	echo "new release failed health verification" >&2
	exit 1
fi

"$script_dir/render-nginx-config.sh" "$release_sha"
deployment_succeeded=1
echo "deployed release $release_sha"
if [[ -n $previous_release ]]; then
	echo "rollback release retained at $previous_release"
fi

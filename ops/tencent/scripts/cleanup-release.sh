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
static_dir=/opt/letletme/static-releases/$release_sha
cache_dir=/var/cache/letletme-next/$release_sha
build_dir=/opt/letletme/builds/$release_sha
exec 9>/run/lock/letletme-web-deploy.lock
if ! flock -n 9; then
	echo "another Web release is already being deployed" >&2
	exit 1
fi
current=$(readlink -e /opt/letletme/current 2>/dev/null || true)
previous=$(readlink -e /opt/letletme/previous 2>/dev/null || true)

for active in "$current" "$previous"; do
	if [[ $active == "$release_dir" ]]; then
		echo "refusing to remove active or rollback release $release_sha" >&2
		exit 1
	fi
done

if [[ -L $release_dir || -L $static_dir || -L $cache_dir || -L $build_dir ]]; then
	echo "refusing to remove symlinked release artifact $release_sha" >&2
	exit 1
fi

removed=0
for target in "$release_dir" "$static_dir" "$cache_dir" "$build_dir"; do
	if [[ -e $target ]]; then
		rm -rf -- "$target"
		removed=1
	fi
done
if [[ $removed == 1 ]]; then
	echo "cleaned unactivated release $release_sha"
else
	echo "unactivated release $release_sha was already clean"
fi

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
release_root=/opt/letletme/releases
release_dir=$release_root/$release_sha
current_link=/opt/letletme/current
previous_link=/opt/letletme/previous
release_env=/etc/letletme/release.env
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

if [[ ! -d $release_dir || -L $release_dir ]]; then
	echo "staged release is missing or is a symlink: $release_dir" >&2
	exit 1
fi
if [[ ! -f $release_dir/server.js || ! -d $release_dir/.next ]]; then
	echo "staged release is incomplete: $release_dir" >&2
	exit 1
fi
if [[ ! -d /opt/letletme/static-releases/$release_sha || -L /opt/letletme/static-releases/$release_sha ]]; then
	echo "staged static release is missing: /opt/letletme/static-releases/$release_sha" >&2
	exit 1
fi

exec 9>/run/lock/letletme-web-deploy.lock
if ! flock -n 9; then
	echo "another Web release is already being deployed" >&2
	exit 1
fi

old_current=$(readlink -e "$current_link" 2>/dev/null || true)
old_previous=$(readlink -e "$previous_link" 2>/dev/null || true)
old_release_sha=development
if [[ -n $old_current && $old_current == "$release_root/"* ]]; then
	old_release_sha=$(basename "$old_current")
fi
activated=0
succeeded=0

restore_previous() {
	if [[ $succeeded == 1 ]]; then return 0; fi
	echo "activation failed; restoring previous release" >&2
	if [[ $activated == 1 ]]; then
		if [[ -n $old_current && -d $old_current ]]; then
			rollback_link=$current_link.rollback
			rm -f -- "$rollback_link"
			ln -s "$old_current" "$rollback_link" || true
			mv -Tf "$rollback_link" "$current_link" || true
		else
			rm -f -- "$current_link"
		fi
	fi
	if [[ -n $old_previous && -d $old_previous ]]; then
		previous_next=$previous_link.rollback
		rm -f -- "$previous_next"
		ln -s "$old_previous" "$previous_next" || true
		mv -Tf "$previous_next" "$previous_link" || true
	else
		rm -f -- "$previous_link"
	fi
	printf 'LETLETME_RELEASE_SHA=%s\n' "$old_release_sha" | \
		install -o root -g root -m 0644 /dev/stdin "$release_env" || true
	if [[ -n $old_current && -d $old_current ]]; then
		systemctl restart letletme-web.service || true
		"$script_dir/render-nginx-config.sh" "$old_release_sha" || true
	else
		systemctl stop letletme-web.service || true
	fi
}
trap restore_previous EXIT

if [[ $old_current == "$release_dir" ]]; then
	echo "release $release_sha is already active"
	"$script_dir/render-nginx-config.sh" "$release_sha"
	for _ in $(seq 1 45); do
		if curl --fail --silent --show-error --max-time 3 \
			--dump-header - http://127.0.0.1:3000/healthz 2>/dev/null |
			grep -qi "^X-Letletme-Release: $release_sha"; then
			succeeded=1
			exit 0
		fi
		sleep 1
	done
	echo "active release failed health verification" >&2
	exit 1
fi

next_link=$current_link.next
rm -f -- "$next_link"
ln -s "$release_dir" "$next_link"
mv -Tf "$next_link" "$current_link"
activated=1
printf 'LETLETME_RELEASE_SHA=%s\n' "$release_sha" | \
	install -o root -g root -m 0644 /dev/stdin "$release_env"
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
	echo "release $release_sha failed health verification" >&2
	exit 1
fi

"$script_dir/render-nginx-config.sh" "$release_sha"
if [[ -n $old_current && $old_current != "$release_dir" ]]; then
	previous_next=$previous_link.next
	rm -f -- "$previous_next"
	ln -s "$old_current" "$previous_next"
	mv -Tf "$previous_next" "$previous_link"
fi
succeeded=1
echo "activated release $release_sha"
if [[ -n $old_current ]]; then echo "rollback release retained at $old_current"; fi

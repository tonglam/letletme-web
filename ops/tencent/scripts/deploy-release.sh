#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
	echo "run as root" >&2
	exit 1
fi
if [[ $# -lt 2 || $# -gt 3 || ! $2 =~ ^[a-f0-9]{40}$ ]]; then
	echo "usage: $0 <source-directory> <40-char-git-sha> [stage|activate]" >&2
	exit 1
fi

source_dir=$(realpath "$1")
release_sha=$2
mode=${3:-activate}
if [[ $mode != stage && $mode != activate ]]; then
	echo "mode must be stage or activate" >&2
	exit 1
fi
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
release_root=/opt/letletme/releases
release_dir=$release_root/$release_sha
static_root=/opt/letletme/static-releases
static_release_dir=$static_root/$release_sha
build_root=/opt/letletme/builds
build_dir=$build_root/$release_sha
current_link=/opt/letletme/current
previous_link=/opt/letletme/previous
exec 9>/run/lock/letletme-web-deploy.lock
if ! flock -n 9; then
	echo "another Web release is already being deployed" >&2
	exit 1
fi
previous_release=''
if [[ -L $current_link ]]; then
	previous_release=$(readlink -e "$current_link" 2>/dev/null || true)
fi
old_previous_release=$(readlink -e "$previous_link" 2>/dev/null || true)
activation_started=0
deployment_succeeded=0
rollback_in_progress=0
cache_dir=""
cache_dir_created=0
cache_parent=/var/cache/letletme-next
release_retention_seconds=$((24 * 60 * 60))

source_is_git=0
if git -C "$source_dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
	source_is_git=1
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
else
	marker="$source_dir/.letletme-release-sha"
	if [[ ! -f $marker ]]; then
		echo "source directory is neither a clean Git worktree nor an exact release archive: $source_dir" >&2
		exit 1
	fi
	checkout_sha=$(tr -d '[:space:]' < "$marker")
	if [[ $checkout_sha != "$release_sha" ]]; then
		echo "release archive marker $checkout_sha does not match release SHA $release_sha" >&2
		exit 1
	fi
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
local_proxy_secret=$(< /etc/letletme/local-proxy-secret)
configured_proxy_secret=$(sed -n 's/^LETLETME_LOCAL_PROXY_SECRET=//p' /etc/letletme/web.env)
configured_previous_proxy_secret=$(sed -n 's/^LETLETME_LOCAL_PROXY_SECRET_PREVIOUS=//p' /etc/letletme/web.env)
if [[ -z $local_proxy_secret || $configured_proxy_secret != "$local_proxy_secret" ]]; then
	echo "web.env local proxy secret does not match /etc/letletme/local-proxy-secret" >&2
	exit 1
fi
if [[ -n $configured_previous_proxy_secret && $configured_previous_proxy_secret == "$configured_proxy_secret" ]]; then
	echo "previous proxy secret must differ from the active proxy secret" >&2
	exit 1
fi
if [[ -e $release_dir ]]; then
	echo "release already exists: $release_dir" >&2
	exit 1
fi
if [[ -e $build_dir ]]; then
	echo "build directory already exists: $build_dir" >&2
	exit 1
fi
if [[ -e $static_release_dir ]]; then
	echo "static release already exists: $static_release_dir" >&2
	exit 1
fi

if [[ -L /opt/letletme || ! -d /opt/letletme ]]; then
	echo "Web root must be a real directory: /opt/letletme" >&2
	exit 1
fi
if [[ -L $static_root ]]; then
	echo "static root must not be a symlink: $static_root" >&2
	exit 1
fi
install -d -o root -g www-data -m 0751 "$static_root"
chown root:letletme /opt/letletme
chmod 0751 /opt/letletme
chown root:www-data "$static_root"
chmod 0751 "$static_root"

install -d -o letletme -g letletme -m 0700 "$build_dir"
if [[ $source_is_git == 1 ]]; then
	git -C "$source_dir" archive --format=tar "$release_sha" | \
		tar -xf - -C "$build_dir"
else
	tar -cf - -C "$source_dir" . | tar -xf - -C "$build_dir"
fi
chown -R letletme:letletme "$build_dir"

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
	if [[ -n $old_previous_release && -d $old_previous_release ]]; then
		previous_rollback_link=$previous_link.rollback
		rm -f -- "$previous_rollback_link"
		ln -s "$old_previous_release" "$previous_rollback_link" || true
		mv -Tf "$previous_rollback_link" "$previous_link" || true
	else
		rm -f -- "$previous_link"
	fi
}

cleanup_build() {
	rollback_activation
	if [[ $deployment_succeeded != 1 && $release_dir == "$release_root/"* && -d $release_dir && ! -L $release_dir ]]; then
		current_target_after_rollback=$(readlink -e "$current_link" 2>/dev/null || true)
		if [[ $current_target_after_rollback != "$release_dir" ]]; then
			rm -rf -- "$release_dir"
		fi
	fi
	if [[ $build_dir == "$build_root/"* && -d $build_dir ]]; then
		rm -rf -- "$build_dir"
	fi
	if [[ $stage_dir == "$release_root/.staging-$release_sha."* && -d $stage_dir ]]; then
		rm -rf -- "$stage_dir"
	fi
	if [[ $cache_dir_created == 1 && $deployment_succeeded != 1 && $cache_dir == "$cache_parent/"* && -d $cache_dir && ! -L $cache_dir ]]; then
		rm -rf -- "$cache_dir"
	fi
	if [[ $deployment_succeeded != 1 && $static_release_dir == "$static_root/"* && -d $static_release_dir && ! -L $static_release_dir ]]; then
		rm -rf -- "$static_release_dir"
	fi
}
trap cleanup_build EXIT

(
	# This is a root-owned, mode-0600 host configuration file.
	# shellcheck disable=SC1091
	source /etc/letletme/web.env
	export NODE_ENV=production
	export LETLETME_ORIGIN=tencent
	export LETLETME_RELEASE_SHA=$release_sha
	export NEXT_DEPLOYMENT_ID=${release_sha:0:32}
	export NODE_OPTIONS=--max-old-space-size=1536
	export LETLETME_BUILD_DIR=$build_dir
	export HOME=$build_dir/.home
	export npm_config_cache=$build_dir/.npm-cache
	install -d -o letletme -g letletme -m 0700 "$HOME" "$npm_config_cache"
	build_env_file=$(mktemp "/run/letletme-build-env-$release_sha.XXXXXX")
	cleanup_build_env() {
		if [[ -n ${build_env_file:-} && $build_env_file == /run/letletme-build-env-$release_sha.* ]]; then
			rm -f -- "$build_env_file"
		fi
	}
	trap cleanup_build_env EXIT
	chmod 0600 "$build_env_file"
	write_build_env() {
		local build_key=$1
		local build_value=$2
		printf 'export %s=%q\n' "$build_key" "$build_value"
	}
	{
		write_build_env PATH "${PATH:-/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin}"
		write_build_env HOME "$HOME"
		write_build_env npm_config_cache "$npm_config_cache"
		write_build_env NODE_ENV "$NODE_ENV"
		write_build_env NODE_OPTIONS "$NODE_OPTIONS"
		write_build_env LETLETME_ORIGIN "$LETLETME_ORIGIN"
		write_build_env LETLETME_RELEASE_SHA "$LETLETME_RELEASE_SHA"
		write_build_env NEXT_DEPLOYMENT_ID "$NEXT_DEPLOYMENT_ID"
		write_build_env LETLETME_BUILD_DIR "$LETLETME_BUILD_DIR"
		for build_key in \
			NEXT_PUBLIC_APP_URL \
			NEXT_PUBLIC_SUPABASE_URL \
			NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE \
			BETTER_AUTH_URL \
			NEXT_SERVER_ACTIONS_ENCRYPTION_KEY \
			LETLETME_LOCAL_PROXY_SECRET \
			LETLETME_LOCAL_PROXY_SECRET_PREVIOUS; do
			if [[ -n ${!build_key-} ]]; then
				write_build_env "$build_key" "${!build_key}"
			fi
		done
	} > "$build_env_file"
	chown letletme:letletme "$build_env_file"
	cd -- "$build_dir"
	runuser --user letletme -- /usr/bin/env -i /bin/bash --noprofile --norc -c '
		set -euo pipefail
		# shellcheck disable=SC1090
		source "$1"
		cd -- "$LETLETME_BUILD_DIR"
		npm ci --include=dev
		npm run build
	' letletme-build "$build_env_file"
	rm -f -- "$build_env_file"
	build_env_file=''
	trap - EXIT
	node -e 'const f=require("./.next/required-server-files.json"); if(f.config.deploymentId !== process.env.LETLETME_RELEASE_SHA.slice(0, 32)) process.exit(1)'
)

stage_dir=$(mktemp -d "$release_root/.staging-$release_sha.XXXXXX")
rsync -a "$build_dir/.next/standalone/" "$stage_dir/"
install -d -m 0750 "$stage_dir/.next"
rsync -a "$build_dir/.next/static/" "$stage_dir/.next/static/"
if [[ -d $build_dir/public ]]; then
	rsync -a "$build_dir/public/" "$stage_dir/public/"
fi
template_dir=$source_dir/ops/tencent/nginx
for template_name in letletme.conf letletme-origin-auth.conf.template; do
	if [[ ! -f $template_dir/$template_name ]]; then
		echo "missing release Nginx template: $template_dir/$template_name" >&2
		exit 1
	fi
done
install -d -m 0750 "$stage_dir/ops/tencent/nginx"
install -o root -g root -m 0644 "$template_dir/letletme.conf" \
	"$stage_dir/ops/tencent/nginx/letletme.conf"
install -o root -g root -m 0644 "$template_dir/letletme-origin-auth.conf.template" \
	"$stage_dir/ops/tencent/nginx/letletme-origin-auth.conf.template"
find "$stage_dir" -maxdepth 1 -type f -name '.env*' -delete

if [[ -L $cache_parent || ! -d $cache_parent ]]; then
	echo "cache parent must be a real directory: $cache_parent" >&2
	exit 1
fi
chown root:root "$cache_parent"
chmod 0755 "$cache_parent"
cache_dir=$cache_parent/$release_sha
if [[ -L $cache_dir ]]; then
	echo "cache directory must not be a symlink: $cache_dir" >&2
	exit 1
fi
if [[ -e $cache_dir ]]; then
	echo "cache directory already exists: $cache_dir" >&2
	exit 1
fi
# Mark it before creation so a partially-created directory is removed too.
cache_dir_created=1
install -d -o letletme -g letletme -m 0750 "$cache_dir"
rm -rf -- "$stage_dir/.next/cache"
ln -s "$cache_dir" "$stage_dir/.next/cache"
chown -R root:letletme "$stage_dir"
chmod -R u=rwX,g=rX,o= "$stage_dir"
mv -- "$stage_dir" "$release_dir"

install -d -o root -g www-data -m 0750 "$static_release_dir"
rsync -a "$release_dir/.next/static/" "$static_release_dir/"
chown -R root:www-data "$static_release_dir"
chmod -R u=rwX,g=rX,o= "$static_release_dir"

if [[ $mode == stage ]]; then
	deployment_succeeded=1
	echo "staged release $release_sha"
	exit 0
fi

next_link=$current_link.next
ln -s "$release_dir" "$next_link"
mv -Tf "$next_link" "$current_link"
activation_started=1
if [[ -n $previous_release && $previous_release != "$release_dir" ]]; then
	previous_next=$previous_link.next
	rm -f -- "$previous_next"
	ln -s "$previous_release" "$previous_next"
	mv -Tf "$previous_next" "$previous_link"
fi
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

prune_expired_releases() {
	local now candidate candidate_sha candidate_mtime
	now=$(date +%s)
	for candidate in "$release_root"/*; do
		if [[ ! -d $candidate || -L $candidate ]]; then
			continue
		fi
		candidate_sha=$(basename "$candidate")
		if [[ ! $candidate_sha =~ ^[a-f0-9]{40}$ ]]; then
			continue
		fi
		if [[ $candidate == "$release_dir" || $candidate == "$previous_release" ]]; then
			continue
		fi
		candidate_mtime=$(stat -c '%Y' "$candidate")
		if (( now < candidate_mtime + release_retention_seconds )); then
			continue
		fi
		echo "pruning expired release $candidate"
		rm -rf -- "$candidate" || return 1
		if [[ -d $static_root/$candidate_sha && ! -L $static_root/$candidate_sha ]]; then
			rm -rf -- "$static_root/$candidate_sha" || return 1
		fi
		if [[ -d $cache_parent/$candidate_sha && ! -L $cache_parent/$candidate_sha ]]; then
			rm -rf -- "$cache_parent/$candidate_sha" || return 1
		fi
	done
}

if ! prune_expired_releases; then
	echo "warning: release retention cleanup failed; active release remains deployed" >&2
fi

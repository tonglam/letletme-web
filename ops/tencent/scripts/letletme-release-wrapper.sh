#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
	echo "this wrapper must run through sudo" >&2
	exit 1
fi
if [[ $# -lt 1 ]]; then
	echo "usage: $0 <stage|verify|cleanup|activate|rollback> ..." >&2
	exit 1
fi

script_root=/usr/local/libexec
tooling_revision=20260824-1
case $1 in
version)
	if [[ $# -ne 1 ]]; then
		echo "usage: $0 version" >&2
		exit 1
	fi
	echo "letletme-release-tooling $tooling_revision"
	;;
current)
	if [[ $# -ne 1 ]]; then
		echo "usage: $0 current" >&2
		exit 1
	fi
	if [[ -L /opt/letletme/current ]]; then
		readlink -e /opt/letletme/current 2>/dev/null || true
	fi
	;;
stage)
	if [[ $# -ne 3 || ! $2 =~ ^/tmp/letletme-release-[a-f0-9]{40}$ || ! $3 =~ ^[a-f0-9]{40}$ ]]; then
		echo "usage: $0 stage /tmp/letletme-release-<sha> <40-char-git-sha>" >&2
		exit 1
	fi
	if [[ ! -d $2 || -L $2 || ! -f $2/.letletme-release-sha ]]; then
		echo "release archive is missing or unsafe" >&2
		exit 1
	fi
	archive_owner=$(stat -c '%u' "$2")
	deploy_uid=$(id -u deploy)
	if [[ $archive_owner != "$deploy_uid" ]]; then
		echo "release archive must be owned by deploy" >&2
		exit 1
	fi
	exec "$script_root/letletme-deploy-release.sh" "$2" "$3" stage
	;;
verify)
	if [[ $# -ne 2 || ! $2 =~ ^[a-f0-9]{40}$ ]]; then
		echo "usage: $0 verify <40-char-git-sha>" >&2
		exit 1
	fi
	exec "$script_root/letletme-verify-staged-release.sh" "$2"
	;;
cleanup)
	if [[ $# -ne 2 || ! $2 =~ ^[a-f0-9]{40}$ ]]; then
		echo "usage: $0 cleanup <40-char-git-sha>" >&2
		exit 1
	fi
	exec "$script_root/letletme-cleanup-release.sh" "$2"
	;;
activate)
	if [[ $# -ne 2 || ! $2 =~ ^[a-f0-9]{40}$ ]]; then
		echo "usage: $0 activate <40-char-git-sha>" >&2
		exit 1
	fi
	exec "$script_root/letletme-activate-release.sh" "$2"
	;;
rollback)
	if [[ $# -ne 1 ]]; then
		echo "usage: $0 rollback" >&2
		exit 1
	fi
	exec "$script_root/letletme-rollback-release.sh"
	;;
*)
	echo "unknown release operation: $1" >&2
	exit 1
	;;
esac

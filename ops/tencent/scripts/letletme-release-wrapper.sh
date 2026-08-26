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
tooling_revision=20260826-2
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
	archive=/tmp/letletme-release-$3.tar.gz
	signature=/tmp/letletme-release-$3.sig
	public_key=/etc/letletme/release-signing-public.pem
	if [[ ! -f $archive || -L $archive || ! -f $signature || -L $signature || ! -f $public_key || -L $public_key ]]; then
		echo "signed release archive material is missing or unsafe" >&2
		exit 1
	fi
	if [[ -L /var/lib/letletme || -e /var/lib/letletme && ! -d /var/lib/letletme ]]; then
		echo "release verification root is unsafe" >&2
		exit 1
	fi
	install -d -o root -g root -m 0700 /var/lib/letletme
	verified_archive=$(mktemp /var/lib/letletme/release-archive-$3.XXXXXX)
	verified_signature=$(mktemp /var/lib/letletme/release-signature-$3.XXXXXX)
	verified_source=$(mktemp -d /var/lib/letletme/release-source-$3.XXXXXX)
	cleanup_verified() {
		rm -f -- "$verified_archive" "$verified_signature"
		rm -rf -- "$verified_source"
	}
	trap cleanup_verified EXIT
	install -o root -g root -m 0600 "$archive" "$verified_archive"
	install -o root -g root -m 0600 "$signature" "$verified_signature"
	if ! openssl pkeyutl -verify -rawin -pubin -inkey "$public_key" \
		-in "$verified_archive" -sigfile "$verified_signature" >/dev/null 2>&1; then
		echo "release archive signature verification failed" >&2
		exit 1
	fi
	tar --extract --gzip --no-same-owner --no-same-permissions \
		--file "$verified_archive" --directory "$verified_source"
	marker=$(tr -d '[:space:]' < "$verified_source/.letletme-release-sha")
	if [[ $marker != "$3" ]]; then
		echo "signed release marker does not match requested SHA" >&2
		exit 1
	fi
	archive_owner=$(stat -c '%u' "$2")
	deploy_uid=$(id -u deploy)
	if [[ $archive_owner != "$deploy_uid" ]]; then
		echo "release archive must be owned by deploy" >&2
		exit 1
	fi
	"$script_root/letletme-deploy-release.sh" "$verified_source" "$3" stage
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

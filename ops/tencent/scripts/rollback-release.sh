#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
	echo "run as root" >&2
	exit 1
fi
if [[ $# -gt 1 ]]; then
	echo "usage: $0 [40-char-git-sha]" >&2
	exit 1
fi

release_root=/opt/letletme/releases
previous_link=/opt/letletme/previous
if [[ $# -eq 1 ]]; then
	release_sha=$1
else
	previous=$(readlink -e "$previous_link" 2>/dev/null || true)
	if [[ -z $previous || $previous != "$release_root/"* ]]; then
		echo "no safe previous release is available" >&2
		exit 1
	fi
	release_sha=$(basename "$previous")
fi
if [[ ! $release_sha =~ ^[a-f0-9]{40}$ ]]; then
	echo "rollback release must be a full Git SHA" >&2
	exit 1
fi

exec "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/activate-release.sh" "$release_sha"

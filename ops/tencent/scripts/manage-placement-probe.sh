#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
	echo "run as root" >&2
	exit 1
fi
if [[ $# -ne 1 || ( $1 != enable && $1 != disable && $1 != status ) ]]; then
	echo "usage: $0 <enable|disable|status>" >&2
	exit 1
fi

action=$1
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
probe_source=$(cd -- "$script_dir/../nginx" && pwd)/letletme-placement-probe.conf
probe_target=/etc/nginx/modules-enabled/90-letletme-placement-probe.conf
probe_port=8443

probe_status() {
	printf 'config='
	if [[ -f $probe_target ]]; then
		echo enabled
	else
		echo disabled
	fi
	printf 'listener='
	if ss -lntH "sport = :$probe_port" | grep -q .; then
		echo active
	else
		echo inactive
	fi
	ufw status | grep -F "$probe_port/tcp" || true
}

case $action in
	enable)
		export DEBIAN_FRONTEND=noninteractive
		apt-get update
		apt-get install -y libnginx-mod-stream
		install -o root -g root -m 0644 "$probe_source" "$probe_target"
		if ! nginx -t; then
			rm -f -- "$probe_target"
			nginx -t
			exit 1
		fi
		systemctl reload nginx.service
		if ! ufw status | grep -Fq "$probe_port/tcp"; then
			ufw allow "$probe_port/tcp" comment 'Cloudflare Worker placement probe'
		fi
		probe_status
		;;
	disable)
		if [[ -f $probe_target ]]; then
			rm -f -- "$probe_target"
			nginx -t
			systemctl reload nginx.service
		fi
		if ufw status | grep -Fq "$probe_port/tcp"; then
			ufw --force delete allow "$probe_port/tcp"
		fi
		probe_status
		;;
	status)
		probe_status
		;;
esac

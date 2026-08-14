#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
	echo "run as root" >&2
	exit 1
fi

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
ops_dir=$(cd -- "$script_dir/.." && pwd)

install -d -o root -g root -m 0700 /etc/letletme-redis
install -o root -g root -m 0600 /root/letletme-redis-admin.secret \
	/etc/letletme-redis/admin.secret

install -o root -g root -m 0750 "$script_dir/backup-replica.sh" \
	/usr/local/sbin/letletme-redis-backup
install -o root -g root -m 0750 "$script_dir/restore-check.sh" \
	/usr/local/sbin/letletme-redis-restore-check
install -o root -g root -m 0750 "$script_dir/monitor-replica.sh" \
	/usr/local/sbin/letletme-redis-monitor
for unit in "$ops_dir"/systemd/*; do
	install -o root -g root -m 0644 "$unit" /etc/systemd/system/"$(basename "$unit")"
done
systemctl daemon-reload
systemctl enable --now \
	letletme-redis-backup.timer \
	letletme-redis-restore-check.timer \
	letletme-redis-monitor.timer

systemctl start letletme-redis-monitor.service
systemctl start letletme-redis-backup.service
systemctl start letletme-redis-restore-check.service
echo "Redis backup, restore verification and monitoring timers installed."

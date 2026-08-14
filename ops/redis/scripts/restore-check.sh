#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
	echo "run as root" >&2
	exit 1
fi

exec 9>/run/lock/letletme-redis-restore-check.lock
flock -n 9 || exit 0

backup=$(find /var/backups/letletme-redis/daily -maxdepth 1 -type f \
	-name 'redis-*.rdb' -printf '%p\n' | sort -r | head -n 1)
if [[ -z $backup ]]; then
	echo "no Redis backup is available" >&2
	exit 1
fi

(cd "$(dirname "$backup")" && sha256sum -c "$(basename "$backup").sha256")
redis-check-rdb "$backup" >/dev/null

restore_root=/var/lib/letletme-redis-restore
install -d -o root -g redis -m 0750 "$restore_root"
restore_dir=$(mktemp -d "$restore_root/check.XXXXXX")
chown redis:redis "$restore_dir"
port=16379
restore_password=$(openssl rand -hex 32)
export REDISCLI_AUTH=$restore_password
restore_cli=(redis-cli -h 127.0.0.1 -p "$port" --no-auth-warning)
started=0
cleanup() {
	if [[ $started == 1 ]]; then
		"${restore_cli[@]}" shutdown nosave >/dev/null 2>&1 || true
	fi
	if [[ $restore_dir == "$restore_root/"check.* && -d $restore_dir ]]; then
		rm -rf -- "$restore_dir"
	fi
}
trap cleanup EXIT

if ss -lnt "sport = :$port" | grep -q LISTEN; then
	echo "restore-check port $port is already in use" >&2
	exit 1
fi

install -o redis -g redis -m 0600 "$backup" "$restore_dir/dump.rdb"
backup_bytes=$(stat -c '%s' "$backup")
# Allow a bounded amount of time proportional to the RDB size. Redis returns
# LOADING until the snapshot is usable, so a fixed 30-second window is unsafe
# for a production-sized backup.
load_timeout_seconds=$((60 + (backup_bytes + 67108863) / 67108864 * 10))
if (( load_timeout_seconds > 900 )); then
	load_timeout_seconds=900
fi
config=$restore_dir/redis.conf
{
	printf 'bind 127.0.0.1\n'
	printf 'protected-mode yes\n'
	printf 'port %s\n' "$port"
	printf 'requirepass %s\n' "$restore_password"
	printf 'daemonize yes\n'
	printf 'dir %s\n' "$restore_dir"
	printf 'dbfilename dump.rdb\n'
	printf 'appendonly no\n'
	printf 'save ""\n'
	printf 'pidfile %s/redis.pid\n' "$restore_dir"
	printf 'logfile %s/redis.log\n' "$restore_dir"
} | install -o redis -g redis -m 0600 /dev/stdin "$config"

runuser -u redis -- redis-server "$config"
started=1
ready=0
for ((elapsed = 0; elapsed < load_timeout_seconds; elapsed++)); do
	if "${restore_cli[@]}" PING 2>/dev/null | grep -qx PONG; then
		ready=1
		break
	fi
	if [[ -f $restore_dir/redis.pid ]] && ! kill -0 "$(< "$restore_dir/redis.pid")" 2>/dev/null; then
		echo "Redis restore process exited before becoming ready" >&2
		exit 1
	fi
	sleep 1
done
if [[ $ready != 1 ]]; then
	echo "Redis restore did not become ready within ${load_timeout_seconds}s (RDB bytes=${backup_bytes})" >&2
	exit 1
fi
db0=$("${restore_cli[@]}" -n 0 DBSIZE)
db1=$("${restore_cli[@]}" -n 1 DBSIZE)
[[ $db0 =~ ^[0-9]+$ && $db1 =~ ^[0-9]+$ ]]
echo "Redis restore check passed: backup=$(basename "$backup") db0=$db0 db1=$db1"

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
for _ in $(seq 1 30); do
	"${restore_cli[@]}" PING >/dev/null 2>&1 && break
	sleep 1
done
"${restore_cli[@]}" PING | grep -qx PONG
db0=$("${restore_cli[@]}" -n 0 DBSIZE)
db1=$("${restore_cli[@]}" -n 1 DBSIZE)
[[ $db0 =~ ^[0-9]+$ && $db1 =~ ^[0-9]+$ ]]
echo "Redis restore check passed: backup=$(basename "$backup") db0=$db0 db1=$db1"

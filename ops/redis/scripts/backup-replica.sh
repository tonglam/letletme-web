#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
	echo "run as root" >&2
	exit 1
fi

exec 9>/run/lock/letletme-redis-backup.lock
flock -n 9 || exit 0

backup_root=/var/backups/letletme-redis
daily_dir=$backup_root/daily
weekly_dir=$backup_root/weekly
secret_file=/etc/letletme-redis/admin.secret
install -d -o root -g root -m 0700 "$daily_dir" "$weekly_dir"
export REDISCLI_AUTH=$(< "$secret_file")

redis_cli=(redis-cli -h 127.0.0.1 -p 6379 --no-auth-warning)
"${redis_cli[@]}" BGSAVE >/dev/null
for _ in $(seq 1 120); do
	info=$("${redis_cli[@]}" INFO persistence)
	in_progress=$(sed -n 's/^rdb_bgsave_in_progress://p' <<<"$info" | tr -d '\r')
	status=$(sed -n 's/^rdb_last_bgsave_status://p' <<<"$info" | tr -d '\r')
	if [[ $in_progress == 0 && $status == ok ]]; then
		break
	fi
	sleep 1
done
[[ $in_progress == 0 && $status == ok ]]

redis_dir=$("${redis_cli[@]}" CONFIG GET dir | tail -n 1)
dbfilename=$("${redis_cli[@]}" CONFIG GET dbfilename | tail -n 1)
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
target=$daily_dir/redis-$timestamp.rdb
tmp=$(mktemp "$daily_dir/.redis-$timestamp.XXXXXX")
install -o root -g root -m 0600 "$redis_dir/$dbfilename" "$tmp"
redis-check-rdb "$tmp" >/dev/null
mv -- "$tmp" "$target"
(cd "$daily_dir" && sha256sum "$(basename "$target")" > "$(basename "$target").sha256")
chmod 0600 "$target.sha256"

if [[ $(date -u +%u) == 7 ]]; then
	weekly=$weekly_dir/$(basename "$target")
	ln "$target" "$weekly"
	cp --preserve=mode,timestamps "$target.sha256" "$weekly.sha256"
fi

mapfile -t daily_backups < <(find "$daily_dir" -maxdepth 1 -type f -name 'redis-*.rdb' -printf '%p\n' | sort -r)
for stale in "${daily_backups[@]:7}"; do
	[[ $stale == "$daily_dir/"redis-*.rdb ]]
	rm -f -- "$stale" "$stale.sha256"
done
mapfile -t weekly_backups < <(find "$weekly_dir" -maxdepth 1 -type f -name 'redis-*.rdb' -printf '%p\n' | sort -r)
for stale in "${weekly_backups[@]:4}"; do
	[[ $stale == "$weekly_dir/"redis-*.rdb ]]
	rm -f -- "$stale" "$stale.sha256"
done

echo "redis replica backup created: $target"

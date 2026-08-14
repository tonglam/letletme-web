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
field() {
	local name=$1 input=$2
	sed -n "s/^${name}://p" <<<"$input" | tr -d '\r'
}

replica_is_healthy() {
	local input=$1
	local role link last_io read_only syncing
	role=$(field role "$input")
	link=$(field master_link_status "$input")
	last_io=$(field master_last_io_seconds_ago "$input")
	read_only=$(field slave_read_only "$input")
	syncing=$(field master_sync_in_progress "$input")
	[[ $role == slave &&
		$link == up &&
		$last_io =~ ^[0-9]+$ &&
		$last_io -le 30 &&
		$read_only == 1 &&
		$syncing == 0 ]]
}

replication_before=$("${redis_cli[@]}" INFO replication)
if ! replica_is_healthy "$replication_before"; then
	echo "Redis replica is stale or disconnected; refusing backup" >&2
	exit 1
fi

tmp=''
checksum_tmp=''
cleanup_tmp() {
	if [[ -n $tmp && -f $tmp ]]; then
		rm -f -- "$tmp"
	fi
	if [[ -n $checksum_tmp && -f $checksum_tmp ]]; then
		rm -f -- "$checksum_tmp"
	fi
}
trap cleanup_tmp EXIT

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

replication_after=$("${redis_cli[@]}" INFO replication)
if ! replica_is_healthy "$replication_after"; then
	echo "Redis replica became stale or disconnected; refusing backup" >&2
	exit 1
fi

redis_dir=$("${redis_cli[@]}" CONFIG GET dir | tail -n 1)
dbfilename=$("${redis_cli[@]}" CONFIG GET dbfilename | tail -n 1)
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
target=$daily_dir/redis-$timestamp.rdb
tmp=$(mktemp "$daily_dir/.redis-$timestamp.XXXXXX")
checksum_tmp=$(mktemp "$daily_dir/.redis-$timestamp.XXXXXX.sha256")
install -o root -g root -m 0600 "$redis_dir/$dbfilename" "$tmp"
redis-check-rdb "$tmp" >/dev/null

replication_after_copy=$("${redis_cli[@]}" INFO replication)
if ! replica_is_healthy "$replication_after_copy"; then
	echo "Redis replica became stale or disconnected; refusing backup" >&2
	exit 1
fi

checksum=$(sha256sum "$tmp" | awk '{print $1}')
printf '%s  %s\n' "$checksum" "$(basename "$target")" > "$checksum_tmp"
chmod 0600 "$checksum_tmp"
mv -- "$checksum_tmp" "$target.sha256"
checksum_tmp=''
mv -- "$tmp" "$target"
tmp=''

if [[ $(date -u +%u) == 7 ]]; then
	weekly=$weekly_dir/$(basename "$target")
	cp --preserve=mode,timestamps "$target.sha256" "$weekly.sha256"
	ln "$target" "$weekly"
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

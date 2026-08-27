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
max_replication_offset_lag_bytes=${REDIS_MAX_REPLICATION_OFFSET_LAG_BYTES:-1048576}
replica_probe_timeout_seconds=${REDIS_REPLICA_PROBE_TIMEOUT_SECONDS:-3}
[[ $replica_probe_timeout_seconds =~ ^[1-9][0-9]*$ ]] || {
	echo "REDIS_REPLICA_PROBE_TIMEOUT_SECONDS must be a positive integer" >&2
	exit 1
}
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

primary_has_healthy_replicas() {
	local input=$1
	local connected master_offset
	connected=$(field connected_slaves "$input")
	master_offset=$(field master_repl_offset "$input")
	[[ $connected =~ ^[0-9]+$ && $connected -gt 0 ]] || return 1
	[[ $master_offset =~ ^[0-9]+$ ]] || return 1
	[[ $max_replication_offset_lag_bytes =~ ^[0-9]+$ ]] || return 1

	local healthy=0 line host port state lag replica_offset read_only read_only_output offset_lag
	while IFS= read -r line; do
		host=$(sed -n 's/.*ip=\([^,]*\).*/\1/p' <<<"$line" | tr -d '\r')
		port=$(sed -n 's/.*port=\([^,]*\).*/\1/p' <<<"$line" | tr -d '\r')
		state=$(sed -n 's/.*state=\([^,]*\).*/\1/p' <<<"$line" | tr -d '\r')
		lag=$(sed -n 's/.*lag=\([^,]*\).*/\1/p' <<<"$line" | tr -d '\r')
		replica_offset=$(sed -n 's/.*offset=\([^,]*\).*/\1/p' <<<"$line" | tr -d '\r')
		read_only=''
		if [[ $host =~ ^[A-Za-z0-9_.:-]+$ && $port =~ ^[0-9]+$ && $port -le 65535 ]]; then
			if read_only_output=$(redis-cli -h "$host" -p "$port" -t "$replica_probe_timeout_seconds" --no-auth-warning CONFIG GET replica-read-only 2>/dev/null); then
				read_only=$(sed -n '2p' <<<"$read_only_output" | tr -d '\r')
			else
				read_only=''
			fi
		fi
		if [[ $state == online && $lag =~ ^[0-9]+$ && $lag -le 30 && $replica_offset =~ ^[0-9]+$ && $read_only == 1 ]] && (( master_offset >= replica_offset )); then
			offset_lag=$((master_offset - replica_offset))
			if (( offset_lag <= max_replication_offset_lag_bytes )); then
				healthy=$((healthy + 1))
			fi
		fi
	done < <(grep -E '^slave[0-9]+:' <<<"$input" || true)
	[[ $healthy -eq $connected ]]
}

replication_is_healthy() {
	local input=$1
	case $(field role "$input") in
		slave) replica_is_healthy "$input" ;;
		master) primary_has_healthy_replicas "$input" ;;
		*) return 1 ;;
	esac
}

replication_before=$("${redis_cli[@]}" INFO replication)
role=$(field role "$replication_before")
if ! replication_is_healthy "$replication_before"; then
	echo "Redis replication topology is stale or disconnected (role=$role); refusing backup" >&2
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
if ! replication_is_healthy "$replication_after"; then
	echo "Redis replication topology became stale or disconnected; refusing backup" >&2
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
if ! replication_is_healthy "$replication_after_copy"; then
	echo "Redis replication topology became stale or disconnected; refusing backup" >&2
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

echo "redis $role backup created: $target"

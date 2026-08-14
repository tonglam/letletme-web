#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
	echo "run as root" >&2
	exit 1
fi

export REDISCLI_AUTH=$(< /etc/letletme-redis/admin.secret)
redis_cli=(redis-cli -h 127.0.0.1 -p 6379 --no-auth-warning)
replication=$("${redis_cli[@]}" INFO replication)
persistence=$("${redis_cli[@]}" INFO persistence)
memory=$("${redis_cli[@]}" INFO memory)

field() {
	local name=$1 input=$2
	sed -n "s/^${name}://p" <<<"$input" | tr -d '\r'
}

role=$(field role "$replication")
link=$(field master_link_status "$replication")
last_io=$(field master_last_io_seconds_ago "$replication")
read_only=$(field slave_read_only "$replication")
syncing=$(field master_sync_in_progress "$replication")
offset=$(field slave_repl_offset "$replication")
aof_status=$(field aof_last_bgrewrite_status "$persistence")
rdb_status=$(field rdb_last_bgsave_status "$persistence")
used_memory=$(field used_memory "$memory")
available_bytes=$(df --output=avail -B1 /var/lib/redis | tail -n 1 | tr -d ' ')

[[ $role == slave ]]
[[ $link == up ]]
[[ $last_io =~ ^[0-9]+$ && $last_io -le 30 ]]
[[ $read_only == 1 ]]
[[ $syncing == 0 ]]
[[ $aof_status == ok ]]
[[ $rdb_status == ok ]]
[[ $available_bytes =~ ^[0-9]+$ && $available_bytes -ge 5368709120 ]]

printf '{"event":"redis_replica_health","link":"%s","lastIoSeconds":%s,"offset":%s,"usedMemory":%s,"availableDiskBytes":%s}\n' \
	"$link" "$last_io" "$offset" "$used_memory" "$available_bytes"

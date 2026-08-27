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

primary_has_healthy_replicas() {
	local input=$1
	local connected
	connected=$(field connected_slaves "$input")
	[[ $connected =~ ^[0-9]+$ && $connected -gt 0 ]] || return 1

	local healthy=0 line state lag
	while IFS= read -r line; do
		state=$(sed -n 's/.*state=\([^,]*\).*/\1/p' <<<"$line" | tr -d '\r')
		lag=$(sed -n 's/.*lag=\([^,]*\).*/\1/p' <<<"$line" | tr -d '\r')
		if [[ $state == online && $lag =~ ^[0-9]+$ && $lag -le 30 ]]; then
			healthy=$((healthy + 1))
		fi
	done < <(grep -E '^slave[0-9]+:' <<<"$input" || true)
	[[ $healthy -eq $connected ]]
}

role=$(field role "$replication")
connected_slaves=$(field connected_slaves "$replication")
link=$(field master_link_status "$replication")
last_io=$(field master_last_io_seconds_ago "$replication")
read_only=$(field slave_read_only "$replication")
syncing=$(field master_sync_in_progress "$replication")
offset=$(field slave_repl_offset "$replication")
aof_status=$(field aof_last_bgrewrite_status "$persistence")
rdb_status=$(field rdb_last_bgsave_status "$persistence")
used_memory=$(field used_memory "$memory")
available_bytes=$(df --output=avail -B1 /var/lib/redis | tail -n 1 | tr -d ' ')

if [[ $role == slave ]]; then
	[[ $link == up ]]
	[[ $last_io =~ ^[0-9]+$ && $last_io -le 30 ]]
	[[ $read_only == 1 ]]
	[[ $syncing == 0 ]]
elif [[ $role == master ]]; then
	primary_has_healthy_replicas "$replication"
else
	echo "Redis replication topology has unsupported role: $role" >&2
	exit 1
fi
[[ $aof_status == ok ]]
[[ $rdb_status == ok ]]
[[ $available_bytes =~ ^[0-9]+$ && $available_bytes -ge 5368709120 ]]

if [[ $role == master ]]; then
	link=primary
	last_io_json=null
	offset_json=null
	connected_slaves_json=$connected_slaves
else
	last_io_json=$last_io
	offset_json=$offset
	connected_slaves_json=0
fi
printf '{"event":"redis_replication_health","role":"%s","link":"%s","lastIoSeconds":%s,"offset":%s,"connectedReplicas":%s,"usedMemory":%s,"availableDiskBytes":%s}\n' \
	"$role" "$link" "$last_io_json" "$offset_json" "$connected_slaves_json" "$used_memory" "$available_bytes"

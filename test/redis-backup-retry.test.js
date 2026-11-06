const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const source = readFileSync('ops/redis/scripts/backup-replica.sh', 'utf8');
const functions = source.slice(source.indexOf('field() {'), source.indexOf('\nwait_for_healthy_replication before-bgsave'));

function run({ failures = 0, mode = 'healthy', readOnly = 'yes' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'redis-backup-retry-'));
  try {
    const script = `
set -euo pipefail
replica_probe_timeout_seconds=3
max_replication_offset_lag_bytes=1048576
redis_cli=(redis-cli)
${functions}
timeout() { shift; "$@"; }
sleep() { echo sleep >> "$TEST_DIR/sleeps"; }
redis-cli() {
  if [[ $* == *"CONFIG GET"* ]]; then
    printf 'replica-read-only\\n%s\\n' "$READ_ONLY"
    return
  fi
  local count=0
  if [[ -f $TEST_DIR/count ]]; then read -r count < "$TEST_DIR/count"; fi
  count=$((count + 1))
  echo "$count" > "$TEST_DIR/count"
  if (( count <= FAILURES )); then
    echo 'role:master'
    echo 'connected_slaves:0'
    echo 'master_repl_offset:2000000'
    return
  fi
  if [[ $MODE == timeout ]]; then return 124; fi
  if [[ $MODE == unknown ]]; then echo 'role:unknown'; return; fi
  echo 'role:master'
  echo 'connected_slaves:1'
  echo 'master_repl_offset:2000000'
  case $MODE in
    lag) echo 'slave0:ip=127.0.0.1,port=6379,state=online,offset=1,lag=0' ;;
    stale) echo 'slave0:ip=127.0.0.1,port=6379,state=online,offset=2000000,lag=31' ;;
    *) echo 'slave0:ip=127.0.0.1,port=6379,state=online,offset=2000000,lag=0' ;;
  esac
}
wait_for_healthy_replication after-bgsave
echo publish-allowed
`;
    const result = spawnSync('bash', ['-c', script], {
      encoding: 'utf8',
      env: { ...process.env, TEST_DIR: dir, FAILURES: String(failures), MODE: mode, READ_ONLY: readOnly },
      timeout: 10000,
    });
    let attempts = 0;
    let sleeps = 0;
    try { attempts = Number(readFileSync(join(dir, 'count'), 'utf8').trim()); } catch {}
    try { sleeps = readFileSync(join(dir, 'sleeps'), 'utf8').trim().split('\n').length; } catch {}
    assert.ifError(result.error);
    return { ...result, attempts, sleeps };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('accepts Redis CONFIG read-only responses yes and 1 immediately', () => {
  for (const readOnly of ['yes', '1']) {
    const result = run({ readOnly });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.attempts, 1);
    assert.equal(result.sleeps, 0);
  }
});

test('re-reads topology and recovers after a transient failure', () => {
  const result = run({ failures: 2 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.attempts, 3);
  assert.equal(result.sleeps, 2);
  assert.match(result.stderr, /recovered: stage=after-bgsave attempt=3/);
});

test('can recover on the last bounded attempt', () => {
  const result = run({ failures: 6 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.attempts, 7);
  assert.equal(result.sleeps, 6);
});

for (const [name, options, reason] of [
  ['disconnected', { failures: 99 }, /no connected replicas/],
  ['offset lag', { mode: 'lag' }, /offset lag exceeds limit/],
  ['stale ACK', { mode: 'stale' }, /stale ACK/],
  ['writable replica', { readOnly: 'no' }, /read-only probe failed/],
  ['INFO timeout', { mode: 'timeout' }, /INFO probe failed or timed out/],
  ['unknown role', { mode: 'unknown' }, /unsupported role/],
]) {
  test(`persistent ${name} refuses publication after seven attempts`, () => {
    const result = run(options);
    assert.equal(result.status, 1);
    assert.equal(result.attempts, 7);
    assert.equal(result.sleeps, 6);
    assert.doesNotMatch(result.stdout, /publish-allowed/);
    assert.match(result.stderr, reason);
    assert.match(result.stderr, /stage=after-bgsave; refusing backup/);
  });
}

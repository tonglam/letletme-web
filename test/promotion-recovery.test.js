const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { spawnSync } = require('node:child_process')
const test = require('node:test')
const source = readFileSync('.github/workflows/release-web.yml', 'utf8')
const start = source.includes('          # Observe asynchronous promotion') ? source.indexOf('          # Observe asynchronous promotion') : source.indexOf('          npx --yes "vercel@${VERCEL_CLI_VERSION}" promote "$CANDIDATE_URL"')
const end = source.indexOf('          if [[ "$WEB_MAINTENANCE_MODE"', start)
const block = source.slice(start, end).replace(/^          /gm, '')
function run(promoteCode, statusCode, matching, rawStatus = 'succeeded') {
 const script = `set -euo pipefail
npx() { if [[ "$*" == *" api "* ]]; then echo '${JSON.stringify({id:'fixture-project',accountId:'fixture-team',lastAliasRequest:{jobStatus:rawStatus,requestedAt:1,type:'promote',toDeploymentId:'fixture-candidate'}})}'; return 0; fi; if [[ "$*" == *"promote status"* ]]; then echo OBSERVE; return ${statusCode}; fi; echo PROMOTE; return ${promoteCode}; }
curl() { echo 'x-letletme-release: ${matching ? 'expected' : 'old'}'; }
sleep() { :; }
${block}
echo VERIFIED
`
 return spawnSync('bash', ['-c', script], { encoding:'utf8', env:{...process.env, VERCEL_CLI_VERSION:'52.0.0', VERCEL_TOKEN:'fixture', VERCEL_ORG_ID:'fixture-team', VERCEL_PROJECT_ID:'fixture-project', CANDIDATE_DEPLOYMENT_ID:'fixture-candidate', CANDIDATE_URL:'fixture-candidate', RELEASE_SHA:'expected'} })
}
test('promotion timeout observes completion and verifies exact alias without repeating promotion', () => {
 const r=run(1,0,true); assert.equal(r.status,0,r.stderr); assert.match(r.stdout,/OBSERVE/); assert.match(r.stdout,/VERIFIED/); assert.equal(r.stdout.split('\n').filter(x=>x==='PROMOTE').length,1)
})
test('pending or failed observation cannot advance even if a health response matches', () => {
 const r=run(1,1,true); assert.notEqual(r.status,0); assert.doesNotMatch(r.stdout,/VERIFIED/)
})
test('completed observation with wrong alias cannot advance', () => {
 const r=run(1,0,false); assert.notEqual(r.status,0); assert.doesNotMatch(r.stdout,/VERIFIED/)
})
test('successful promotion still requires exact alias', () => {
 assert.equal(run(0,0,true).status,0); assert.notEqual(run(0,0,false).status,0)
})

for (const statusCode of [0, 1]) {
 test(`prior promotion status ${statusCode} gates candidate creation`, () => {
  const start=source.indexOf('      - name: Resolve prior promotion before creating another candidate')
  const end=source.indexOf('      - name: Build remotely and stage Vercel production candidate',start)
  assert.ok(start>=0 && end>start)
  const section=source.slice(start,end)
  const script=section.slice(section.indexOf('        run: |')+'        run: |'.length).replace(/^          /gm,'')
  const result=spawnSync('bash',['-c',`npx() { if [[ "$*" == *" api "* ]]; then echo '{"id":"fixture-project","accountId":"fixture-team","lastAliasRequest":null}'; return 0; fi; echo OBSERVE; return ${statusCode}; }
${script}
echo CREATE_CANDIDATE`],{encoding:'utf8',env:{...process.env,VERCEL_CLI_VERSION:'52.0.0',VERCEL_TOKEN:'fixture',VERCEL_ORG_ID:'fixture-team',VERCEL_PROJECT_ID:'fixture-project'}})
  assert.equal(result.status,statusCode)
  assert.match(result.stdout,/OBSERVE/)
  if(statusCode) assert.doesNotMatch(result.stdout,/CREATE_CANDIDATE/)
  else assert.match(result.stdout,/CREATE_CANDIDATE/)
 })
}

test('old pending operation cannot pass when CLI status reports success', () => {
 const result=run(1,0,true,'pending')
 assert.notEqual(result.status,0)
 assert.doesNotMatch(result.stdout,/VERIFIED/)
})

for (const [label, patch, expected] of [
 ['old pending', { lastAliasRequest: { jobStatus: 'pending', requestedAt: 1 } }, 1],
 ['old in-progress', { lastAliasRequest: { jobStatus: 'in-progress', requestedAt: 1 } }, 1],
 ['unknown status', { lastAliasRequest: { jobStatus: 'future-state' } }, 1],
 ['wrong project', { id: 'another-project' }, 1],
 ['wrong team', { accountId: 'another-team' }, 1],
 ['rolling release', { rollingRelease: { active: true } }, 1],
 ['failed', { lastAliasRequest: { jobStatus: 'failed', type: 'promote' } }, 1],
 ['skipped', { lastAliasRequest: { jobStatus: 'skipped', type: 'promote' } }, 1],
 ['rollback', { lastAliasRequest: { jobStatus: 'succeeded', type: 'rollback' } }, 1],
 ['no operation', { lastAliasRequest: null }, 1],
 ['wrong candidate', {lastAliasRequest:{jobStatus:'succeeded',type:'promote',toDeploymentId:'old-candidate'}}, 1],
 ['missing candidate', {lastAliasRequest:{jobStatus:'succeeded',type:'promote'}}, 1],
 ['succeeded', {}, 0],
]) {
 test(`raw promotion state: ${label}`, () => {
  const project={id:'fixture-project',accountId:'fixture-team',lastAliasRequest:{jobStatus:'succeeded',type:'promote',requestedAt:1,toDeploymentId:'fixture-candidate'},...patch}
  const r=spawnSync(process.execPath,['ops/release/check-promotion-state.mjs','--require-success'],{input:JSON.stringify(project),encoding:'utf8',env:{...process.env,VERCEL_PROJECT_ID:'fixture-project',VERCEL_ORG_ID:'fixture-team',CANDIDATE_DEPLOYMENT_ID:'fixture-candidate'}})
  assert.equal(r.status,expected,r.stderr)
 })
}
test('missing and malformed raw project responses fail closed', () => {
 for(const input of ['{','null','{}',JSON.stringify({id:'fixture-project',accountId:'fixture-team'})]) {
  const r=spawnSync(process.execPath,['ops/release/check-promotion-state.mjs'],{input,encoding:'utf8',env:{...process.env,VERCEL_PROJECT_ID:'fixture-project',VERCEL_ORG_ID:'fixture-team',CANDIDATE_DEPLOYMENT_ID:'fixture-candidate'}})
  assert.equal(r.status,1)
 }
})

test('candidate identity is carried from validated inspect output to promotion check', () => {
 assert.match(source, /typeof value.id !== "string"/)
 assert.match(source, /fs\.appendFileSync\(process\.env\.GITHUB_OUTPUT, `candidate_id=\$\{value\.id\}\\n`\)/)
 assert.match(source, /CANDIDATE_DEPLOYMENT_ID: \$\{\{ steps\.vercel-candidate\.outputs\.candidate_id \}\}/)
})

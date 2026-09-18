const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { spawnSync } = require('node:child_process')
const test = require('node:test')
const source = readFileSync('.github/workflows/release-web.yml', 'utf8')
const start = source.includes('          # Observe asynchronous promotion') ? source.indexOf('          # Observe asynchronous promotion') : source.indexOf('          npx --yes "vercel@${VERCEL_CLI_VERSION}" promote "$CANDIDATE_URL"')
const end = source.indexOf('          if [[ "$WEB_MAINTENANCE_MODE"', start)
const block = source.slice(start, end).replace(/^          /gm, '')
function run(promoteCode, statusCode, matching) {
 const script = `set -euo pipefail
npx() { if [[ "$*" == *"promote status"* ]]; then echo OBSERVE; return ${statusCode}; fi; echo PROMOTE; return ${promoteCode}; }
curl() { echo 'x-letletme-release: ${matching ? 'expected' : 'old'}'; }
sleep() { :; }
${block}
echo VERIFIED
`
 return spawnSync('bash', ['-c', script], { encoding:'utf8', env:{...process.env, VERCEL_CLI_VERSION:'52.0.0', VERCEL_TOKEN:'fixture', VERCEL_ORG_ID:'fixture-team', VERCEL_PROJECT_ID:'fixture-project', CANDIDATE_URL:'fixture-candidate', RELEASE_SHA:'expected'} })
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
  const result=spawnSync('bash',['-c',`npx() { echo OBSERVE; return ${statusCode}; }
${script}
echo CREATE_CANDIDATE`],{encoding:'utf8',env:{...process.env,VERCEL_CLI_VERSION:'52.0.0',VERCEL_TOKEN:'fixture',VERCEL_ORG_ID:'fixture-team',VERCEL_PROJECT_ID:'fixture-project'}})
  assert.equal(result.status,statusCode)
  assert.match(result.stdout,/OBSERVE/)
  if(statusCode) assert.doesNotMatch(result.stdout,/CREATE_CANDIDATE/)
  else assert.match(result.stdout,/CREATE_CANDIDATE/)
 })
}

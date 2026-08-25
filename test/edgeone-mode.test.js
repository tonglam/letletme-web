const assert = require('node:assert/strict')
const test = require('node:test')

async function loadModule() {
	return import('../ops/release/edgeone-mode.mjs')
}

function rules() {
	const common = {
		RuleId: 'rule-1',
		RuleName: 'letletme-web',
		Conditions: [{ MatchType: 'path', Values: ['/'] }]
	}
	return {
		'all-vercel': {
			...common,
			Actions: [{ Name: 'origin', Value: 'vercel' }]
		},
		split: {
			...common,
			Actions: [{ Name: 'origin', Value: 'tencent-safe-reads' }]
		}
	}
}

test('EdgeOne rule fingerprints are stable across key order and server metadata', async () => {
	const { ruleFingerprint } = await loadModule()
	const first = { RuleId: 'rule-1', RulePriority: 3, UpdateTime: 'old', Nested: { b: 2, a: 1 } }
	const second = { Nested: { a: 1, b: 2 }, CreateTime: 'new', RulePriority: 9, RuleId: 'rule-1' }
	assert.equal(ruleFingerprint(first), ruleFingerprint(second))
})

function scopedReleaseRule(overrides = {}) {
	return {
		Status: 'enable',
		RuleId: 'rule-release',
		RuleName: 'TEMP CN bafa to Tencent',
		Description: [],
		RulePriority: 3,
		Branches: [{
			Condition: "${http.request.host} in ['eo-personal-canary.letletme.top'] and ${http.request.ip.country} in ['CN'] and ${http.request.method} in ['GET']",
			Actions: [{
				Name: 'ModifyOrigin',
				ModifyOriginParameters: {
					HTTPOriginPort: 80,
					HTTPSOriginPort: 443,
					OriginType: 'OriginGroup',
					Origin: 'og-3u1v4jecjhe8',
					OriginProtocol: 'follow'
				}
			}]
		}],
		...overrides
	}
}

test('builds scoped split and all-Vercel snapshots without output-only fields', async () => {
	const { buildScopedRuleSnapshots } = await loadModule()
	const snapshots = buildScopedRuleSnapshots(scopedReleaseRule())

	assert.equal(snapshots.split.Status, 'enable')
	assert.equal(snapshots['all-vercel'].Status, 'disable')
	assert.equal(snapshots.split.RuleId, 'rule-release')
	assert.equal('RulePriority' in snapshots.split, false)
})

test('preserves a nullable EdgeOne rule description returned by the API', async () => {
	const { buildScopedRuleSnapshots } = await loadModule()
	const snapshots = buildScopedRuleSnapshots(scopedReleaseRule({ Description: null }))

	assert.equal(snapshots.split.Description, null)
	assert.equal(snapshots['all-vercel'].Description, null)
})

test('omits an optional EdgeOne rule description absent from the API response', async () => {
	const { buildScopedRuleSnapshots } = await loadModule()
	const rule = scopedReleaseRule()
	delete rule.Description
	const snapshots = buildScopedRuleSnapshots(rule)

	assert.equal('Description' in snapshots.split, false)
	assert.equal('Description' in snapshots['all-vercel'], false)
})

test('refuses invalid EdgeOne rule description shapes', async () => {
	const { buildScopedRuleSnapshots } = await loadModule()

	assert.throws(
		() => buildScopedRuleSnapshots(scopedReleaseRule({ Description: 'not-an-array' })),
		/rule description is invalid/
	)
	assert.throws(
		() => buildScopedRuleSnapshots(scopedReleaseRule({ Description: [null] })),
		/rule description is invalid/
	)
})

test('refuses to export an unexpected or header-bearing release rule', async () => {
	const { buildScopedRuleSnapshots } = await loadModule()
	assert.throws(
		() => buildScopedRuleSnapshots(scopedReleaseRule({ RuleName: 'another rule' })),
		/rule name is unexpected/
	)
	const headerRule = scopedReleaseRule()
	headerRule.Branches[0].Actions = [{ Name: 'ModifyRequestHeader', Parameters: {} }]
	assert.throws(
		() => buildScopedRuleSnapshots(headerRule),
		/release action has unexpected fields/
	)
	assert.throws(
		() => buildScopedRuleSnapshots(scopedReleaseRule({ Branches: [null] })),
		/release branch is invalid/
	)
})

test('EdgeOne mode changes accept only the known opposite mode or are idempotent', async () => {
	const { validateRuleTransition } = await loadModule()
	const snapshots = rules()

	const transition = validateRuleTransition('all-vercel', snapshots.split, snapshots)
	assert.equal(transition.shouldModify, true)
	assert.equal(transition.sourceMode, 'split')
	assert.match(transition.currentFingerprint, /^[a-f0-9]{64}$/)
	assert.match(transition.targetFingerprint, /^[a-f0-9]{64}$/)
	assert.equal(
		validateRuleTransition('split', snapshots.split, snapshots).shouldModify,
		false
	)
})

test('EdgeOne mode changes refuse an unrecognized live rule', async () => {
	const { validateRuleTransition } = await loadModule()
	const snapshots = rules()
	const edited = {
		...snapshots.split,
		Actions: [{ Name: 'origin', Value: 'unexpected' }]
	}

	assert.throws(
		() => validateRuleTransition('all-vercel', edited, snapshots),
		/does not match the known split snapshot; refusing to overwrite/
	)
})

test('EdgeOne mode changes reject identical routing snapshots', async () => {
	const { validateRuleTransition } = await loadModule()
	const snapshots = rules()
	const duplicateSnapshots = {
		'all-vercel': snapshots['all-vercel'],
		split: snapshots['all-vercel']
	}

	assert.throws(
		() => validateRuleTransition('split', duplicateSnapshots.split, duplicateSnapshots),
		/snapshots must differ/
	)
})

test('EdgeOne rollback verification is read-only and requires the target fingerprint', async () => {
	const { validateLiveRule } = await loadModule()
	const snapshots = rules()
	const verified = validateLiveRule('all-vercel', snapshots['all-vercel'], snapshots)
	assert.equal(verified.verified, true)
	assert.equal(verified.currentFingerprint, verified.targetFingerprint)

	assert.throws(
		() => validateLiveRule('all-vercel', snapshots.split, snapshots),
		/live rule does not match the all-vercel snapshot/
	)
})

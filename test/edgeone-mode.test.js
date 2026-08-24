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
	const first = { RuleId: 'rule-1', UpdateTime: 'old', Nested: { b: 2, a: 1 } }
	const second = { Nested: { a: 1, b: 2 }, CreateTime: 'new', RuleId: 'rule-1' }
	assert.equal(ruleFingerprint(first), ruleFingerprint(second))
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

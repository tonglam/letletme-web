import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { describe, it } from 'node:test'

import { formatBriefingDate } from '../lib/briefing-format'
import { isBriefingPublicEnabled } from '../lib/briefing-public'
import {
	isRenderableBriefingStoryState,
	isBriefingState,
} from '../lib/graphql/operations/briefing'
import {
	briefingPublishIdempotencyKey,
	briefingRevalidateTags,
	parseBriefingRevalidateEvent,
	verifyBriefingRevalidateEnvelope,
} from '../lib/briefing-revalidate'

describe('briefing public flag', () => {
	it('treats TRUE and true the same, and defaults off in production', () => {
		assert.equal(
			isBriefingPublicEnabled({ BRIEFING_PUBLIC_ENABLED: 'TRUE' }),
			true
		)
		assert.equal(
			isBriefingPublicEnabled({ BRIEFING_PUBLIC_ENABLED: 'false' }),
			false
		)
		assert.equal(isBriefingPublicEnabled({ NODE_ENV: 'production' }), false)
		assert.equal(isBriefingPublicEnabled({ NODE_ENV: 'development' }), true)
	})
})

describe('briefing story states', () => {
	it('renders READY and CORRECTED copy, not unknown states', () => {
		assert.equal(isRenderableBriefingStoryState('READY'), true)
		assert.equal(isRenderableBriefingStoryState('CORRECTED'), true)
		assert.equal(isRenderableBriefingStoryState('REMOVED'), false)
		assert.equal(isBriefingState('CORRECTED'), true)
		assert.equal(isBriefingState('DRAFT'), false)
	})
})

describe('briefing revalidation contract', () => {
	it('accepts week and story events and emits week plus story tags', () => {
		const week = parseBriefingRevalidateEvent({
			scopeKey: 'week',
			publicationId: 'pub-1',
			revision: 2,
		})
		assert.ok(week)
		assert.deepEqual(briefingRevalidateTags(week), ['briefing:week'])

		const story = parseBriefingRevalidateEvent({
			scopeKey: 'story',
			publicationId: 'pub-2',
			revision: 3,
			storyId: 'story-9',
			canonicalSlug: 'canonical-slug',
			aliasSlugs: ['old-slug', ''],
		})
		assert.ok(story)
		assert.deepEqual(briefingRevalidateTags(story), [
			'briefing:week',
			'briefing:story:story-9',
			'briefing:story-slug:canonical-slug',
			'briefing:story-slug:old-slug',
		])
	})

	it('rejects events that are not week or story publications', () => {
		assert.equal(
			parseBriefingRevalidateEvent({
				scopeKey: 'inbox',
				publicationId: 'pub-1',
				revision: 1,
			}),
			null
		)
	})

	it('verifies HMAC envelopes, including second-resolution timestamps', () => {
		const secret = 'revalidate-secret'
		const nonce = 'aaaaaaaaaaaaaaaa'
		const body = '{"scopeKey":"week","publicationId":"p","revision":1}'
		const nowMs = Date.parse('2026-08-19T02:00:00.000Z')
		const timestamp = String(Math.floor(nowMs / 1000))
		const signature = createHmac('sha256', secret)
			.update(`${timestamp}.${nonce}.${body}`, 'utf8')
			.digest('hex')
		assert.equal(
			verifyBriefingRevalidateEnvelope({
				secret,
				timestamp,
				nonce,
				signature,
				body,
				nowMs,
			}),
			true
		)
		assert.equal(
			verifyBriefingRevalidateEnvelope({
				secret,
				timestamp,
				nonce,
				signature: 'deadbeef',
				body,
				nowMs,
			}),
			false
		)
	})

	it('reuses a stable publish idempotency key for the same edition revision', () => {
		assert.equal(
			briefingPublishIdempotencyKey('edition-1', 4),
			'web:briefing:publish:edition-1:4'
		)
		assert.equal(
			briefingPublishIdempotencyKey('edition-1', 4),
			briefingPublishIdempotencyKey('edition-1', 4)
		)
	})
})

describe('briefing display time', () => {
	it('formats FPL deadlines in Europe/London rather than the host timezone', () => {
		const formatted = formatBriefingDate(
			'2026-08-21T17:30:00.000Z',
			'en',
			{ timeZoneName: 'short' }
		)
		assert.ok(formatted)
		assert.match(formatted, /18:30/)
		assert.match(formatted, /BST|GMT\+1/)
	})
})

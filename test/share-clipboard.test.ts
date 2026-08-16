import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { shareText } from '../lib/share/clipboard'

function setNavigator(value: unknown): PropertyDescriptor | undefined {
	const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
	Object.defineProperty(globalThis, 'navigator', {
		configurable: true,
		value
	})
	return descriptor
}

function restoreNavigator(descriptor: PropertyDescriptor | undefined) {
	if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor)
	else delete (globalThis as { navigator?: unknown }).navigator
}

describe('shareText', () => {
	it('uses the native share sheet when available', async () => {
		let payload: ShareData | null = null
		const previous = setNavigator({
			share: async (next: ShareData) => {
				payload = next
			}
		})
		try {
			assert.equal(await shareText('hello', { title: 'Test' }), 'shared')
			assert.deepEqual(payload, { text: 'hello', title: 'Test' })
		} finally {
			restoreNavigator(previous)
		}
	})

	it('falls back to text clipboard when the native share sheet is absent', async () => {
		let copied = ''
		const previous = setNavigator({
			clipboard: {
				writeText: async (value: string) => {
					copied = value
				}
			}
		})
		try {
			assert.equal(await shareText('fallback'), 'copied')
			assert.equal(copied, 'fallback')
		} finally {
			restoreNavigator(previous)
		}
	})
})

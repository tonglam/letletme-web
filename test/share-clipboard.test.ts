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
	it('uses the native share sheet on mobile when available', async () => {
		let payload: ShareData | null = null
		const previous = setNavigator({
			userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
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

	it('prefers the clipboard on desktop even when native share is exposed', async () => {
		let copied = ''
		let nativeShareCalled = false
		const previous = setNavigator({
			userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
			share: async () => {
				nativeShareCalled = true
			},
			clipboard: {
				writeText: async (value: string) => {
					copied = value
				}
			}
		})
		try {
			assert.equal(await shareText('desktop text'), 'copied')
			assert.equal(copied, 'desktop text')
			assert.equal(nativeShareCalled, false)
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

	it('reports a native share target rejection for manual fallback', async () => {
		let copied = ''
		const previous = setNavigator({
			userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
			share: async () => {
				throw new Error('target rejected')
			},
			clipboard: {
				writeText: async (value: string) => {
					copied = value
				}
			}
		})
		try {
			assert.equal(await shareText('manual fallback after rejection'), 'failed')
			assert.equal(copied, '')
		} finally {
			restoreNavigator(previous)
		}
	})

	it('does not copy when the native share sheet rejects', async () => {
		let copied = false
		const previous = setNavigator({
			userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
			share: async () => {
				throw { name: 'AbortError' }
			},
			clipboard: {
				writeText: async () => {
					copied = true
				}
			}
		})
		try {
			assert.equal(await shareText('rejected'), 'failed')
			assert.equal(copied, false)
		} finally {
			restoreNavigator(previous)
		}
	})
})

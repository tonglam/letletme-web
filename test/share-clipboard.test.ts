import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	getShareCaptureHeight,
	getShareCaptureWidth,
	SHARE_IMAGE_STYLE_PROPERTIES,
	SHARE_BACKGROUND_COLOR,
	shouldIncludeShareImageNode,
	shareText
} from '../lib/share/clipboard'

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

describe('getShareCaptureWidth', () => {
	it('keeps explicitly bounded share targets inside their own box', () => {
		const target = {
			clientWidth: 768,
			scrollWidth: 904,
			getAttribute: (name: string) =>
				name === 'data-share-preserve-width' ? 'true' : null,
			querySelectorAll: () => [{ scrollWidth: 1042 }]
		} as unknown as HTMLElement

		assert.equal(getShareCaptureWidth(target), undefined)
	})

	it('only expands legacy share targets that explicitly opt in', () => {
		const target = {
			clientWidth: 768,
			scrollWidth: 904,
			getAttribute: (name: string) =>
				name === 'data-share-expand-width' ? 'true' : null,
			querySelectorAll: () => [{ scrollWidth: 1042 }]
		} as unknown as HTMLElement

		assert.equal(getShareCaptureWidth(target), 1042)
	})

	it('does not widen an unmarked target for descendant overflow', () => {
		const target = {
			clientWidth: 768,
			scrollWidth: 904,
			getAttribute: () => null,
			querySelectorAll: () => [{ scrollWidth: 1042 }]
		} as unknown as HTMLElement

		assert.equal(getShareCaptureWidth(target), undefined)
	})
})

describe('getShareCaptureHeight', () => {
	it('fits marked targets to their full scroll height including borders', () => {
		const target = {
			clientHeight: 600,
			scrollHeight: 900,
			offsetHeight: 604,
			getAttribute: (name: string) =>
				name === 'data-share-fit-content' ? 'true' : null,
			querySelectorAll: () => []
		} as unknown as HTMLElement

		assert.equal(getShareCaptureHeight(target), 904)
	})

	it('does not change unmarked share targets', () => {
		const target = {
			clientHeight: 600,
			scrollHeight: 900,
			offsetHeight: 604,
			getAttribute: () => null,
			querySelectorAll: () => []
		} as unknown as HTMLElement

		assert.equal(getShareCaptureHeight(target), undefined)
	})
})

describe('share image presentation', () => {
	it('preserves grid placement when cloning share layouts', () => {
		for (const property of [
			'grid-column',
			'grid-column-end',
			'grid-column-start',
			'grid-row',
			'grid-row-end',
			'grid-row-start'
		]) {
			assert.ok(SHARE_IMAGE_STYLE_PROPERTIES.includes(property))
		}
	})

	it('uses the light-mode canvas color for every image export', () => {
		assert.equal(SHARE_BACKGROUND_COLOR, '#faf9f5')
	})

	it('filters excluded carousel slides from the exported clone', () => {
		assert.equal(
			shouldIncludeShareImageNode({
				nodeType: 1,
				getAttribute: name =>
					name === 'data-share-exclude' ? 'true' : null
			}),
			false
		)
		assert.equal(
			shouldIncludeShareImageNode({
				nodeType: 1,
				getAttribute: () => null
			}),
			true
		)
	})
})

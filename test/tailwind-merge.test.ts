import assert from 'node:assert/strict'
import test from 'node:test'

import { cn } from '../lib/utils'

test('custom typography utilities do not consume text color utilities', () => {
	assert.equal(cn('text-micro', 'text-electric'), 'text-micro text-electric')
	assert.equal(cn('text-electric', 'text-micro'), 'text-electric text-micro')
	assert.equal(cn('text-label text-plum', 'text-electric'), 'text-label text-electric')
})

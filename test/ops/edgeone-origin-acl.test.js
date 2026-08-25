import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeOriginAcl, validateCidr } from '../../ops/release/edgeone-origin-acl.mjs'

test('validates non-default IPv4 and IPv6 CIDRs', () => {
	assert.equal(validateCidr('43.174.0.0/16', 4), '43.174.0.0/16')
	assert.equal(validateCidr('240e:1234::/32', 6), '240e:1234::/32')
	assert.throws(() => validateCidr('0.0.0.0/0', 4), /valid IPv4 CIDR/)
	assert.throws(() => validateCidr('43.174.0.0/33', 4), /valid IPv4 CIDR/)
	assert.throws(() => validateCidr('43.174.0.0/16', 6), /valid IPv6 CIDR/)
})

test('normalizes and deduplicates current and next ACL ranges', () => {
	const value = normalizeOriginAcl({
		Status: 'online',
		L7Hosts: ['b.example', 'a.example'],
		L4ProxyIds: [],
		CurrentOriginACL: {
			Version: 'acl-current',
			ActiveTime: '2026-08-25T00:00:00Z',
			EntireAddresses: {
				IPv4: ['43.174.0.0/16', '43.174.0.0/16'],
				IPv6: ['240e:1234::/32']
			}
		},
		NextOriginACL: {
			Version: 'acl-next',
			PlannedActiveTime: '2026-09-01T00:00:00Z',
			EntireAddresses: {
				IPv4: ['43.175.0.0/16'],
				IPv6: ['240e:5678::/32']
			}
		}
	})

	assert.deepEqual(value.current.ipv4, ['43.174.0.0/16'])
	assert.deepEqual(value.current.ipv6, ['240e:1234::/32'])
	assert.equal(value.next.version, 'acl-next')
	assert.deepEqual(value.l7Hosts, ['a.example', 'b.example'])
})

test('rejects an ACL without an active complete address set', () => {
	assert.throws(() => normalizeOriginAcl({
		Status: 'online',
		CurrentOriginACL: { Version: 'acl-current', EntireAddresses: { IPv4: [], IPv6: [] } }
	}), /must contain at least one address/)
})

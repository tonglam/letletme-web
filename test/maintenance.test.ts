import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	isMaintenanceDataApi,
	readMaintenanceConfig
} from '../lib/maintenance'
import { renderMaintenanceDocument } from '../lib/maintenance-document'

describe('hard-cutover maintenance contract', () => {
	it('enables maintenance only for the exact server-side true value', () => {
		assert.equal(
			readMaintenanceConfig({ MAINTENANCE_MODE: 'true' }).enabled,
			true
		)
		assert.equal(
			readMaintenanceConfig({ MAINTENANCE_MODE: 'TRUE' }).enabled,
			false
		)
		assert.equal(
			readMaintenanceConfig({ MAINTENANCE_MODE: '1' }).enabled,
			false
		)
		assert.equal(readMaintenanceConfig({}).enabled, false)
	})

	it('uses a bounded retry interval', () => {
		assert.equal(
			readMaintenanceConfig({ MAINTENANCE_RETRY_AFTER_SECONDS: '600' })
				.retryAfterSeconds,
			600
		)
		for (const invalid of ['29', '3601', '1.5', 'invalid', '']) {
			assert.equal(
				readMaintenanceConfig({ MAINTENANCE_RETRY_AFTER_SECONDS: invalid })
					.retryAfterSeconds,
				300
			)
		}
	})

	it('blocks Data and GraphQL APIs without taking ownership of identity APIs', () => {
		for (const pathname of [
			'/api/graphql',
			'/api/tournaments',
			'/api/tournaments/42',
			'/api/tournaments/setup-status'
		]) {
			assert.equal(isMaintenanceDataApi(pathname), true, pathname)
		}

		for (const pathname of [
			'/api/auth/session',
			'/api/miniprogram/profile',
			'/api/vitals',
			'/api/tournament'
		]) {
			assert.equal(isMaintenanceDataApi(pathname), false, pathname)
		}
	})

	it('renders localized standalone maintenance documents', () => {
		const english = renderMaintenanceDocument('en', 60)
		assert.match(english, /<html lang="en">/)
		assert.match(english, /The data room is between seasons\./)
		assert.match(english, /about 1 minute\./)
		assert.match(english, /data-maintenance-page="true"/)

		const chinese = renderMaintenanceDocument('zh-CN', 420)
		assert.match(chinese, /<html lang="zh-CN">/)
		assert.match(chinese, /新赛季数据正在就位。/)
		assert.match(chinese, /建议约 7 分钟后重试。/)
	})
})

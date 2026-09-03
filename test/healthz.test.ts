import assert from 'node:assert/strict'
import test from 'node:test'

import { GET } from '../app/healthz/route'

test('healthz reports the self-hosted origin and release without caching', async () => {
	const names = [
		'LETLETME_ORIGIN',
		'LETLETME_RELEASE_SHA',
		'VERCEL_GIT_COMMIT_SHA',
		'VERCEL',
		'NEXT_DEPLOYMENT_ID'
	] as const
	const previous = Object.fromEntries(
		names.map(name => [name, process.env[name]])
	)
	process.env.LETLETME_ORIGIN = 'tencent'
	process.env.LETLETME_RELEASE_SHA = 'abc1234'
	try {
		delete process.env.VERCEL_GIT_COMMIT_SHA
		delete process.env.VERCEL
		delete process.env.NEXT_DEPLOYMENT_ID
		const response = await GET()
		assert.equal(response.status, 200)
		assert.equal(response.headers.get('cache-control'), 'no-store')
		assert.equal(response.headers.get('x-letletme-origin'), 'tencent')
		assert.equal(response.headers.get('x-letletme-release'), 'abc1234')
		assert.deepEqual(await response.json(), {
			status: 'ok',
			origin: 'tencent',
			release: 'abc1234'
		})
	} finally {
		for (const name of names) {
			if (previous[name] === undefined) delete process.env[name]
			else process.env[name] = previous[name]
		}
	}
})

test('healthz prefers the Vercel Git SHA over a stale explicit release', async () => {
	const names = [
		'LETLETME_ORIGIN',
		'LETLETME_RELEASE_SHA',
		'VERCEL_GIT_COMMIT_SHA',
		'VERCEL',
		'NEXT_DEPLOYMENT_ID'
	] as const
	const previous = Object.fromEntries(
		names.map(name => [name, process.env[name]])
	)
	process.env.LETLETME_ORIGIN = 'vercel'
	process.env.LETLETME_RELEASE_SHA = '28941010a5b6806c60c404d25938c7e816ef85b4'
	process.env.VERCEL_GIT_COMMIT_SHA = '37973bbabbcafbe84714500c629d00935925eee6'
	process.env.VERCEL = '1'
	try {
		const response = await GET()
		assert.equal(response.headers.get('x-letletme-release'), process.env.VERCEL_GIT_COMMIT_SHA)
		assert.deepEqual(await response.json(), {
			status: 'ok',
			origin: 'vercel',
			release: process.env.VERCEL_GIT_COMMIT_SHA
		})
	} finally {
		for (const name of names) {
			if (previous[name] === undefined) delete process.env[name]
			else process.env[name] = previous[name]
		}
	}
})

test('healthz reports the overseas origin', async () => {
	const names = [
		'LETLETME_ORIGIN',
		'LETLETME_RELEASE_SHA',
		'VERCEL_GIT_COMMIT_SHA',
		'VERCEL',
		'NEXT_DEPLOYMENT_ID'
	] as const
	const previous = Object.fromEntries(
		names.map(name => [name, process.env[name]])
	)
	process.env.LETLETME_ORIGIN = 'overseas'
	process.env.LETLETME_RELEASE_SHA = 'def4567'
	try {
		delete process.env.VERCEL_GIT_COMMIT_SHA
		delete process.env.VERCEL
		delete process.env.NEXT_DEPLOYMENT_ID
		const response = await GET()
		assert.equal(response.headers.get('x-letletme-origin'), 'overseas')
		assert.deepEqual(await response.json(), {
			status: 'ok',
			origin: 'overseas',
			release: 'def4567'
		})
	} finally {
		for (const name of names) {
			if (previous[name] === undefined) delete process.env[name]
			else process.env[name] = previous[name]
		}
	}
})

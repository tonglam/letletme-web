import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
	getLocaleFromInternalPathname,
	getSafeInternalHref,
	isAppLocale,
	LANGUAGE_COOKIE,
	localizeHref,
	localizePathname,
	stripLocaleFromHref,
	stripLocaleFromPathname,
} from '../i18n/routing'
import { getRequestLocale } from '../i18n/request-locale'

test('localizes default and Simplified Chinese paths without changing query or hash', () => {
	assert.equal(localizePathname('/', 'en'), '/')
	assert.equal(localizePathname('/', 'zh-CN'), '/zh-CN')
	assert.equal(localizePathname('/live/points', 'en'), '/live/points')
	assert.equal(localizePathname('/live/points', 'zh-CN'), '/zh-CN/live/points')
	assert.equal(
		localizeHref('/explore/player-stats?p1=7&p2=12#ps-season', 'zh-CN'),
		'/zh-CN/explore/player-stats?p1=7&p2=12#ps-season',
	)
})

test('reads and removes only supported locale prefixes', () => {
	assert.equal(getLocaleFromInternalPathname('/zh-CN/my-fpl/team'), 'zh-CN')
	assert.equal(getLocaleFromInternalPathname('/my-fpl/team'), 'en')
	assert.equal(stripLocaleFromPathname('/zh-CN/my-fpl/team'), '/my-fpl/team')
	assert.equal(stripLocaleFromPathname('/en/my-fpl/team'), '/my-fpl/team')
	assert.equal(stripLocaleFromPathname('/english/my-fpl/team'), '/english/my-fpl/team')
	assert.equal(
		stripLocaleFromHref('/zh-CN/explore/player-stats?p1=7&p2=12#ps-season'),
		'/explore/player-stats?p1=7&p2=12#ps-season',
	)
	assert.equal(isAppLocale('zh-CN'), true)
	assert.equal(isAppLocale('zh'), false)
})

test('accepts only same-origin return paths after removing locale prefixes', () => {
	assert.equal(getSafeInternalHref('/zh-CN/explore/player-stats?p1=7&p2=12#ps-season'), '/explore/player-stats?p1=7&p2=12#ps-season')
	assert.equal(getSafeInternalHref('/en//evil.example'), '/')
	assert.equal(getSafeInternalHref('/zh-CN//evil.example'), '/')
	assert.equal(getSafeInternalHref('//evil.example'), '/')
	assert.equal(getSafeInternalHref('/\\evil.example'), '/')
	assert.equal(getSafeInternalHref('https://evil.example'), '/')
})

test('persists the language preference in the configured one-year cookie', () => {
	assert.equal(LANGUAGE_COOKIE.name, 'NEXT_LOCALE')
	assert.equal(LANGUAGE_COOKIE.maxAge, 60 * 60 * 24 * 365)
	assert.equal(LANGUAGE_COOKIE.sameSite, 'lax')
})

test('request locale prioritizes cookie, then localized referrer, then browser language', () => {
	assert.equal(getRequestLocale(new Request('https://letletme.top', {
		headers: { cookie: 'theme=dark; NEXT_LOCALE=zh-CN' },
	})), 'zh-CN')
	assert.equal(getRequestLocale(new Request('https://letletme.top', {
		headers: {
			cookie: 'NEXT_LOCALE=en',
			referer: 'https://letletme.top/zh-CN/auth/signup',
			'accept-language': 'zh-CN,zh;q=0.9',
		},
	})), 'en')
	assert.equal(getRequestLocale(new Request('https://letletme.top', {
		headers: { referer: 'https://letletme.top/zh-CN/auth/forgot-password' },
	})), 'zh-CN')
	assert.equal(getRequestLocale(new Request('https://letletme.top', {
		headers: { 'accept-language': 'zh-HK,zh;q=0.9,en;q=0.8' },
	})), 'zh-CN')
	assert.equal(getRequestLocale(new Request('https://letletme.top', {
		headers: { 'accept-language': 'en-US,en;q=0.9,zh;q=0' },
	})), 'en')
	assert.equal(getRequestLocale(new Request('https://letletme.top', {
		headers: { 'accept-language': 'fr-FR,zh-CN;q=0.8,en;q=0.7' },
	})), 'zh-CN')
	assert.equal(getRequestLocale(new Request('https://letletme.top', {
		headers: {
			cookie: 'NEXT_LOCALE=%',
			referer: 'https://letletme.top/zh-CN/auth/signup',
		},
	})), 'zh-CN')
	assert.equal(getRequestLocale(), 'en')
})

test('English and Simplified Chinese catalogs have the same keys and variables', async () => {
	const [english, chinese] = await Promise.all([
		readFile(new URL('../messages/en.json', import.meta.url), 'utf8').then(JSON.parse),
		readFile(new URL('../messages/zh-CN.json', import.meta.url), 'utf8').then(JSON.parse),
	])

	const flatten = (value: Record<string, unknown>, prefix = '', result = new Map<string, string>()) => {
		for (const [key, item] of Object.entries(value)) {
			const path = prefix ? `${prefix}.${key}` : key
			if (item && typeof item === 'object' && !Array.isArray(item)) {
				flatten(item as Record<string, unknown>, path, result)
			} else {
				result.set(path, String(item))
			}
		}
		return result
	}
	const variables = (message: string) => new Set(
		Array.from(message.matchAll(/\{\s*([\w]+)(?:\s*,[^}]*)?\}/g), match => match[1]),
	)
	const en = flatten(english)
	const zh = flatten(chinese)

	assert.deepEqual(Array.from(en.keys()).sort(), Array.from(zh.keys()).sort())
	for (const [key, message] of Array.from(en.entries())) {
		assert.deepEqual(
			Array.from(variables(message)).sort(),
			Array.from(variables(zh.get(key) ?? '')).sort(),
			`message variables differ for ${key}`,
		)
	}
})

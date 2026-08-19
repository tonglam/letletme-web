import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
	GLOBAL_CLIENT_NAMESPACES,
	ROUTE_CLIENT_NAMESPACES
} from '../i18n/client-namespaces'
import { selectMessages } from '../i18n/message-selection'
import en from '../messages/en.json'
import zh from '../messages/zh-CN.json'

async function sourceFiles(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true })
	const nested = await Promise.all(
		entries.map(async entry => {
			const file = path.join(directory, entry.name)
			if (entry.isDirectory()) return sourceFiles(file)
			return /\.[jt]sx?$/.test(entry.name) ? [file] : []
		})
	)
	return nested.flat()
}

function keyPaths(value: unknown, prefix = ''): string[] {
	if (value == null || typeof value !== 'object' || Array.isArray(value)) {
		return [prefix]
	}
	return Object.entries(value).flatMap(([key, child]) =>
		keyPaths(child, prefix ? `${prefix}.${key}` : key)
	)
}

describe('client translation namespace lifecycle', () => {
	it('keeps English and Chinese message keys deployment-compatible', () => {
		assert.deepEqual(keyPaths(en).sort(), keyPaths(zh).sort())
	})

	it('covers every client useTranslations namespace in the route matrix', async () => {
		const files = [
			...(await sourceFiles(path.resolve('app'))),
			...(await sourceFiles(path.resolve('components')))
		]
		const used = new Set<string>()
		for (const file of files) {
			const source = await readFile(file, 'utf8')
			if (!/^['"]use client['"]/m.test(source)) continue
			for (const match of Array.from(
				source.matchAll(/useTranslations(?:<[^>]+>)?\(\s*['"]([^'"]+)/g)
			)) {
				used.add((match[1] ?? '').split('.')[0] ?? '')
			}
		}
		const covered = new Set<string>([
			...GLOBAL_CLIENT_NAMESPACES,
			...Object.values(ROUTE_CLIENT_NAMESPACES).flat()
		])
		for (const namespace of Array.from(used)) {
			assert.ok(namespace in en, `English namespace ${namespace} is missing`)
			assert.ok(namespace in zh, `Chinese namespace ${namespace} is missing`)
			assert.ok(
				covered.has(namespace),
				`Client namespace ${namespace} is not routed`
			)
		}
	})

	it('keeps global and Player Stats payloads inside their raw budgets', () => {
		for (const messages of [en, zh]) {
			const globalBytes = Buffer.byteLength(
				JSON.stringify(
					selectMessages(messages as IntlMessages, GLOBAL_CLIENT_NAMESPACES)
				)
			)
			const playerStatsBytes = Buffer.byteLength(
				JSON.stringify(
					selectMessages(
						messages as IntlMessages,
						Array.from(
							new Set([
								...GLOBAL_CLIENT_NAMESPACES,
								...ROUTE_CLIENT_NAMESPACES.playerStats
							])
						)
					)
				)
			)
			assert.ok(
				globalBytes <= 3_000,
				`global messages are ${globalBytes} bytes`
			)
			assert.ok(
				playerStatsBytes <= 32_000,
				`Player Stats messages are ${playerStatsBytes} bytes`
			)
		}
	})
})

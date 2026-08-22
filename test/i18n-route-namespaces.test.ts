import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
	GLOBAL_CLIENT_NAMESPACES,
	ROUTE_CLIENT_NAMESPACES
} from '../i18n/client-namespaces'

const ROOT = process.cwd()
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx']

const ROUTE_ENTRYPOINTS = {
	home: ['app/[locale]/page.tsx'],
	auth: [
		'app/[locale]/auth/forgot-password/page.tsx',
		'app/[locale]/auth/login/page.tsx',
		'app/[locale]/auth/reset-password/page.tsx',
		'app/[locale]/auth/signup/page.tsx',
		'app/[locale]/auth/verify-email/page.tsx'
	],
	fixtures: ['app/[locale]/explore/fixtures/page.tsx'],
	gameweek: ['app/[locale]/explore/gameweek/page.tsx'],
	market: ['app/[locale]/explore/market/page.tsx'],
	playerStats: ['app/[locale]/explore/player-stats/page.tsx'],
	selections: ['app/[locale]/explore/selections/page.tsx'],
	competitionsBrowse: ['app/[locale]/competitions/browse/page.tsx'],
	competitionsCreate: ['app/[locale]/competitions/create/page.tsx'],
	competitionsManage: ['app/[locale]/competitions/[id]/manage/page.tsx'],
	competitionsDetail: ['app/[locale]/competitions/[id]/page.tsx'],
	liveMatches: ['app/[locale]/live/matches/page.tsx'],
	livePoints: [
		'app/[locale]/live/points/page.tsx',
		'app/[locale]/live/points/[id]/page.tsx'
	],
	liveCompetitions: [
		'app/[locale]/live/competitions/page.tsx',
		'app/[locale]/live/competitions/[id]/page.tsx'
	],
	myFpl: [
		'app/[locale]/my-fpl/team/page.tsx',
		'app/[locale]/my-fpl/competitions/page.tsx'
	],
	onboarding: ['app/[locale]/onboarding/bind-entry/page.tsx'],
	profile: [
		'app/[locale]/profile/page.tsx',
		'app/[locale]/profile/sessions/page.tsx'
	]
} as const satisfies Record<keyof typeof ROUTE_CLIENT_NAMESPACES, readonly string[]>

async function sourceFiles(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true })
	const nested = await Promise.all(
		entries.map(async entry => {
			const file = path.join(directory, entry.name)
			if (entry.isDirectory()) return sourceFiles(file)
			return SOURCE_EXTENSIONS.includes(path.extname(entry.name)) ? [file] : []
		})
	)
	return nested.flat()
}

function resolveImport(
	from: string,
	specifier: string,
	knownFiles: Set<string>
): string | null {
	let relativePath: string
	if (specifier.startsWith('@/')) {
		relativePath = specifier.slice(2)
	} else if (specifier.startsWith('.')) {
		relativePath = path.relative(
		ROOT,
		path.resolve(path.dirname(from), specifier)
	)
	} else {
		return null
	}

	const base = path.join(ROOT, relativePath)
	const candidates = [
		base,
		...SOURCE_EXTENSIONS.map(extension => `${base}${extension}`),
		...SOURCE_EXTENSIONS.map(extension =>
			path.join(base, `index${extension}`)
		)
	]
	return candidates.find(candidate => knownFiles.has(candidate)) ?? null
}

async function buildSourceGraph() {
	const files = [
		...(await sourceFiles(path.join(ROOT, 'app'))),
		...(await sourceFiles(path.join(ROOT, 'components')))
	]
	const knownFiles = new Set(files)
	const imports = new Map<string, string[]>()
	const clientNamespaces = new Map<string, string[]>()

	for (const file of files) {
		const source = await readFile(file, 'utf8')
		const runtimeSource = source.replace(
			/\b(?:import|export)\s+type\b[\s\S]*?\bfrom\s+['"][^'"]+['"];?/g,
			''
		)
		const dependencies = new Set<string>()
		Array.from(
			runtimeSource.matchAll(
				/(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g
			)
		).forEach(match => {
			const dependency = resolveImport(file, match[1], knownFiles)
			if (dependency) dependencies.add(dependency)
		})
			imports.set(file, Array.from(dependencies))

		if (/^\s*["']use client["']/m.test(source)) {
			const namespaces = new Set<string>()
			Array.from(
				source.matchAll(
					/useTranslations(?:<[^>]+>)?\(\s*['"]([^'"]+)/g
				)
			).forEach(match => {
				namespaces.add(match[1].split('.')[0])
			})
			clientNamespaces.set(file, Array.from(namespaces))
		}
	}

	return { imports, clientNamespaces }
}

function collectReachable(
	seeds: readonly string[],
	imports: Map<string, string[]>
) {
	const reachable = new Set<string>()
	const queue = seeds.map(seed => path.join(ROOT, seed))
	while (queue.length > 0) {
		const file = queue.shift()
		if (!file || reachable.has(file) || !imports.has(file)) continue
		reachable.add(file)
		queue.push(...(imports.get(file) ?? []))
	}
	return reachable
}

describe('route client translation namespace dependencies', () => {
	it('provides every transitive client namespace on its route', async () => {
		const { imports, clientNamespaces } = await buildSourceGraph()

		for (const [route, entrypoints] of Object.entries(ROUTE_ENTRYPOINTS)) {
			const reachable = collectReachable(entrypoints, imports)
			const required = new Set<string>()
			Array.from(reachable).forEach(file => {
				for (const namespace of clientNamespaces.get(file) ?? []) {
					required.add(namespace)
				}
			})

			const provided = new Set<string>([
				...GLOBAL_CLIENT_NAMESPACES,
				...ROUTE_CLIENT_NAMESPACES[
					route as keyof typeof ROUTE_CLIENT_NAMESPACES
				]
			])
			const missing = Array.from(required).filter(namespace => !provided.has(namespace))
			assert.deepEqual(
				missing,
				[],
				`${route} is missing client namespaces: ${missing.join(', ')}`
			)
		}
	})
})

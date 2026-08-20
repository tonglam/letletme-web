import type { SquadTeamCode } from '@/components/squad-pitch/SquadPitch'

export const SQUAD_TEAM_CODES: readonly SquadTeamCode[] = [
	'ARS',
	'AVL',
	'BOU',
	'BRE',
	'BHA',
	'CHE',
	'COV',
	'CRY',
	'EVE',
	'FUL',
	'HUL',
	'IPS',
	'LEE',
	'LIV',
	'MCI',
	'MUN',
	'NEW',
	'NFO',
	'SUN',
	'TOT',
]

const TEAM_CODE_BY_ALIAS: Record<string, SquadTeamCode> = {
	ARS: 'ARS',
	ARSENAL: 'ARS',
	AVL: 'AVL',
	'ASTON VILLA': 'AVL',
	BOU: 'BOU',
	BOURNEMOUTH: 'BOU',
	BRE: 'BRE',
	BRENTFORD: 'BRE',
	BHA: 'BHA',
	BRIGHTON: 'BHA',
	CHE: 'CHE',
	CHELSEA: 'CHE',
	COV: 'COV',
	COVENTRY: 'COV',
	CRY: 'CRY',
	'CRYSTAL PALACE': 'CRY',
	EVE: 'EVE',
	EVERTON: 'EVE',
	FUL: 'FUL',
	FULHAM: 'FUL',
	HUL: 'HUL',
	'HULL CITY': 'HUL',
	IPS: 'IPS',
	IPSWICH: 'IPS',
	LEE: 'LEE',
	LEEDS: 'LEE',
	LIV: 'LIV',
	LIVERPOOL: 'LIV',
	MCI: 'MCI',
	'MAN CITY': 'MCI',
	'MANCHESTER CITY': 'MCI',
	MUN: 'MUN',
	'MAN UNITED': 'MUN',
	'MANCHESTER UNITED': 'MUN',
	NEW: 'NEW',
	NEWCASTLE: 'NEW',
	'NEWCASTLE UNITED': 'NEW',
	NFO: 'NFO',
	'NOTTINGHAM FOREST': 'NFO',
	SUN: 'SUN',
	SUNDERLAND: 'SUN',
	TOT: 'TOT',
	TOTTENHAM: 'TOT',
	'TOTTENHAM HOTSPUR': 'TOT',
}

export function isSquadTeamCode(value: string): value is SquadTeamCode {
	return (SQUAD_TEAM_CODES as readonly string[]).includes(value)
}

export function resolveSquadTeamCode(
	teamShort: string,
	teamName?: string
): SquadTeamCode | null {
	const aliases = [teamShort, teamName ?? '']
		.map(value => value.trim().toUpperCase())
		.filter(Boolean)

	for (const alias of aliases) {
		const mapped = TEAM_CODE_BY_ALIAS[alias]
		if (mapped) return mapped
		if (isSquadTeamCode(alias)) return alias
	}

	return null
}

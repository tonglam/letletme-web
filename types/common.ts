// Common types used across the application

// Position types
export type Position = 'GKP' | 'DEF' | 'MID' | 'FWD'

// Team types
export type Team =
	| 'ARS'
	| 'AVL'
	| 'BHA'
	| 'BOU'
	| 'BRE'
	| 'CHE'
	| 'CRY'
	| 'EVE'
	| 'FUL'
	| 'LIV'
	| 'LUT'
	| 'MCI'
	| 'MUN'
	| 'NEW'
	| 'NFO'
	| 'SHU'
	| 'TOT'
	| 'WHU'
	| 'WOL'
	| 'BUR'
	| 'ALL'

// Map of team abbreviations to full names
export const teamFullNames: Record<Team, string> = {
	ARS: 'Arsenal',
	AVL: 'Aston Villa',
	BHA: 'Brighton',
	BOU: 'Bournemouth',
	BRE: 'Brentford',
	CHE: 'Chelsea',
	CRY: 'Crystal Palace',
	EVE: 'Everton',
	FUL: 'Fulham',
	LIV: 'Liverpool',
	LUT: 'Luton Town',
	MCI: 'Manchester City',
	MUN: 'Manchester United',
	NEW: 'Newcastle',
	NFO: 'Nottingham Forest',
	SHU: 'Sheffield United',
	TOT: 'Tottenham',
	WHU: 'West Ham',
	WOL: 'Wolves',
	BUR: 'Burnley',
	ALL: 'All Teams'
}

// Player option type
export interface PlayerOption {
	id: string
	name: string
	position: Position
	team: Team
	price: number
}

// Transfer types
export interface Transfer {
	player: string
	team: Team
	price: number
	priceChange: number
	selected: number
}

export interface TransferPair {
	in: Transfer
	out: Transfer
}

// Price change types
export interface PriceChange {
	player: string
	team: Team
	price: number
	change: number
	selected: number
}

// Stat configuration
export interface StatConfig {
	label: string
	key: string
	description: string
}

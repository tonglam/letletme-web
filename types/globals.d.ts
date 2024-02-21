export {}

export type Roles = 'admin' | 'user'

declare global {
	interface CustomJwtSessionClaims {
		metadata: {
			role?: Roles
		}
	}
}

export type PriceChangeResData = {
	changDate: string
	changeType: PriceChangeType
	element: number
	elementType: number
	elementTypeName: string
	event: number
	lastValue: number
	teamId: number
	teamName: string
	teamShortName: string
	value: number
	webName: string
}

export enum PriceChangeType {
	'Rise',
	'Faller',
	'Start'
}

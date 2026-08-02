import { normalizePosition } from '@/lib/utils'

/**
 * Broadcast-kit position colours. Theme-independent brand solids — they read
 * identically on chalk (light) and under floodlights (dark), unlike the old
 * pastel Tailwind swatches.
 */
export function positionBadgeClass(position: string): string {
	switch (normalizePosition(position)) {
		case 'GKP':
			return 'border-transparent bg-amber-300 text-amber-950'
		case 'DEF':
			return 'border-transparent bg-electric text-plum'
		case 'MID':
			return 'border-transparent bg-pink text-pink-950'
		case 'FWD':
			return 'border-transparent bg-plum text-electric'
		default:
			return 'bg-secondary text-secondary-foreground'
	}
}

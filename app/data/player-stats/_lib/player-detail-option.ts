import type { PlayerDirectoryOption } from '@/components/player/PlayerDirectoryPicker'
import type { PlayerDetailData } from '@/lib/graphql/operations/players'
import type { Position } from '@/types/common'

const ELEMENT_TYPE_POSITION: Record<number, Position> = {
	1: 'GKP',
	2: 'DEF',
	3: 'MID',
	4: 'FWD'
}

export function playerDetailToDirectoryOption(
	detail: PlayerDetailData
): PlayerDirectoryOption {
	return {
		id: String(detail.id),
		name: detail.webName,
		position: ELEMENT_TYPE_POSITION[detail.elementType] ?? 'MID',
		teamShortName: detail.teamShortName,
		teamName: detail.teamShortName,
		price: detail.price,
		selectedByPercent: detail.selectedByPercent,
		totalPoints: detail.totalPoints,
		form: detail.form
	}
}

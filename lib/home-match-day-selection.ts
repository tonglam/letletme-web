export type HomeMatchDayDate = {
	dateKey: string
}

function pad2(value: number): string {
	return String(value).padStart(2, '0')
}

function localDateKey(date: Date): string {
	return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function resolvePreferredHomeMatchDayKey(
	matchDays: readonly HomeMatchDayDate[],
	now = new Date()
): string {
	const todayKey = localDateKey(now)
	return (
		matchDays.find(matchDay => matchDay.dateKey === todayKey)?.dateKey ??
		matchDays[0]?.dateKey ??
		''
	)
}

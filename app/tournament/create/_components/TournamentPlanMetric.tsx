export function TournamentPlanMetric({ label, value }: { label: string; value: string | number }) {
	return (
		<div className="rounded-lg bg-accent/30 p-4">
			<p className="text-sm text-muted-foreground">{label}</p>
			<p className="text-2xl font-semibold">{value}</p>
		</div>
	)
}

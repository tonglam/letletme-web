import type { AgentToolResponse, LetLetMeToolName } from '@/lib/agent-tools/contracts'
import { runBriefing, runContext, runMarket } from '@/lib/agent-tools/context-market-briefing'
import { runCompetition, runEntry } from '@/lib/agent-tools/entry-competition'
import { runGameweek, runPlayers } from '@/lib/agent-tools/players-gameweek'
import type { ToolRunOptions } from '@/lib/agent-tools/runtime'

export async function runAgentTool<T extends LetLetMeToolName>(
	options: ToolRunOptions<T>
): Promise<AgentToolResponse<unknown>> {
	switch (options.tool) {
		case 'letletme_context':
			return runContext(options as ToolRunOptions<'letletme_context'>)
		case 'letletme_players':
			return runPlayers(options as ToolRunOptions<'letletme_players'>)
		case 'letletme_gameweek':
			return runGameweek(options as ToolRunOptions<'letletme_gameweek'>)
		case 'letletme_market':
			return runMarket(options as ToolRunOptions<'letletme_market'>)
		case 'letletme_entry':
			return runEntry(options as ToolRunOptions<'letletme_entry'>)
		case 'letletme_competition':
			return runCompetition(options as ToolRunOptions<'letletme_competition'>)
		case 'letletme_briefing':
			return runBriefing(options as ToolRunOptions<'letletme_briefing'>)
	}
}

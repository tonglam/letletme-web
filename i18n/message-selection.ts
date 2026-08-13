import type { ClientMessageNamespace } from '@/i18n/client-namespaces'

export function selectMessages(
	messages: IntlMessages,
	namespaces: readonly ClientMessageNamespace[]
): Partial<IntlMessages> {
	const selected: Record<string, unknown> = {}
	for (const namespace of Array.from(
		new Set<ClientMessageNamespace>(namespaces)
	)) {
		selected[namespace] = messages[namespace]
	}
	return selected as Partial<IntlMessages>
}

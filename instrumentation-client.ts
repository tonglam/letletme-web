import { markRouteNavigationStart } from './lib/analytics/route-navigation'

export function onRouterTransitionStart(
	url: string,
	_navigationType: 'push' | 'replace' | 'traverse'
): void {
	markRouteNavigationStart(url)
}

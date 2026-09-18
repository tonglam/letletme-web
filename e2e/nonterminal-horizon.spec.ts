import { expect, test, type Request } from '@playwright/test'

test.skip(process.env.E2E_NONTERMINAL_HORIZON !== '1', 'Requires its own standalone server and cache directory')
const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
async function control(rules: unknown[] = []) {
 const response = await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules }) })
 expect(response.ok).toBe(true)
}
test.afterEach(async () => { await control() })

	test('FIX03 nonterminal 5 to 8 to 3 ignores stale results and returns to the seed without requests', async ({ page }) => {
		await control([{ operation: 'GetCoreEventContext', data: { coreEventContext: {
			season: '2627', revision: 'horizon-gw30', sourceCheckedAt: '2026-08-13T09:40:00.000Z',
			currentEventId: 30, nextEventId: 31, latestFinishedEventId: 29,
			nextDeadlineTime: '2026-08-14T17:30:00.000Z'
		} } }])
		let release = () => {}
		let started = () => {}
		let settled = () => {}
		const gate = new Promise<void>(resolve => { release = resolve })
		const pending = new Promise<void>(resolve => { started = resolve })
		const done = new Promise<void>(resolve => { settled = resolve })
		let firstRequest: Request | undefined
		let finishFirst = (_: 'finished' | 'failed') => {}
		const firstTerminal = new Promise<'finished' | 'failed'>(resolve => { finishFirst = resolve })
		page.on('requestfinished', request => { if (request === firstRequest) finishFirst('finished') })
		page.on('requestfailed', request => { if (request === firstRequest) finishFirst('failed') })
		let requests = 0
		await page.route('**/api/fixtures/window?**', async route => {
			requests += 1
			if (requests === 1) {
				firstRequest = route.request()
				started()
				await gate
			}
			try { await route.continue() } catch { /* Selection may abort the stale request. */ }
			finally { settled() }
		})
		try {
			await page.goto('/explore/fixtures')
			const five = page.getByRole('button', { name: '5 GWs', exact: true })
			const eight = page.getByRole('button', { name: '8 GWs', exact: true })
			const three = page.getByRole('button', { name: '3 GWs', exact: true })
			await expect(page.getByRole('columnheader', { name: 'GW30', exact: true })).toBeVisible()
			await expect(five).toHaveAttribute('aria-pressed', 'true')
			await eight.click()
			await pending
			await expect(five).toHaveAttribute('aria-pressed', 'true')
			await expect(eight).toHaveAttribute('aria-busy', 'true')
			await three.click()
			await expect(three).toHaveAttribute('aria-pressed', 'true')
			release()
			await done
			const terminal = await firstTerminal
			if (terminal === 'failed') {
				expect(firstRequest?.failure()?.errorText).toMatch(/aborted|cancelled/i)
			} else {
				const response = await firstRequest!.response()
				expect(response?.ok()).toBe(true)
				await response!.finished()
			}
			// Observe after the terminal browser event and a rendering opportunity.
			await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
			await expect(three).toHaveAttribute('aria-pressed', 'true')
			await expect(page.getByRole('columnheader', { name: 'GW33', exact: true })).toHaveCount(0)
			await expect(page.getByRole('columnheader', { name: 'GW37', exact: true })).toHaveCount(0)
			await five.click()
			await expect(five).toHaveAttribute('aria-pressed', 'true')
			await expect(page.getByRole('columnheader', { name: 'GW34', exact: true })).toBeVisible()
			expect(requests).toBe(1)
			await eight.click()
			await expect(eight).toHaveAttribute('aria-pressed', 'true')
			await expect(page.getByRole('columnheader', { name: 'GW37', exact: true })).toBeVisible()
			expect(requests).toBe(2)
		} finally { release() }
	})

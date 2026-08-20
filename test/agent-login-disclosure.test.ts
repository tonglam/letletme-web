import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('Desk Agent login is explicit and discloses model-provider data sharing', async () => {
	const [page, client, english, chinese] = await Promise.all([
		readFile('app/[locale]/auth/login/page.tsx', 'utf8'),
		readFile('app/auth/login/LoginClient.tsx', 'utf8'),
		readFile('messages/en.json', 'utf8'),
		readFile('messages/zh-CN.json', 'utf8')
	])
	assert.match(page, /query\.client.*desk-agent/)
	assert.match(client, /deskAgentDisclosure/)
	assert.match(english, /model provider you selected in LetLetMe Desk/)
	assert.match(chinese, /LetLetMe Desk 中选择的模型服务商/)
})

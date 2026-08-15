const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')

const nginxTemplate = fs.readFileSync(
	'ops/tencent/nginx/letletme.conf',
	'utf8'
)

test('Tencent Nginx pins the public host and advertises the cleartext upstream transport', () => {
	assert.match(nginxTemplate, /server_name letletme\.top;/)
	assert.match(nginxTemplate, /proxy_set_header Host letletme\.top;/)
	assert.match(
		nginxTemplate,
		/proxy_set_header X-Forwarded-Proto http;/
	)
	assert.doesNotMatch(
		nginxTemplate,
		/proxy_set_header X-Forwarded-Proto https;/
	)
	assert.match(nginxTemplate, /proxy_hide_header X-Middleware-Rewrite;/)
})

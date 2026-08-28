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

test('Tencent immutable static assets do not advertise mutable application release metadata', () => {
	const staticLocation = nginxTemplate.match(
		/location \^~ \/_next\/static\/ \{([\s\S]*?)\n\t\}/
	)?.[1]

	assert.ok(staticLocation)
	assert.match(
		staticLocation,
		/add_header Cache-Control "public, max-age=31536000, immutable" always;/
	)
	assert.match(
		staticLocation,
		/add_header X-Letletme-Origin "tencent" always;/
	)
	assert.doesNotMatch(staticLocation, /X-Letletme-Release/)
})

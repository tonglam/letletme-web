import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const site = fs.readFileSync('ops/overseas/nginx/letletme-web.conf', 'utf8')
const activation = fs.readFileSync(
	'ops/overseas/activate-api-ingress.sh',
	'utf8'
)
const imageWorkflow = fs.readFileSync(
	'.github/workflows/release-web-image.yml',
	'utf8'
)

test('overseas Web ingress uses the active slot and canonical host', () => {
	assert.match(
		site,
		/server_name letletme\.top www\.letletme\.top eo-overseas-canary\.letletme\.top;/
	)
	assert.match(site, /proxy_pass http:\/\/letletme_web_active;/)
	assert.match(site, /proxy_set_header Host letletme\.top;/)
	assert.match(site, /proxy_set_header X-LetLetMe-Proxy-Secret \$letletme_local_proxy_secret;/)
	assert.match(site, /proxy_set_header X-Forwarded-Proto http;/)
	assert.match(site, /proxy_set_header X-LetLetMe-Origin-Token "";/)
	assert.match(site, /if \(\$letletme_web_origin_authorized = 0\)/)
	assert.match(site, /ssl_certificate \/etc\/letsencrypt\/live\/letletme\.top\//)
})

test('overseas ingress serializes GraphQL and Web slot authorities', () => {
	assert.match(activation, /readonly slot_lock=\/var\/lib\/letletme-graphql\/switch-slot\.lock/)
	assert.match(activation, /readonly web_slot_lock=\/var\/lib\/letletme-web\/switch-slot\.lock/)
	assert.match(activation, /exec flock -x "\$slot_lock" "\$0" --slot-lock-held/)
	assert.match(activation, /exec 8<>"\$web_slot_lock"/)
	assert.match(activation, /flock -x 8/)
	assert.match(activation, /\[\[ -f \$slot_lock && ! -L \$slot_lock \]\]/)
	assert.match(activation, /\[\[ -f \$web_slot_lock && ! -L \$web_slot_lock \]\]/)
	assert.match(activation, /hashlib\.sha256/)
	assert.match(activation, /LETLETME_LOCAL_PROXY_SECRET/)
	assert.match(activation, /127\.0\.0\.1:\$web_active_port\/healthz/)
	assert.doesNotMatch(activation, /127\.0\.0\.1:3000\/healthz/)
	assert.match(activation, /X-LetLetMe-Perf-Source: synthetic/)
})

test('standalone image build uses exact SHA and a BuildKit-only production key', () => {
	assert.match(imageWorkflow, /ref: \$\{\{ env\.RELEASE_SHA \}\}/)
	assert.match(imageWorkflow, /main_sha.*RELEASE_SHA/s)
	assert.match(imageWorkflow, /env pull "\$source_env"/)
	assert.match(imageWorkflow, /id=web_build_env,src=\/tmp\/letletme-web-build-env/)
	assert.match(imageWorkflow, /NEXT_SERVER_ACTIONS_ENCRYPTION_KEY/)
	assert.match(imageWorkflow, /environment: production/)
	assert.match(imageWorkflow, /--platform linux\/amd64/)
	assert.match(fs.readFileSync('Dockerfile', 'utf8'), /COPY package\.json package-lock\.json \.npmrc \.\//)
	assert.doesNotMatch(
		fs.readFileSync('Dockerfile', 'utf8'),
		/NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=A{10,}/
	)
})

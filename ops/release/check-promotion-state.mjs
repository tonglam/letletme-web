import { readFileSync } from 'node:fs'

// CLI promote status ignores requests older than three minutes. Inspect the raw
// rollbackInfo response without applying an age threshold; never print secrets.
try {
 const project = JSON.parse(readFileSync(0, 'utf8'))
 if (!process.env.VERCEL_PROJECT_ID || !process.env.VERCEL_ORG_ID ||
     project.id !== process.env.VERCEL_PROJECT_ID || project.accountId !== process.env.VERCEL_ORG_ID) {
  throw new Error('Promotion project identity mismatch')
 }
 if (project.rollingRelease) throw new Error('Rolling release requires separate acceptance')
 if (!Object.hasOwn(project, 'lastAliasRequest')) throw new Error('Promotion state is missing')
 const request = project.lastAliasRequest
 const requireSuccess = process.argv.includes('--require-success')
 if (request === null && !requireSuccess) {
  console.log('No previous alias operation')
 } else {
  if (!request || !['succeeded', 'failed', 'skipped'].includes(request.jobStatus)) {
   throw new Error('Alias operation is pending or unknown; do not start another release')
  }
  if (requireSuccess && (request.jobStatus !== 'succeeded' || request.type !== 'promote')) {
   throw new Error('Successful promotion is not confirmed')
  }
  console.log('Alias operation is terminal; actual release identity must still be verified')
 }
} catch (error) {
 console.error(error instanceof SyntaxError ? 'Invalid promotion response' : error.message)
 process.exitCode = 1
}

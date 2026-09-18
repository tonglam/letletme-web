// Test-only server clone: fixture mutations must not seed the shared Next cache.
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
const root = process.cwd()
const directory = await mkdtemp(path.join(tmpdir(), 'letletme-horizon-'))
let child
const stop = signal => child?.kill(signal)
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
try {
 const source = path.join(root, '.next/standalone')
 await cp(source, directory, { recursive: true, filter: file => { const relative = path.relative(source, file); return relative !== path.join('.next', 'cache') && !relative.startsWith(path.join('.next', 'cache') + path.sep) } })
 await cp(path.join(root, 'public'), path.join(directory, 'public'), { recursive: true })
 await cp(path.join(root, '.next/static'), path.join(directory, '.next/static'), { recursive: true })
 child = spawn(process.execPath, ['--import', path.join(root, 'e2e/fixtures/fpl-fetch.mjs'), path.join(directory, 'server.js')], { cwd: directory, env: process.env, stdio: 'inherit' })
 const code = await new Promise((resolve, reject) => {
  child.once('error', reject)
  child.once('exit', (code, signal) => resolve(code ?? (signal ? 0 : 1)))
 })
 process.exitCode = code
} finally {
 await rm(directory, { recursive: true, force: true })
}

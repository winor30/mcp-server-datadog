import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { version } from '../package.json'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cliEntry = resolve(repoRoot, 'build/index.js')

function runCli(flag: string) {
  const env = { ...process.env }
  delete env.DATADOG_API_KEY
  delete env.DATADOG_APP_KEY

  return spawnSync(process.execPath, [cliEntry, flag], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
    timeout: 3000,
  })
}

describe('CLI metadata flags', () => {
  beforeAll(() => {
    const result = spawnSync('pnpm', ['build'], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 30000,
    })

    expect(result.status, result.stderr || result.stdout).toBe(0)
  })

  it('prints the package version without Datadog credentials', () => {
    const result = runCli('--version')

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe(version)
    expect(result.stderr).toBe('')
  })

  it('prints help without Datadog credentials', () => {
    const result = runCli('--help')

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('mcp-server-datadog')
    expect(result.stdout).toContain('--version')
    expect(result.stderr).toBe('')
  })
})

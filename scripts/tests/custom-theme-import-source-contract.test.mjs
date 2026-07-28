import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

describe('custom theme import/export source contract', () => {
  it('keeps both prefixes on one parser and exports the versioned pi prefix', () => {
    const source = readFileSync(
      join(root, 'src/renderer/src/lib/theme/parse-theme-string.ts'),
      'utf8',
    )

    assert.match(source, /const PREFIXES = \['pi-theme-v1', 'codex-theme-v1'\]/)
    assert.match(source, /export function parseThemeString/)
    assert.match(source, /export function exportThemeString/)
    assert.match(source, /return `pi-theme-v1:/)
  })
})

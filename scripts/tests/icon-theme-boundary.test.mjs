import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const sourceRoots = [join(root, 'src/renderer/src'), join(root, 'src/extension-compat/renderer')]
const vendorPattern = /from ['"](?:lucide-react|@phosphor-icons\/react(?:\/[^'"]*)?|@fluentui\/react-icons(?:\/[^'"]*)?|@hugeicons\/(?:react|core-free-icons)|iconoir-react(?:\/[^'"]*)?)['"]/g

function sourceFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) files.push(...sourceFiles(path))
    else if (/\.[jt]sx?$/.test(path)) files.push(path)
  }
  return files
}

describe('icon theme source boundary', () => {
  it('keeps vendor icon imports inside the icon infrastructure', () => {
    const violations = []
    for (const dir of sourceRoots) {
      for (const file of sourceFiles(dir)) {
        const source = readFileSync(file, 'utf8')
        const imports = source.match(vendorPattern) || []
        if (imports.length && !file.includes(join('components', 'icons'))) {
          violations.push(`${relative(root, file)}: ${imports.join(', ')}`)
        }
      }
    }
    assert.deepEqual(violations, [])
  })

  it('does not use vendor namespace imports or vendor component types in business code', () => {
    const violations = []
    for (const dir of sourceRoots) {
      for (const file of sourceFiles(dir)) {
        if (file.includes(join('components', 'icons'))) continue
        const source = readFileSync(file, 'utf8')
        if (/import\s+\*\s+as\s+\w+\s+from\s+['"](?:lucide-react|@phosphor-icons|@fluentui|@hugeicons|iconoir-react)/.test(source)) violations.push(relative(root, file))
        if (/\bLucideIcon\b/.test(source)) violations.push(relative(root, file))
      }
    }
    assert.deepEqual(violations, [])
  })
})

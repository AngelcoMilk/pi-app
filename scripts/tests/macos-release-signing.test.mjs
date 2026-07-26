import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

const root = process.cwd()
const workflowPath = join(root, '.github/workflows/release.yml')

function macJobSource() {
  const workflow = readFileSync(workflowPath, 'utf8')
  const start = workflow.indexOf('  build-mac:')
  const end = workflow.indexOf('\n  build-linux:', start)
  assert.ok(start >= 0 && end > start, 'build-mac job missing')
  return workflow.slice(start, end)
}

function stepSource(job, name, nextName) {
  const start = job.indexOf(`      - name: ${name}`)
  const end = nextName ? job.indexOf(`\n      - name: ${nextName}`, start) : job.length
  assert.ok(start >= 0 && end > start, `${name} step missing`)
  return job.slice(start, end)
}

describe('macOS optional signing release contract', () => {
  it('detects whether all five Apple credentials are available without failing on missing values', () => {
    const macJob = macJobSource()
    const detectStep = stepSource(macJob, 'Detect macOS signing credentials', 'Package signed macOS')

    assert.match(detectStep, /id:\s*mac_signing/)
    assert.match(detectStep, /MACOS_CERTIFICATE:\s*\$\{\{\s*secrets\.MACOS_CERTIFICATE\s*\}\}/)
    assert.match(
      detectStep,
      /MACOS_CERTIFICATE_PASSWORD:\s*\$\{\{\s*secrets\.MACOS_CERTIFICATE_PASSWORD\s*\}\}/,
    )
    assert.match(detectStep, /APPLE_API_KEY_CONTENT:\s*\$\{\{\s*secrets\.APPLE_API_KEY\s*\}\}/)
    assert.match(detectStep, /APPLE_API_KEY_ID:\s*\$\{\{\s*secrets\.APPLE_API_KEY_ID\s*\}\}/)
    assert.match(detectStep, /APPLE_API_ISSUER:\s*\$\{\{\s*secrets\.APPLE_API_ISSUER\s*\}\}/)
    assert.match(
      detectStep,
      /-n "\$MACOS_CERTIFICATE" && -n "\$MACOS_CERTIFICATE_PASSWORD" && -n "\$APPLE_API_KEY_CONTENT" && -n "\$APPLE_API_KEY_ID" && -n "\$APPLE_API_ISSUER"/,
    )
    assert.match(detectStep, /enabled=true/)
    assert.match(detectStep, /enabled=false/)
    assert.doesNotMatch(detectStep, /:\s*"\$\{[^}]+:\?/) // no shell fail-closed expansion
  })

  it('uses mutually exclusive signed and unsigned package steps', () => {
    const macJob = macJobSource()
    const signedStep = stepSource(macJob, 'Package signed macOS', 'Package unsigned macOS')
    const unsignedStep = stepSource(macJob, 'Package unsigned macOS', 'Remove App Store Connect private key')

    assert.match(signedStep, /if:\s*steps\.mac_signing\.outputs\.enabled == 'true'/)
    assert.match(signedStep, /CSC_LINK:\s*\$\{\{\s*secrets\.MACOS_CERTIFICATE\s*\}\}/)
    assert.match(
      signedStep,
      /CSC_KEY_PASSWORD:\s*\$\{\{\s*secrets\.MACOS_CERTIFICATE_PASSWORD\s*\}\}/,
    )
    assert.match(signedStep, /APPLE_API_KEY_ID:\s*\$\{\{\s*secrets\.APPLE_API_KEY_ID\s*\}\}/)
    assert.match(signedStep, /APPLE_API_ISSUER:\s*\$\{\{\s*secrets\.APPLE_API_ISSUER\s*\}\}/)

    assert.match(unsignedStep, /if:\s*steps\.mac_signing\.outputs\.enabled != 'true'/)
    assert.match(unsignedStep, /CSC_IDENTITY_AUTO_DISCOVERY:\s*['"]?false['"]?/)
    for (const variable of [
      'CSC_LINK',
      'CSC_KEY_PASSWORD',
      'APPLE_API_KEY',
      'APPLE_API_KEY_ID',
      'APPLE_API_ISSUER',
    ]) {
      assert.doesNotMatch(unsignedStep, new RegExp(`${variable}:`))
    }
    assert.doesNotMatch(signedStep, /continue-on-error/)
  })

  it('writes and removes the private key only for signed builds', () => {
    const macJob = macJobSource()
    const detectStep = stepSource(macJob, 'Detect macOS signing credentials', 'Package signed macOS')
    const cleanupStep = stepSource(
      macJob,
      'Remove App Store Connect private key',
      'Verify signed macOS Gatekeeper acceptance',
    )

    assert.match(detectStep, /key_path="\$RUNNER_TEMP\/AuthKey_\$\{APPLE_API_KEY_ID\}\.p8"/)
    assert.match(detectStep, /printf '%s\\n' "\$APPLE_API_KEY_CONTENT" > "\$key_path"/)
    assert.match(detectStep, /chmod 600 "\$key_path"/)
    assert.match(detectStep, /echo "APPLE_API_KEY=\$key_path" >> "\$GITHUB_ENV"/)
    assert.match(cleanupStep, /if:\s*always\(\) && steps\.mac_signing\.outputs\.enabled == 'true'/)
    assert.match(cleanupStep, /rm -f "\$APPLE_API_KEY"/)
  })

  it('runs Gatekeeper verification only for signed builds and uploads either mode', () => {
    const macJob = macJobSource()
    const verifyStep = stepSource(
      macJob,
      'Verify signed macOS Gatekeeper acceptance',
      'Upload build artifacts',
    )
    const uploadStep = stepSource(macJob, 'Upload build artifacts')

    assert.match(verifyStep, /if:\s*steps\.mac_signing\.outputs\.enabled == 'true'/)
    assert.match(verifyStep, /codesign --verify --deep --strict/)
    assert.match(verifyStep, /spctl --assess --type execute/)
    assert.match(verifyStep, /xcrun stapler validate/)
    assert.doesNotMatch(verifyStep, /continue-on-error/)
    assert.doesNotMatch(uploadStep, /if:\s*(?:always\(\)|steps\.mac_signing)/)
    assert.match(uploadStep, /dist\/\*\.dmg/)
    assert.match(uploadStep, /dist\/\*\.zip/)
  })
})

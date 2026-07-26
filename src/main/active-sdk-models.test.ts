import { existsSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { basename, join } from 'path'
import { describe, expect, it, vi } from 'vitest'
import {
  listAvailableModelsWithSdk,
  resolveAvailableModels,
  UNSUPPORTED_MODEL_SDK_ERROR,
  validateModelsConfigWithSdk,
  validateModelsPathWithSdk,
} from './active-sdk-models'

describe('active SDK model compatibility', () => {
  it('should_validate_models_with_the_modern_model_runtime', async () => {
    const getError = vi.fn(() => 'modern schema error')
    const create = vi.fn(async () => ({ getError }))

    await expect(
      validateModelsPathWithSdk({ ModelRuntime: { create } }, 'C:/tmp/models.json'),
    ).resolves.toBe('modern schema error')
    expect(create).toHaveBeenCalledWith({
      modelsPath: 'C:/tmp/models.json',
      allowModelNetwork: false,
    })
    expect(getError).toHaveBeenCalledOnce()
  })

  it('should_validate_models_with_the_legacy_registry', async () => {
    const auth = {}
    const getModelsJsonError = vi.fn(() => 'legacy schema error')
    const authCreate = vi.fn(() => auth)
    const registryCreate = vi.fn(() => ({ getModelsJsonError }))

    await expect(
      validateModelsPathWithSdk(
        {
          AuthStorage: { create: authCreate },
          ModelRegistry: { create: registryCreate },
        },
        'C:/tmp/models.json',
      ),
    ).resolves.toBe('legacy schema error')
    expect(registryCreate).toHaveBeenCalledWith(auth, 'C:/tmp/models.json')
  })

  it('should_return_a_stable_error_for_an_unsupported_sdk', async () => {
    await expect(validateModelsPathWithSdk({}, 'C:/tmp/models.json')).resolves.toBe(
      UNSUPPORTED_MODEL_SDK_ERROR,
    )
  })

  it('should_reject_a_modern_runtime_without_the_validation_api', async () => {
    await expect(
      validateModelsPathWithSdk(
        { ModelRuntime: { create: vi.fn(async () => ({})) } },
        'C:/tmp/models.json',
      ),
    ).resolves.toBe(UNSUPPORTED_MODEL_SDK_ERROR)
  })

  it('should_reject_a_legacy_registry_without_the_validation_api', async () => {
    await expect(
      validateModelsPathWithSdk(
        {
          AuthStorage: { create: vi.fn(() => ({})) },
          ModelRegistry: { create: vi.fn(() => ({})) },
        },
        'C:/tmp/models.json',
      ),
    ).resolves.toBe(UNSUPPORTED_MODEL_SDK_ERROR)
  })

  it('should_remove_the_temporary_models_file_after_validation', async () => {
    const agentDir = mkdtempSync(join(tmpdir(), 'pi-model-validation-'))
    let modelsPath = ''
    const create = vi.fn(async (options?: { modelsPath?: string | null }) => {
      modelsPath = options?.modelsPath || ''
      expect(existsSync(modelsPath)).toBe(true)
      expect(basename(modelsPath)).toMatch(/^\.models-json-validate-/)
      return { getError: () => undefined }
    })

    await expect(
      validateModelsConfigWithSdk(
        { ModelRuntime: { create } },
        agentDir,
        { providers: {} },
      ),
    ).resolves.toBeUndefined()
    expect(existsSync(modelsPath)).toBe(false)
  })

  it('should_remove_the_temporary_models_file_when_validation_throws', async () => {
    const agentDir = mkdtempSync(join(tmpdir(), 'pi-model-validation-error-'))
    let modelsPath = ''
    const create = vi.fn(async (options?: { modelsPath?: string | null }) => {
      modelsPath = options?.modelsPath || ''
      throw new Error('validation failed')
    })

    await expect(
      validateModelsConfigWithSdk(
        { ModelRuntime: { create } },
        agentDir,
        { providers: {} },
      ),
    ).rejects.toThrow('validation failed')
    expect(existsSync(modelsPath)).toBe(false)
  })

  it('should_list_available_models_with_the_modern_model_runtime', async () => {
    const models = [{ id: 'modern', provider: 'test' }]
    const create = vi.fn(async () => ({ getAvailable: vi.fn(async () => models) }))

    await expect(listAvailableModelsWithSdk({ ModelRuntime: { create } })).resolves.toEqual(models)
    expect(create).toHaveBeenCalledWith({ allowModelNetwork: true })
  })

  it('should_list_available_models_from_a_modern_snapshot', async () => {
    const models = [{ id: 'snapshot', provider: 'test' }]
    const create = vi.fn(async () => ({ getAvailableSnapshot: vi.fn(() => models) }))

    await expect(listAvailableModelsWithSdk({ ModelRuntime: { create } })).resolves.toEqual(models)
  })

  it('should_list_available_models_with_the_legacy_registry', async () => {
    const models = [{ id: 'legacy', provider: 'test' }]
    const auth = {}
    const authCreate = vi.fn(() => auth)
    const getAvailable = vi.fn(async () => models)
    const registryCreate = vi.fn(() => ({ getAvailable }))

    await expect(
      listAvailableModelsWithSdk({
        AuthStorage: { create: authCreate },
        ModelRegistry: { create: registryCreate },
      }),
    ).resolves.toEqual(models)
    expect(registryCreate).toHaveBeenCalledWith(auth)
  })

  it('should_return_no_available_models_for_an_unsupported_sdk', async () => {
    await expect(listAvailableModelsWithSdk({})).resolves.toEqual([])
  })

  it('should_prefer_worker_models_without_calling_sdk_or_catalog', async () => {
    const worker = vi.fn(async () => [{ id: 'worker' }])
    const sdk = vi.fn(async () => [{ id: 'sdk' }])
    const catalog = vi.fn(() => [{ id: 'catalog' }])

    await expect(resolveAvailableModels({ worker, sdk, catalog })).resolves.toEqual([
      { id: 'worker' },
    ])
    expect(sdk).not.toHaveBeenCalled()
    expect(catalog).not.toHaveBeenCalled()
  })

  it('should_fall_back_from_an_empty_worker_to_sdk_models', async () => {
    const worker = vi.fn(async () => [])
    const sdk = vi.fn(async () => [{ id: 'sdk' }])
    const catalog = vi.fn(() => [{ id: 'catalog' }])

    await expect(resolveAvailableModels({ worker, sdk, catalog })).resolves.toEqual([
      { id: 'sdk' },
    ])
    expect(catalog).not.toHaveBeenCalled()
  })

  it('should_fall_back_to_disk_catalog_when_worker_and_sdk_fail', async () => {
    const onWorkerError = vi.fn()
    const onSdkError = vi.fn()
    const workerError = new Error('worker failed')
    const sdkError = new Error('sdk failed')

    await expect(
      resolveAvailableModels({
        worker: vi.fn(async () => {
          throw workerError
        }),
        sdk: vi.fn(async () => {
          throw sdkError
        }),
        catalog: () => [{ id: 'catalog' }],
        onWorkerError,
        onSdkError,
      }),
    ).resolves.toEqual([{ id: 'catalog' }])
    expect(onWorkerError).toHaveBeenCalledWith(workerError)
    expect(onSdkError).toHaveBeenCalledWith(sdkError)
  })
})

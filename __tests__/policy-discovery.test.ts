import { jest } from '@jest/globals'

// Mock external dependencies
const mockCore = {
  info: jest.fn(),
  debug: jest.fn(),
  warning: jest.fn(),
  error: jest.fn()
}

const mockFs = {
  readFile: jest.fn<() => Promise<string>>()
}

const mockGlob = jest.fn<() => Promise<string[]>>()
const mockParseYaml = jest.fn<() => unknown>()

jest.unstable_mockModule('@actions/core', () => mockCore)
jest.unstable_mockModule('fs/promises', () => mockFs)
jest.unstable_mockModule('glob', () => ({ glob: mockGlob }))
jest.unstable_mockModule('yaml', () => ({ parse: mockParseYaml }))

// Import modules after mocking
const {
  discoverPoliciesFromDefaultStructure,
  loadPolicyManifest,
  discoverPoliciesFromManifest,
  discoverPolicies,
  validatePolicies
} = await import('../src/policy-discovery.js')

describe('policy-discovery', () => {
  const baseDir = '/test/workspace'
  const validApiPolicy = `
    <policies>
      <inbound><base /></inbound>
      <outbound><base /></outbound>
    </policies>
  `
  const validOperationPolicy = `
    <policies>
      <inbound><base /><validate-jwt /></inbound>
      <outbound><base /></outbound>
    </policies>
  `

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('discoverPoliciesFromDefaultStructure', () => {
    it('should discover API and operation policies from default structure', async () => {
      const mockFiles = [
        'policies/sample-api/api.xml',
        'policies/sample-api/operations/get-users.xml',
        'policies/orders-api/api.xml'
      ]

      mockGlob.mockResolvedValue(mockFiles)
      mockFs.readFile
        .mockResolvedValueOnce(validApiPolicy)
        .mockResolvedValueOnce(validOperationPolicy)
        .mockResolvedValueOnce(validApiPolicy)

      const policies = await discoverPoliciesFromDefaultStructure(baseDir)

      expect(policies).toHaveLength(3)
      expect(policies[0]).toEqual({
        filePath: expect.stringContaining('sample-api/api.xml'),
        apiId: 'sample-api',
        operationId: undefined,
        scope: 'api',
        content: validApiPolicy
      })
      expect(policies[1]).toEqual({
        filePath: expect.stringContaining('get-users.xml'),
        apiId: 'sample-api',
        operationId: 'get-users',
        scope: 'operation',
        content: validOperationPolicy
      })
    })

    it('should skip invalid XML files', async () => {
      const mockFiles = ['policies/api1/api.xml', 'policies/api2/api.xml']

      mockGlob.mockResolvedValue(mockFiles)
      mockFs.readFile
        .mockResolvedValueOnce('invalid xml content')
        .mockResolvedValueOnce(validApiPolicy)

      const policies = await discoverPoliciesFromDefaultStructure(baseDir)

      expect(policies).toHaveLength(1)
      expect(mockCore.warning).toHaveBeenCalledWith(
        expect.stringContaining('Skipping invalid XML')
      )
    })

    it('should handle file read errors gracefully', async () => {
      const mockFiles = ['Policies/api1/api.xml']

      mockGlob.mockResolvedValue(mockFiles)
      mockFs.readFile.mockRejectedValue(new Error('File not found'))

      const policies = await discoverPoliciesFromDefaultStructure(baseDir)

      expect(policies).toHaveLength(0)
      expect(mockCore.warning).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process policy file')
      )
    })

    it('should handle glob pattern errors', async () => {
      mockGlob.mockRejectedValue(new Error('Glob error'))

      const policies = await discoverPoliciesFromDefaultStructure(baseDir)

      expect(policies).toHaveLength(0)
      expect(mockCore.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to discover policies')
      )
    })

    it('should skip files when API ID or operation ID cannot be derived', async () => {
      const mockFiles = [
        'policies//api.xml',
        'policies/sample-api/unknown.txt',
        'policies/sample-api/operations/.xml'
      ]
      mockGlob.mockResolvedValue(mockFiles)
      mockFs.readFile.mockResolvedValue('<policies></policies>')

      const policies = await discoverPoliciesFromDefaultStructure(baseDir)

      expect(policies).toHaveLength(0)
      expect(mockCore.warning).toHaveBeenCalledWith(
        expect.stringContaining('Cannot extract API ID')
      )
    })
  })

  describe('loadPolicyManifest', () => {
    it('should load and parse valid manifest', async () => {
      const manifestContent = `
policies:
  api1:
    apiPolicyPath: "api1/policy.xml"
    operations:
      op1: "api1/op1.xml"
`
      const parsedManifest = {
        policies: {
          api1: {
            apiPolicyPath: 'api1/policy.xml',
            operations: { op1: 'api1/op1.xml' }
          }
        }
      }

      mockFs.readFile.mockResolvedValue(manifestContent)
      mockParseYaml.mockReturnValue(parsedManifest)

      const result = await loadPolicyManifest('/test/manifest.yaml')

      expect(result).toEqual(parsedManifest)
      expect(mockCore.info).toHaveBeenCalledWith(
        'Loaded manifest with 1 API entries'
      )
    })

    it('should handle missing manifest file', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'))

      const result = await loadPolicyManifest('/test/missing.yaml')

      expect(result).toBeNull()
      expect(mockCore.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load policy manifest')
      )
    })

    it('should handle invalid manifest format', async () => {
      mockFs.readFile.mockResolvedValue('invalid: yaml: content')
      mockParseYaml.mockReturnValue({})

      const result = await loadPolicyManifest('/test/invalid.yaml')

      expect(result).toBeNull()
      expect(mockCore.error).toHaveBeenCalledWith(
        'Invalid manifest format: missing policies section'
      )
    })
  })

  describe('discoverPoliciesFromManifest', () => {
    it('should discover policies using manifest configuration', async () => {
      const manifest = {
        policies: {
          api1: {
            apiPolicyPath: 'custom/api1-policy.xml',
            operations: {
              op1: 'custom/api1-op1.xml'
            }
          }
        }
      }

      mockFs.readFile
        .mockResolvedValueOnce('manifest content')
        .mockResolvedValueOnce(validApiPolicy)
        .mockResolvedValueOnce(validOperationPolicy)
      mockParseYaml.mockReturnValue(manifest)

      const policies = await discoverPoliciesFromManifest(
        '/test/manifest.yaml',
        baseDir
      )

      expect(policies).toHaveLength(2)
      expect(policies[0]).toEqual({
        filePath: expect.stringContaining('api1-policy.xml'),
        apiId: 'api1',
        operationId: undefined,
        scope: 'api',
        content: validApiPolicy
      })
      expect(policies[1]).toEqual({
        filePath: expect.stringContaining('api1-op1.xml'),
        apiId: 'api1',
        operationId: 'op1',
        scope: 'operation',
        content: validOperationPolicy
      })
    })

    it('should handle missing policy files in manifest', async () => {
      const manifest = {
        policies: {
          api1: {
            apiPolicyPath: 'missing.xml'
          }
        }
      }

      mockFs.readFile
        .mockResolvedValueOnce('manifest content')
        .mockRejectedValueOnce(new Error('File not found'))
      mockParseYaml.mockReturnValue(manifest)

      const policies = await discoverPoliciesFromManifest(
        '/test/manifest.yaml',
        baseDir
      )

      expect(policies).toHaveLength(0)
      expect(mockCore.warning).toHaveBeenCalledWith(
        expect.stringContaining('Failed to read API policy')
      )
    })

    it('should skip invalid XML in manifest entries', async () => {
      const manifest = {
        policies: {
          api1: {
            apiPolicyPath: 'custom/api1-policy.xml',
            operations: {
              op1: 'custom/api1-op1.xml'
            }
          }
        }
      }

      mockFs.readFile
        .mockResolvedValueOnce('manifest content')
        .mockResolvedValueOnce('not xml')
        .mockResolvedValueOnce('not xml either')
      mockParseYaml.mockReturnValue(manifest)

      const policies = await discoverPoliciesFromManifest(
        '/test/manifest.yaml',
        baseDir
      )

      expect(policies).toHaveLength(0)
      expect(mockCore.warning).toHaveBeenCalledWith(
        expect.stringContaining('Invalid XML content in API policy')
      )
      expect(mockCore.warning).toHaveBeenCalledWith(
        expect.stringContaining('Invalid XML content in operation policy')
      )
    })
  })

  describe('discoverPolicies', () => {
    it('should use manifest when manifest path is provided', async () => {
      const manifest = {
        policies: {
          api1: {
            apiPolicyPath: 'api1.xml'
          }
        }
      }

      mockFs.readFile
        .mockResolvedValueOnce('manifest content')
        .mockResolvedValueOnce(validApiPolicy)
      mockParseYaml.mockReturnValue(manifest)

      const policies = await discoverPolicies('/test/manifest.yaml', baseDir)

      expect(policies).toHaveLength(1)
      expect(mockCore.info).toHaveBeenCalledWith(
        'Using policy manifest for discovery'
      )
    })

    it('should use default structure when no manifest path is provided', async () => {
      mockGlob.mockResolvedValue(['policies/api1/api.xml'])
      mockFs.readFile.mockResolvedValue(validApiPolicy)

      const policies = await discoverPolicies(undefined, baseDir)

      expect(policies).toHaveLength(1)
      expect(mockCore.info).toHaveBeenCalledWith(
        'Using default directory structure for discovery'
      )
    })
  })

  describe('validatePolicies', () => {
    it('should validate policies and return true for valid policies', () => {
      const policies = [
        {
          filePath: '/test/api1.xml',
          apiId: 'api1',
          scope: 'api' as const,
          content: validApiPolicy
        },
        {
          filePath: '/test/op1.xml',
          apiId: 'api1',
          operationId: 'op1',
          scope: 'operation' as const,
          content: validOperationPolicy
        }
      ]

      const result = validatePolicies(policies)

      expect(result).toBe(true)
      expect(mockCore.info).toHaveBeenCalledWith(
        'API api1: 1 API policy, 1 operation policies'
      )
    })

    it('should return false for empty policy list', () => {
      const result = validatePolicies([])

      expect(result).toBe(false)
      expect(mockCore.warning).toHaveBeenCalledWith(
        'No policy files discovered'
      )
    })

    it('should detect multiple API policies for same API', () => {
      const policies = [
        {
          filePath: '/test/api1-1.xml',
          apiId: 'api1',
          scope: 'api' as const,
          content: validApiPolicy
        },
        {
          filePath: '/test/api1-2.xml',
          apiId: 'api1',
          scope: 'api' as const,
          content: validApiPolicy
        }
      ]

      const result = validatePolicies(policies)

      expect(result).toBe(false)
      expect(mockCore.warning).toHaveBeenCalledWith(
        'Multiple API policies found for api1'
      )
    })

    it('should detect invalid XML content', () => {
      const policies = [
        {
          filePath: '/test/invalid.xml',
          apiId: 'api1',
          scope: 'api' as const,
          content: 'invalid xml'
        }
      ]

      const result = validatePolicies(policies)

      expect(result).toBe(false)
      expect(mockCore.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid XML content')
      )
    })
  })
})

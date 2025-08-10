import { jest } from '@jest/globals'

// Mock @actions/core
const mockCore = {
  getInput: jest.fn(),
  info: jest.fn()
}

jest.unstable_mockModule('@actions/core', () => mockCore)

// Import after mocking
const {
  parseInputs,
  validateXmlContent,
  extractApiIdFromPath,
  extractOperationIdFromPath,
  isApiLevelPolicy,
  isOperationLevelPolicy
} = await import('../src/utils.js')

describe('utils', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('parseInputs', () => {
    it('should parse valid inputs correctly', () => {
      mockCore.getInput.mockImplementation((name: unknown) => {
        const nameStr = name as string
        switch (nameStr) {
          case 'subscription_id':
            return 'test-subscription'
          case 'resource_group':
            return 'test-rg'
          case 'apim_name':
            return 'test-apim'
          case 'policy_manifest_path':
            return 'manifest.yaml'
          default:
            return ''
        }
      })

      const result = parseInputs()

      expect(result).toEqual({
        subscriptionId: 'test-subscription',
        resourceGroupName: 'test-rg',
        serviceName: 'test-apim',
        policyManifestPath: 'manifest.yaml'
      })
    })

    it('should handle optional policy manifest path', () => {
      mockCore.getInput.mockImplementation((name: unknown) => {
        const nameStr = name as string
        switch (nameStr) {
          case 'subscription_id':
            return 'test-subscription'
          case 'resource_group':
            return 'test-rg'
          case 'apim_name':
            return 'test-apim'
          case 'policy_manifest_path':
            return ''
          default:
            return ''
        }
      })

      const result = parseInputs()

      expect(result.policyManifestPath).toBeUndefined()
    })

    it('should throw error for missing required inputs', () => {
      mockCore.getInput.mockReturnValue('')

      expect(() => parseInputs()).toThrow('subscription_id input is required')
    })

    it('should throw error when resource_group is missing', () => {
      mockCore.getInput.mockImplementation((name: unknown) => {
        const nameStr = name as string
        switch (nameStr) {
          case 'subscription_id':
            return 'sub-id'
          case 'resource_group':
            return ''
          case 'apim_name':
            return 'apim'
          default:
            return ''
        }
      })

      expect(() => parseInputs()).toThrow('resource_group input is required')
    })

    it('should throw error when apim_name is missing', () => {
      mockCore.getInput.mockImplementation((name: unknown) => {
        const nameStr = name as string
        switch (nameStr) {
          case 'subscription_id':
            return 'sub-id'
          case 'resource_group':
            return 'rg'
          case 'apim_name':
            return ''
          default:
            return ''
        }
      })

      expect(() => parseInputs()).toThrow('apim_name input is required')
    })
  })

  describe('validateXmlContent', () => {
    it('should validate correct XML policy content', () => {
      const validXml = `
        <policies>
          <inbound>
            <base />
          </inbound>
          <outbound>
            <base />
          </outbound>
        </policies>
      `
      expect(validateXmlContent(validXml)).toBe(true)
    })

    it('should reject empty content', () => {
      expect(validateXmlContent('')).toBe(false)
      expect(validateXmlContent('   ')).toBe(false)
    })

    it('should reject non-XML content', () => {
      expect(validateXmlContent('not xml')).toBe(false)
    })

    it('should reject XML without policies element', () => {
      const invalidXml = '<root><child /></root>'
      expect(validateXmlContent(invalidXml)).toBe(false)
    })
  })

  describe('extractApiIdFromPath', () => {
    it('should extract API ID from API policy path', () => {
      expect(extractApiIdFromPath('policies/my-api/api.xml')).toBe('my-api')
      expect(extractApiIdFromPath('policies\\my-api\\api.xml')).toBe('my-api')
    })

    it('should extract API ID from operation policy path', () => {
      expect(
        extractApiIdFromPath('policies/my-api/operations/get-users.xml')
      ).toBe('my-api')
      expect(
        extractApiIdFromPath('policies\\my-api\\operations\\get-users.xml')
      ).toBe('my-api')
    })

    it('should return null for invalid paths', () => {
      expect(extractApiIdFromPath('invalid/path.xml')).toBeNull()
      expect(extractApiIdFromPath('policies/')).toBeNull()
    })
  })

  describe('extractOperationIdFromPath', () => {
    it('should extract operation ID from operation policy path', () => {
      expect(
        extractOperationIdFromPath('policies/my-api/operations/get-users.xml')
      ).toBe('get-users')
      expect(
        extractOperationIdFromPath(
          'policies\\my-api\\operations\\post-users.xml'
        )
      ).toBe('post-users')
    })

    it('should return null for API policy paths', () => {
      expect(extractOperationIdFromPath('policies/my-api/api.xml')).toBeNull()
    })

    it('should return null for invalid paths', () => {
      expect(extractOperationIdFromPath('invalid/path.xml')).toBeNull()
    })
  })

  describe('isApiLevelPolicy', () => {
    it('should identify API-level policy paths', () => {
      expect(isApiLevelPolicy('policies/my-api/api.xml')).toBe(true)
      expect(isApiLevelPolicy('policies\\my-api\\api.xml')).toBe(true)
    })

    it('should reject operation-level policy paths', () => {
      expect(isApiLevelPolicy('policies/my-api/operations/get-users.xml')).toBe(
        false
      )
    })

    it('should reject invalid paths', () => {
      expect(isApiLevelPolicy('invalid/path.xml')).toBe(false)
    })
  })

  describe('isOperationLevelPolicy', () => {
    it('should identify operation-level policy paths', () => {
      expect(
        isOperationLevelPolicy('policies/my-api/operations/get-users.xml')
      ).toBe(true)
      expect(
        isOperationLevelPolicy('policies\\my-api\\operations\\post-users.xml')
      ).toBe(true)
    })

    it('should reject API-level policy paths', () => {
      expect(isOperationLevelPolicy('policies/my-api/api.xml')).toBe(false)
    })

    it('should reject invalid paths', () => {
      expect(isOperationLevelPolicy('invalid/path.xml')).toBe(false)
    })
  })
})

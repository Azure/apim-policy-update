/**
 * Unit tests for the action's main functionality, src/main.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from '@jest/globals'

describe('main.ts', () => {
  let mockCore: any
  let mockParseInputs: any
  let mockAzureApimClient: any
  let mockDiscoverPolicies: any
  let mockValidatePolicies: any
  let run: any

  beforeAll(async () => {
    // Mock dependencies
    mockCore = {
      info: jest.fn(),
      error: jest.fn(),
      warning: jest.fn(),
      setFailed: jest.fn(),
      setOutput: jest.fn(),
      getInput: jest.fn()
    }

    mockParseInputs = jest.fn()
    mockAzureApimClient = jest.fn()
    mockDiscoverPolicies = jest.fn()
    mockValidatePolicies = jest.fn()

    // Set up mocks before importing
    jest.unstable_mockModule('@actions/core', () => mockCore)

    jest.unstable_mockModule('../src/utils.js', () => ({
      parseInputs: mockParseInputs
    }))

    jest.unstable_mockModule('../src/azure-client.js', () => ({
      AzureApimClient: mockAzureApimClient
    }))

    jest.unstable_mockModule('../src/policy-discovery.js', () => ({
      discoverPolicies: mockDiscoverPolicies,
      validatePolicies: mockValidatePolicies
    }))
    jest.unstable_mockModule('../src/utils.js', () => ({
      parseInputs: mockParseInputs
    }))
    jest.unstable_mockModule('../src/azure-client.js', () => ({
      AzureApimClient: mockAzureApimClient
    }))
    jest.unstable_mockModule('../src/policy-discovery.js', () => ({
      discoverPolicies: mockDiscoverPolicies,
      validatePolicies: mockValidatePolicies
    }))

    // Import the module being tested
    const mainModule = await import('../src/main.js')
    run = mainModule.run
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should run successfully with valid configuration and policies', async () => {
    // Mock successful parsing
    const mockConfig = {
      subscriptionId: 'test-subscription',
      resourceGroupName: 'test-rg',
      serviceName: 'test-apim'
    }
    mockParseInputs.mockReturnValue(mockConfig)

    // Mock successful Azure client
    const mockClient = {
      testConnection: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
      listApis: jest
        .fn<() => Promise<string[]>>()
        .mockResolvedValue(['api1', 'api2']),
      listOperations: jest
        .fn<(apiId: string) => Promise<string[]>>()
        .mockResolvedValue(['get-users', 'post-users']),
      updateApiPolicy: jest.fn<() => Promise<any>>().mockResolvedValue({
        apiId: 'api1',
        updated: true,
        etag: 'etag-123'
      }),
      updateOperationPolicy: jest.fn<() => Promise<any>>().mockResolvedValue({
        apiId: 'api1',
        operationId: 'get-users',
        updated: true,
        etag: 'etag-456'
      })
    }
    mockAzureApimClient.mockImplementation(() => mockClient)

    // Mock policy discovery
    const mockPolicies = [
      {
        filePath: '/test/api1.xml',
        apiId: 'api1',
        scope: 'api',
        content: '<policies></policies>'
      },
      {
        filePath: '/test/api1/get-users.xml',
        apiId: 'api1',
        operationId: 'get-users',
        scope: 'operation',
        content: '<policies></policies>'
      }
    ]
    mockDiscoverPolicies.mockResolvedValue(mockPolicies)
    mockValidatePolicies.mockReturnValue(true)

    await run()

    expect(mockParseInputs).toHaveBeenCalled()
    expect(mockAzureApimClient).toHaveBeenCalledWith(mockConfig)
    expect(mockClient.testConnection).toHaveBeenCalled()
    expect(mockDiscoverPolicies).toHaveBeenCalledWith(undefined)
    expect(mockValidatePolicies).toHaveBeenCalledWith(mockPolicies)

    // Check policy update calls
    expect(mockClient.updateApiPolicy).toHaveBeenCalledWith(
      'api1',
      '<policies></policies>'
    )
    expect(mockClient.updateOperationPolicy).toHaveBeenCalledWith(
      'api1',
      'get-users',
      '<policies></policies>'
    )

    // Should set ETag output (from operation policy which is last)
    expect(mockCore.setOutput).toHaveBeenCalledWith('etag', 'etag-456')
    expect(mockCore.info).toHaveBeenCalledWith('Action completed successfully')
  })

  it('should handle single API policy update', async () => {
    // Mock successful parsing
    const mockConfig = {
      subscriptionId: 'test-subscription',
      resourceGroupName: 'test-rg',
      serviceName: 'test-apim'
    }
    mockParseInputs.mockReturnValue(mockConfig)

    // Mock successful Azure client
    const mockClient = {
      testConnection: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
      listApis: jest.fn<() => Promise<string[]>>().mockResolvedValue(['api1']),
      listOperations: jest
        .fn<(apiId: string) => Promise<string[]>>()
        .mockResolvedValue(['get-users']),
      updateApiPolicy: jest.fn<() => Promise<any>>().mockResolvedValue({
        apiId: 'api1',
        updated: true,
        etag: 'api-etag-123'
      })
    }
    mockAzureApimClient.mockImplementation(() => mockClient)

    // Mock policy discovery
    const mockPolicies = [
      {
        filePath: '/test/api1.xml',
        apiId: 'api1',
        scope: 'api',
        content: '<policies></policies>'
      }
    ]
    mockDiscoverPolicies.mockResolvedValue(mockPolicies)
    mockValidatePolicies.mockReturnValue(true)

    await run()

    expect(mockClient.updateApiPolicy).toHaveBeenCalledWith(
      'api1',
      '<policies></policies>'
    )

    // Should set ETag output
    expect(mockCore.setOutput).toHaveBeenCalledWith('etag', 'api-etag-123')
    expect(mockCore.info).toHaveBeenCalledWith('Action completed successfully')
  })

  it('should handle empty policy discovery gracefully', async () => {
    // Mock successful parsing and connection
    const mockConfig = {
      subscriptionId: 'test-subscription',
      resourceGroupName: 'test-rg',
      serviceName: 'test-apim'
    }
    mockParseInputs.mockReturnValue(mockConfig)

    const mockClient = {
      testConnection: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
      listApis: jest.fn<() => Promise<string[]>>().mockResolvedValue(['api1']),
      listOperations: jest
        .fn<(apiId: string) => Promise<string[]>>()
        .mockResolvedValue([])
    }
    mockAzureApimClient.mockImplementation(() => mockClient)

    // Mock empty policy discovery
    mockDiscoverPolicies.mockResolvedValue([])

    await run()

    expect(mockCore.warning).toHaveBeenCalledWith(
      'No policy files found to update'
    )
    expect(mockCore.setOutput).toHaveBeenCalledWith('etag', '')
  })

  it('should use manifest path from inputs in discovery', async () => {
    const mockConfig = {
      subscriptionId: 'test-subscription',
      resourceGroupName: 'test-rg',
      serviceName: 'test-apim',
      policyManifestPath: '/path/manifest.yaml'
    }
    mockParseInputs.mockReturnValue(mockConfig)

    const mockClient = {
      testConnection: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
      listApis: jest.fn<() => Promise<string[]>>().mockResolvedValue([]),
      listOperations: jest
        .fn<(apiId: string) => Promise<string[]>>()
        .mockResolvedValue([]),
      updateApiPolicy: jest.fn<() => Promise<any>>(),
      updateOperationPolicy: jest.fn<() => Promise<any>>()
    }
    mockAzureApimClient.mockImplementation(() => mockClient)

    mockDiscoverPolicies.mockResolvedValue([])

    await run()

    expect(mockDiscoverPolicies).toHaveBeenCalledWith('/path/manifest.yaml')
  })

  it('should continue processing when an update returns error', async () => {
    const mockConfig = {
      subscriptionId: 'test-subscription',
      resourceGroupName: 'test-rg',
      serviceName: 'test-apim'
    }
    mockParseInputs.mockReturnValue(mockConfig)

    const mockClient = {
      testConnection: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
      listApis: jest.fn<() => Promise<string[]>>().mockResolvedValue(['api1']),
      listOperations: jest
        .fn<(apiId: string) => Promise<string[]>>()
        .mockResolvedValue(['op1']),
      updateApiPolicy: jest.fn<() => Promise<any>>().mockResolvedValue({
        apiId: 'api1',
        updated: false,
        error: 'Denied'
      }),
      updateOperationPolicy: jest.fn<() => Promise<any>>().mockResolvedValue({
        apiId: 'api1',
        operationId: 'op1',
        updated: true,
        etag: 'e2'
      })
    }
    mockAzureApimClient.mockImplementation(() => mockClient)

    const mockPolicies = [
      {
        filePath: '/test/api1.xml',
        apiId: 'api1',
        scope: 'api',
        content: '<policies></policies>'
      },
      {
        filePath: '/test/op1.xml',
        apiId: 'api1',
        operationId: 'op1',
        scope: 'operation',
        content: '<policies></policies>'
      }
    ]
    mockDiscoverPolicies.mockResolvedValue(mockPolicies)
    mockValidatePolicies.mockReturnValue(true)

    await run()

    expect(mockCore.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to update api policy')
    )
    expect(mockCore.setOutput).toHaveBeenCalledWith('etag', 'e2')
  })

  it('should fail when policy validation fails', async () => {
    // Mock successful parsing and connection
    const mockConfig = {
      subscriptionId: 'test-subscription',
      resourceGroupName: 'test-rg',
      serviceName: 'test-apim'
    }
    mockParseInputs.mockReturnValue(mockConfig)

    const mockClient = {
      testConnection: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
      listApis: jest.fn<() => Promise<string[]>>().mockResolvedValue(['api1']),
      listOperations: jest
        .fn<(apiId: string) => Promise<string[]>>()
        .mockResolvedValue([])
    }
    mockAzureApimClient.mockImplementation(() => mockClient)

    // Mock policy discovery with validation failure
    const mockPolicies = [{ filePath: '/test/invalid.xml' }]
    mockDiscoverPolicies.mockResolvedValue(mockPolicies)
    mockValidatePolicies.mockReturnValue(false)

    await run()

    expect(mockCore.setFailed).toHaveBeenCalledWith('Policy validation failed')
  })

  it('should fail when Azure connection test fails', async () => {
    // Mock successful parsing
    const mockConfig = {
      subscriptionId: 'test-subscription',
      resourceGroupName: 'test-rg',
      serviceName: 'test-apim'
    }
    mockParseInputs.mockReturnValue(mockConfig)

    // Mock failed Azure client
    const mockClient = {
      testConnection: jest.fn<() => Promise<boolean>>().mockResolvedValue(false)
    }
    mockAzureApimClient.mockImplementation(() => mockClient)

    await run()

    expect(mockCore.setFailed).toHaveBeenCalledWith(
      'Failed to connect to Azure API Management service'
    )
    expect(mockCore.setOutput).toHaveBeenCalledWith('etag', '')
  })

  it('should handle parsing errors', async () => {
    mockParseInputs.mockImplementation(() => {
      throw new Error('Invalid configuration')
    })

    await run()

    expect(mockCore.setFailed).toHaveBeenCalledWith('Invalid configuration')
    expect(mockCore.setOutput).toHaveBeenCalledWith('etag', '')
  })

  it('should handle policy discovery errors', async () => {
    // Mock successful parsing and connection
    const mockConfig = {
      subscriptionId: 'test-subscription',
      resourceGroupName: 'test-rg',
      serviceName: 'test-apim'
    }
    mockParseInputs.mockReturnValue(mockConfig)

    const mockClient = {
      testConnection: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
      listApis: jest.fn<() => Promise<string[]>>().mockResolvedValue(['api1']),
      listOperations: jest
        .fn<(apiId: string) => Promise<string[]>>()
        .mockResolvedValue([])
    }
    mockAzureApimClient.mockImplementation(() => mockClient)

    // Mock policy discovery error
    mockDiscoverPolicies.mockRejectedValue(
      new Error('Failed to discover policies')
    )

    await run()

    expect(mockCore.setFailed).toHaveBeenCalledWith(
      'Failed to discover policies'
    )
    expect(mockCore.setOutput).toHaveBeenCalledWith('etag', '')
  })

  it('should handle unknown errors', async () => {
    mockParseInputs.mockImplementation(() => {
      throw 'Unknown error'
    })

    await run()

    expect(mockCore.setFailed).toHaveBeenCalledWith('An unknown error occurred')
  })
})

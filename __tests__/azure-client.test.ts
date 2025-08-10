/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from '@jest/globals'
import type { ApimConfig } from '../src/types.js'

// Mock Azure SDK
const mockDefaultAzureCredential = jest.fn()
const mockApiManagementClient = jest.fn()

jest.unstable_mockModule('@azure/identity', () => ({
  DefaultAzureCredential: mockDefaultAzureCredential
}))

jest.unstable_mockModule('@azure/arm-apimanagement', () => ({
  ApiManagementClient: mockApiManagementClient
}))

// Import after mocking
const { AzureApimClient } = await import('../src/azure-client.js')

describe('AzureApimClient', () => {
  const mockConfig: ApimConfig = {
    subscriptionId: 'test-subscription-id',
    resourceGroupName: 'test-rg',
    serviceName: 'test-apim'
  }

  let mockClient: any

  beforeEach(() => {
    jest.clearAllMocks()

    mockClient = {
      api: {
        listByService: jest.fn()
      },
      apiOperation: {
        listByApi: jest.fn()
      },
      apiPolicy: {
        createOrUpdate: jest.fn(),
        get: jest.fn()
      },
      apiOperationPolicy: {
        createOrUpdate: jest.fn(),
        get: jest.fn()
      },
      apiManagementService: {
        get: jest.fn()
      }
    }

    // Create proper async iterator mocks
    const createAsyncIterator = (items: any[]) => {
      return {
        [Symbol.asyncIterator]: async function* () {
          for (const item of items) {
            yield item
          }
        }
      }
    }

    // Setup default mock responses for API listing
    mockClient.api.listByService.mockReturnValue(createAsyncIterator([]))
    mockClient.apiOperation.listByApi.mockReturnValue(createAsyncIterator([]))

    mockApiManagementClient.mockImplementation(() => mockClient)
  })

  describe('constructor', () => {
    it('should create client with valid configuration', () => {
      const client = new AzureApimClient(mockConfig)
      expect(client).toBeInstanceOf(AzureApimClient)
      expect(mockDefaultAzureCredential).toHaveBeenCalled()
      expect(mockApiManagementClient).toHaveBeenCalledWith(
        expect.any(Object),
        'test-subscription-id'
      )
    })
  })

  describe('testConnection', () => {
    it('should return true when connection is successful', async () => {
      mockClient.apiManagementService.get.mockResolvedValue({
        name: 'test-apim'
      })

      const client = new AzureApimClient(mockConfig)
      const result = await client.testConnection()

      expect(result).toBe(true)
      expect(mockClient.apiManagementService.get).toHaveBeenCalledWith(
        'test-rg',
        'test-apim'
      )
    })

    it('should return false when connection fails', async () => {
      mockClient.apiManagementService.get.mockRejectedValue(
        new Error('Connection failed')
      )

      const client = new AzureApimClient(mockConfig)
      const result = await client.testConnection()

      expect(result).toBe(false)
    })
  })

  describe('updateApiPolicy', () => {
    it('should successfully update API policy', async () => {
      // Mock API existence check
      const createAsyncIterator = (items: any[]) => ({
        [Symbol.asyncIterator]: async function* () {
          for (const item of items) {
            yield item
          }
        }
      })

      mockClient.api.listByService.mockReturnValue(
        createAsyncIterator([{ name: 'test-api' }, { name: 'other-api' }])
      )

      const mockResponse = {
        eTag: 'test-etag'
      }
      mockClient.apiPolicy.createOrUpdate.mockResolvedValue(mockResponse)

      const client = new AzureApimClient(mockConfig)
      const result = await client.updateApiPolicy(
        'test-api',
        '<policies></policies>'
      )

      expect(result).toEqual({
        apiId: 'test-api',
        updated: true,
        etag: 'test-etag'
      })
      expect(mockClient.apiPolicy.createOrUpdate).toHaveBeenCalledWith(
        'test-rg',
        'test-apim',
        'test-api',
        'policy',
        {
          value: '<policies></policies>',
          format: 'xml'
        }
      )
    })

    it('should handle API policy update errors', async () => {
      // Mock API existence check
      const createAsyncIterator = (items: any[]) => ({
        [Symbol.asyncIterator]: async function* () {
          for (const item of items) {
            yield item
          }
        }
      })

      mockClient.api.listByService.mockReturnValue(
        createAsyncIterator([{ name: 'test-api' }])
      )

      mockClient.apiPolicy.createOrUpdate.mockRejectedValue(
        new Error('Update failed')
      )

      const client = new AzureApimClient(mockConfig)
      const result = await client.updateApiPolicy(
        'test-api',
        '<policies></policies>'
      )

      expect(result).toEqual({
        apiId: 'test-api',
        updated: false,
        error: 'Update failed'
      })
    })

    it('should return not updated when API does not exist', async () => {
      const createAsyncIterator = (items: any[]) => ({
        [Symbol.asyncIterator]: async function* () {
          for (const item of items) {
            yield item
          }
        }
      })

      mockClient.api.listByService.mockReturnValue(createAsyncIterator([]))

      const client = new AzureApimClient(mockConfig)
      const result = await client.updateApiPolicy('missing-api', '<policies/>')

      expect(result.updated).toBe(false)
      expect(result.error).toContain("API 'missing-api' not found")
      expect(mockClient.apiPolicy.createOrUpdate).not.toHaveBeenCalled()
    })

    it('should extract detailed Azure error messages', async () => {
      const createAsyncIterator = (items: any[]) => ({
        [Symbol.asyncIterator]: async function* () {
          for (const item of items) {
            yield item
          }
        }
      })

      mockClient.api.listByService.mockReturnValue(
        createAsyncIterator([{ name: 'test-api' }])
      )

      const azureError: any = new Error('outer')
      azureError.response = {
        data: { error: { message: 'Inner Azure error' } }
      }
      mockClient.apiPolicy.createOrUpdate.mockRejectedValue(azureError)

      const client = new AzureApimClient(mockConfig)
      const result = await client.updateApiPolicy('test-api', '<policies/>')

      expect(result.updated).toBe(false)
      expect(result.error).toBe('Inner Azure error')
    })
  })

  describe('updateOperationPolicy', () => {
    it('should successfully update operation policy', async () => {
      // Mock API and operation existence check
      const createAsyncIterator = (items: any[]) => ({
        [Symbol.asyncIterator]: async function* () {
          for (const item of items) {
            yield item
          }
        }
      })

      mockClient.api.listByService.mockReturnValue(
        createAsyncIterator([{ name: 'test-api' }])
      )
      mockClient.apiOperation.listByApi.mockReturnValue(
        createAsyncIterator([{ name: 'test-op' }])
      )

      const mockResponse = {
        eTag: 'test-etag-op'
      }
      mockClient.apiOperationPolicy.createOrUpdate.mockResolvedValue(
        mockResponse
      )

      const client = new AzureApimClient(mockConfig)
      const result = await client.updateOperationPolicy(
        'test-api',
        'test-op',
        '<policies></policies>'
      )

      expect(result).toEqual({
        apiId: 'test-api',
        operationId: 'test-op',
        updated: true,
        etag: 'test-etag-op'
      })
      expect(mockClient.apiOperationPolicy.createOrUpdate).toHaveBeenCalledWith(
        'test-rg',
        'test-apim',
        'test-api',
        'test-op',
        'policy',
        {
          value: '<policies></policies>',
          format: 'xml'
        }
      )
    })

    it('should handle operation policy update errors', async () => {
      // Mock API and operation existence check
      const createAsyncIterator = (items: any[]) => ({
        [Symbol.asyncIterator]: async function* () {
          for (const item of items) {
            yield item
          }
        }
      })

      mockClient.api.listByService.mockReturnValue(
        createAsyncIterator([{ name: 'test-api' }])
      )
      mockClient.apiOperation.listByApi.mockReturnValue(
        createAsyncIterator([{ name: 'test-op' }])
      )

      mockClient.apiOperationPolicy.createOrUpdate.mockRejectedValue(
        new Error('Operation update failed')
      )

      const client = new AzureApimClient(mockConfig)
      const result = await client.updateOperationPolicy(
        'test-api',
        'test-op',
        '<policies></policies>'
      )

      expect(result).toEqual({
        apiId: 'test-api',
        operationId: 'test-op',
        updated: false,
        error: 'Operation update failed'
      })
    })

    it('should return not updated when API or operation does not exist', async () => {
      const createAsyncIterator = (items: any[]) => ({
        [Symbol.asyncIterator]: async function* () {
          for (const item of items) {
            yield item
          }
        }
      })

      // API missing
      mockClient.api.listByService.mockReturnValue(createAsyncIterator([]))

      const client = new AzureApimClient(mockConfig)
      const res1 = await client.updateOperationPolicy('missing', 'op', '<p/>')
      expect(res1.updated).toBe(false)
      expect(res1.error).toContain("API 'missing' not found")

      // API exists but operation missing
      mockClient.api.listByService.mockReturnValue(
        createAsyncIterator([{ name: 'api1' }])
      )
      mockClient.apiOperation.listByApi.mockReturnValue(createAsyncIterator([]))
      const res2 = await client.updateOperationPolicy('api1', 'missing', '<p/>')
      expect(res2.updated).toBe(false)
      expect(res2.error).toContain("Operation 'missing' not found")
    })

    it('should extract detailed Azure error messages for operation updates', async () => {
      const createAsyncIterator = (items: any[]) => ({
        [Symbol.asyncIterator]: async function* () {
          for (const item of items) {
            yield item
          }
        }
      })

      mockClient.api.listByService.mockReturnValue(
        createAsyncIterator([{ name: 'api1' }])
      )
      mockClient.apiOperation.listByApi.mockReturnValue(
        createAsyncIterator([{ name: 'op1' }])
      )

      const azureError: any = new Error('outer')
      azureError.response = { data: { message: 'Operation Azure error' } }
      mockClient.apiOperationPolicy.createOrUpdate.mockRejectedValue(azureError)

      const client = new AzureApimClient(mockConfig)
      const result = await client.updateOperationPolicy('api1', 'op1', '<p/>')
      expect(result.updated).toBe(false)
      expect(result.error).toBe('Operation Azure error')
    })
  })

  describe('list methods error handling', () => {
    it('listApis should return [] on error', async () => {
      mockClient.api.listByService.mockImplementation(() => {
        throw new Error('boom')
      })
      const client = new AzureApimClient(mockConfig)
      const apis = await client.listApis()
      expect(apis).toEqual([])
    })

    it('listOperations should return [] on error', async () => {
      mockClient.apiOperation.listByApi.mockImplementation(() => {
        throw new Error('boom')
      })
      const client = new AzureApimClient(mockConfig)
      const ops = await client.listOperations('api1')
      expect(ops).toEqual([])
    })
  })
})

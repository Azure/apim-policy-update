/* eslint-disable @typescript-eslint/no-explicit-any */
import { DefaultAzureCredential } from '@azure/identity'
import { ApiManagementClient } from '@azure/arm-apimanagement'
import * as core from '@actions/core'
import type { ApimConfig, PolicyUpdateResult } from './types.js'

/**
 * Azure API Management client wrapper - Simplified MVP version
 */
export class AzureApimClient {
  private client: ApiManagementClient
  private config: ApimConfig

  constructor(config: ApimConfig) {
    this.config = config
    this.client = new ApiManagementClient(
      new DefaultAzureCredential(),
      config.subscriptionId
    )
  }

  /**
   * Update API-level policy
   */
  async updateApiPolicy(
    apiId: string,
    newPolicyContent: string
  ): Promise<PolicyUpdateResult> {
    try {
      // Check if API exists first
      const apis = await this.listApis()
      if (!apis.includes(apiId)) {
        core.warning(
          `API '${apiId}' does not exist in APIM service. Available APIs: ${apis.join(', ')}`
        )
        return {
          apiId,
          updated: false,
          error: `API '${apiId}' not found. Available APIs: ${apis.join(', ')}`
        }
      }

      core.info(`Updating API policy for: ${apiId}`)
      return await this.updateApiPolicyDirect(apiId, newPolicyContent)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      core.error(`Failed to update API policy for ${apiId}: ${errorMessage}`)

      return {
        apiId,
        updated: false,
        error: errorMessage
      }
    }
  }

  /**
   * Update operation-level policy
   */
  async updateOperationPolicy(
    apiId: string,
    operationId: string,
    newPolicyContent: string
  ): Promise<PolicyUpdateResult> {
    try {
      // Check if API exists first
      const apis = await this.listApis()
      if (!apis.includes(apiId)) {
        core.warning(
          `API '${apiId}' does not exist in APIM service. Available APIs: ${apis.join(', ')}`
        )
        return {
          apiId,
          operationId,
          updated: false,
          error: `API '${apiId}' not found. Available APIs: ${apis.join(', ')}`
        }
      }

      // Check if operation exists
      const operations = await this.listOperations(apiId)
      if (!operations.includes(operationId)) {
        core.warning(
          `Operation '${operationId}' does not exist in API '${apiId}'. Available operations: ${operations.join(', ')}`
        )
        return {
          apiId,
          operationId,
          updated: false,
          error: `Operation '${operationId}' not found in API '${apiId}'. Available operations: ${operations.join(', ')}`
        }
      }

      core.info(`Updating operation policy for: ${apiId}/${operationId}`)
      return await this.updateOperationPolicyDirect(
        apiId,
        operationId,
        newPolicyContent
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      core.error(
        `Failed to update operation policy for ${apiId}/${operationId}: ${errorMessage}`
      )

      return {
        apiId,
        operationId,
        updated: false,
        error: errorMessage
      }
    }
  }

  /**
   * Direct API-level policy update
   */
  private async updateApiPolicyDirect(
    apiId: string,
    policyContent: string
  ): Promise<PolicyUpdateResult> {
    try {
      const result = await this.client.apiPolicy.createOrUpdate(
        this.config.resourceGroupName,
        this.config.serviceName,
        apiId,
        'policy',
        {
          value: policyContent,
          format: 'xml'
        }
      )

      return {
        apiId,
        updated: true,
        etag: result.eTag || ''
      }
    } catch (error) {
      let errorMessage = 'Unknown error'

      if (error instanceof Error) {
        errorMessage = error.message

        // Try to extract more detailed error information from Azure API response
        if (
          'response' in error &&
          error.response &&
          typeof error.response === 'object'
        ) {
          const response = error.response as any
          if (response.data && typeof response.data === 'object') {
            if (response.data.error && response.data.error.message) {
              errorMessage = response.data.error.message
            } else if (response.data.message) {
              errorMessage = response.data.message
            }
          }
        }
      }

      core.error(`Failed to update API policy for ${apiId}: ${errorMessage}`)

      return {
        apiId,
        updated: false,
        error: errorMessage
      }
    }
  }

  /**
   * Direct operation-level policy update
   */
  private async updateOperationPolicyDirect(
    apiId: string,
    operationId: string,
    policyContent: string
  ): Promise<PolicyUpdateResult> {
    try {
      const result = await this.client.apiOperationPolicy.createOrUpdate(
        this.config.resourceGroupName,
        this.config.serviceName,
        apiId,
        operationId,
        'policy',
        {
          value: policyContent,
          format: 'xml'
        }
      )

      return {
        apiId,
        operationId,
        updated: true,
        etag: result.eTag || ''
      }
    } catch (error) {
      let errorMessage = 'Unknown error'

      if (error instanceof Error) {
        errorMessage = error.message

        // Try to extract more detailed error information from Azure API response
        if (
          'response' in error &&
          error.response &&
          typeof error.response === 'object'
        ) {
          const response = error.response as any
          if (response.data && typeof response.data === 'object') {
            if (response.data.error && response.data.error.message) {
              errorMessage = response.data.error.message
            } else if (response.data.message) {
              errorMessage = response.data.message
            }
          }
        }
      }

      core.error(
        `Failed to update operation policy for ${apiId}/${operationId}: ${errorMessage}`
      )

      return {
        apiId,
        operationId,
        updated: false,
        error: errorMessage
      }
    }
  }

  /**
   * List all APIs in the APIM service
   */
  async listApis(): Promise<string[]> {
    try {
      core.debug('Listing APIs in APIM service...')

      const apis = this.client.api.listByService(
        this.config.resourceGroupName,
        this.config.serviceName
      )

      const apiIds: string[] = []
      for await (const api of apis) {
        if (api.name) {
          apiIds.push(api.name)
        }
      }

      core.debug(`Found ${apiIds.length} APIs: ${apiIds.join(', ')}`)
      return apiIds
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      core.warning(`Failed to list APIs: ${errorMessage}`)
      return []
    }
  }

  /**
   * List all operations for a specific API
   */
  async listOperations(apiId: string): Promise<string[]> {
    try {
      core.debug(`Listing operations for API: ${apiId}`)

      const operations = this.client.apiOperation.listByApi(
        this.config.resourceGroupName,
        this.config.serviceName,
        apiId
      )

      const operationIds: string[] = []
      for await (const operation of operations) {
        if (operation.name) {
          operationIds.push(operation.name)
        }
      }

      core.debug(
        `Found ${operationIds.length} operations for ${apiId}: ${operationIds.join(', ')}`
      )
      return operationIds
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      core.warning(`Failed to list operations for ${apiId}: ${errorMessage}`)
      return []
    }
  }

  /**
   * Test Azure connection and authentication
   */
  async testConnection(): Promise<boolean> {
    try {
      core.info('Testing Azure connection...')

      // Try to get the APIM service to test authentication
      const service = await this.client.apiManagementService.get(
        this.config.resourceGroupName,
        this.config.serviceName
      )

      core.info('Azure connection test successful')
      core.debug(`APIM Service: ${service.name} (${service.location})`)
      return true
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      core.error(`Azure connection test failed: ${errorMessage}`)
      return false
    }
  }
}

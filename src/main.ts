import * as core from '@actions/core'
import { AzureApimClient } from './azure-client.js'
import { parseInputs } from './utils.js'
import { discoverPolicies, validatePolicies } from './policy-discovery.js'

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    core.info('Starting Azure API Management Policy Update action...')

    // Parse and validate inputs
    const config = parseInputs()

    // Initialize Azure client
    const client = new AzureApimClient(config)

    // Test Azure connection
    const connectionTest = await client.testConnection()
    if (!connectionTest) {
      throw new Error('Failed to connect to Azure API Management service')
    }

    // List available APIs for debugging
    core.info('Listing available APIs in APIM service...')
    const availableApis = await client.listApis()
    if (availableApis.length > 0) {
      core.info(`Available APIs: ${availableApis.join(', ')}`)

      // List operations for each API (for debugging)
      for (const apiId of availableApis.slice(0, 3)) {
        // Limit to first 3 APIs to avoid too much output
        const operations = await client.listOperations(apiId)
        if (operations.length > 0) {
          core.info(`API '${apiId}' operations: ${operations.join(', ')}`)
        } else {
          core.info(`API '${apiId}' has no operations`)
        }
      }
    } else {
      core.warning('No APIs found in APIM service')
    }

    // Discover policy files
    core.info('Discovering policy files...')
    const policies = await discoverPolicies(config.policyManifestPath)

    if (policies.length === 0) {
      core.warning('No policy files found to update')
      core.setOutput('etag', '')
      return
    }

    // Validate discovered policies
    const isValid = validatePolicies(policies)
    if (!isValid) {
      throw new Error('Policy validation failed')
    }

    core.info(`Found ${policies.length} valid policy files to process`)

    // Process policy updates
    core.info('Starting policy updates...')
    let lastETag = ''

    for (const policy of policies) {
      try {
        let result

        if (policy.scope === 'api') {
          result = await client.updateApiPolicy(policy.apiId, policy.content)
        } else {
          result = await client.updateOperationPolicy(
            policy.apiId,
            policy.operationId!,
            policy.content
          )
        }

        if (result.updated) {
          if (result.etag) {
            lastETag = result.etag
          }
          core.info(
            `Successfully updated ${policy.scope} policy: ${policy.apiId}${policy.operationId ? `/${policy.operationId}` : ''}`
          )
        } else if (result.error) {
          core.error(
            `Failed to update ${policy.scope} policy: ${policy.apiId}${policy.operationId ? `/${policy.operationId}` : ''} - ${result.error}`
          )
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        core.error(
          `Error processing policy ${policy.filePath}: ${errorMessage}`
        )
      }
    }

    // Set output
    core.setOutput('etag', lastETag)

    core.info('Action completed successfully')
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('An unknown error occurred')
    }

    // Set default outputs on error
    core.setOutput('etag', '')
  }
}

import * as core from '@actions/core'
import type { ApimConfig } from './types.js'

/**
 * Parse and validate action inputs
 */
export function parseInputs(): ApimConfig {
  const subscriptionId = core.getInput('subscription_id', { required: true })
  const resourceGroupName = core.getInput('resource_group', { required: true })
  const serviceName = core.getInput('apim_name', { required: true })
  const policyManifestPath = core.getInput('policy_manifest_path') || undefined

  if (!subscriptionId) {
    throw new Error('subscription_id input is required')
  }
  if (!resourceGroupName) {
    throw new Error('resource_group input is required')
  }
  if (!serviceName) {
    throw new Error('apim_name input is required')
  }

  core.info('Configuration loaded:')
  core.info(`  Subscription ID: ${subscriptionId}`)
  core.info(`  Resource Group: ${resourceGroupName}`)
  core.info(`  APIM Service: ${serviceName}`)
  if (policyManifestPath) {
    core.info(`  Policy Manifest: ${policyManifestPath}`)
  }

  return {
    subscriptionId,
    resourceGroupName,
    serviceName,
    policyManifestPath
  }
}

/**
 * Validate XML content
 */
export function validateXmlContent(content: string): boolean {
  if (!content || content.trim().length === 0) {
    return false
  }

  // Basic XML validation - check for basic structure
  const trimmed = content.trim()
  if (!trimmed.startsWith('<') || !trimmed.endsWith('>')) {
    return false
  }

  // Check for policies root element
  if (!trimmed.includes('<policies>') || !trimmed.includes('</policies>')) {
    return false
  }

  return true
}

/**
 * Extract API ID from file path
 */
export function extractApiIdFromPath(filePath: string): string | null {
  // Match pattern: policies/<apiId>/api.xml or policies/<apiId>/operations/<operationId>.xml
  const match = filePath.match(/policies[/\\]([^/\\]+)[/\\]/)
  return match ? match[1] : null
}

/**
 * Extract operation ID from file path
 */
export function extractOperationIdFromPath(filePath: string): string | null {
  // Match pattern: policies/<apiId>/operations/<operationId>.xml
  const match = filePath.match(
    /policies[/\\][^/\\]+[/\\]operations[/\\]([^/\\]+)\.xml$/
  )
  return match ? match[1] : null
}

/**
 * Determine if path is an API-level policy
 */
export function isApiLevelPolicy(filePath: string): boolean {
  return filePath.match(/policies[/\\][^/\\]+[/\\]api\.xml$/) !== null
}

/**
 * Determine if path is an operation-level policy
 */
export function isOperationLevelPolicy(filePath: string): boolean {
  return (
    filePath.match(/policies[/\\][^/\\]+[/\\]operations[/\\][^/\\]+\.xml$/) !==
    null
  )
}

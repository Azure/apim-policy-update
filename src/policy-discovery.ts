import * as fs from 'fs/promises'
import * as path from 'path'
import { glob } from 'glob'
import { parse as parseYaml } from 'yaml'
import * as core from '@actions/core'
import type { PolicyFile, PolicyManifest } from './types.js'
import {
  validateXmlContent,
  extractApiIdFromPath,
  extractOperationIdFromPath,
  isApiLevelPolicy,
  isOperationLevelPolicy
} from './utils.js'

/**
 * Discover policy files using default directory structure
 */
export async function discoverPoliciesFromDefaultStructure(
  baseDir: string = '.'
): Promise<PolicyFile[]> {
  const policies: PolicyFile[] = []

  try {
    // Find all XML files in policies directory
    const policyPattern = path
      .join(baseDir, 'policies', '**', '*.xml')
      .replace(/\\/g, '/')
    core.debug(`Searching for policy files with pattern: ${policyPattern}`)

    const policyFiles = await glob(policyPattern, {
      cwd: baseDir,
      absolute: false,
      windowsPathsNoEscape: true
    })

    core.info(`Found ${policyFiles.length} potential policy files`)

    for (const filePath of policyFiles) {
      const absolutePath = path.resolve(baseDir, filePath)

      try {
        // Read and validate XML content
        const content = await fs.readFile(absolutePath, 'utf-8')

        if (!validateXmlContent(content)) {
          core.warning(`Skipping invalid XML file: ${filePath}`)
          continue
        }

        // Extract API ID from path
        const apiId = extractApiIdFromPath(filePath)
        if (!apiId) {
          core.warning(`Cannot extract API ID from path: ${filePath}`)
          continue
        }

        // Determine policy scope and operation ID
        let scope: 'api' | 'operation'
        let operationId: string | undefined

        if (isApiLevelPolicy(filePath)) {
          scope = 'api'
        } else if (isOperationLevelPolicy(filePath)) {
          scope = 'operation'
          const extractedOperationId = extractOperationIdFromPath(filePath)
          if (!extractedOperationId) {
            core.warning(`Cannot extract operation ID from path: ${filePath}`)
            continue
          }
          operationId = extractedOperationId
        } else {
          core.warning(`Unknown policy scope for file: ${filePath}`)
          continue
        }

        policies.push({
          filePath: absolutePath,
          apiId,
          operationId,
          scope,
          content
        })

        core.debug(
          `Added policy: ${apiId}/${operationId || 'api'} from ${filePath}`
        )
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        core.warning(
          `Failed to process policy file ${filePath}: ${errorMessage}`
        )
      }
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    core.error(
      `Failed to discover policies from default structure: ${errorMessage}`
    )
  }

  return policies
}

/**
 * Load and parse policy manifest file
 */
export async function loadPolicyManifest(
  manifestPath: string
): Promise<PolicyManifest | null> {
  try {
    core.info(`Loading policy manifest from: ${manifestPath}`)

    const manifestContent = await fs.readFile(manifestPath, 'utf-8')
    const manifest = parseYaml(manifestContent) as PolicyManifest

    if (!manifest || !manifest.policies) {
      core.error('Invalid manifest format: missing policies section')
      return null
    }

    core.info(
      `Loaded manifest with ${Object.keys(manifest.policies).length} API entries`
    )
    return manifest
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    core.error(`Failed to load policy manifest: ${errorMessage}`)
    return null
  }
}

/**
 * Discover policy files using manifest configuration
 */
export async function discoverPoliciesFromManifest(
  manifestPath: string,
  baseDir: string = '.'
): Promise<PolicyFile[]> {
  const policies: PolicyFile[] = []

  const manifest = await loadPolicyManifest(manifestPath)
  if (!manifest) {
    return policies
  }

  for (const [apiId, apiConfig] of Object.entries(manifest.policies)) {
    try {
      // Process API-level policy
      if (apiConfig.apiPolicyPath) {
        const absolutePath = path.resolve(baseDir, apiConfig.apiPolicyPath)

        try {
          const content = await fs.readFile(absolutePath, 'utf-8')

          if (validateXmlContent(content)) {
            policies.push({
              filePath: absolutePath,
              apiId,
              scope: 'api',
              content
            })
            core.debug(`Added API policy for ${apiId} from manifest`)
          } else {
            core.warning(
              `Invalid XML content in API policy for ${apiId}: ${apiConfig.apiPolicyPath}`
            )
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'
          core.warning(
            `Failed to read API policy for ${apiId}: ${errorMessage}`
          )
        }
      }

      // Process operation-level policies
      if (apiConfig.operations) {
        for (const [operationId, operationPath] of Object.entries(
          apiConfig.operations
        )) {
          const absolutePath = path.resolve(baseDir, operationPath)

          try {
            const content = await fs.readFile(absolutePath, 'utf-8')

            if (validateXmlContent(content)) {
              policies.push({
                filePath: absolutePath,
                apiId,
                operationId,
                scope: 'operation',
                content
              })
              core.debug(
                `Added operation policy for ${apiId}/${operationId} from manifest`
              )
            } else {
              core.warning(
                `Invalid XML content in operation policy for ${apiId}/${operationId}: ${operationPath}`
              )
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error'
            core.warning(
              `Failed to read operation policy for ${apiId}/${operationId}: ${errorMessage}`
            )
          }
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      core.warning(
        `Failed to process API configuration for ${apiId}: ${errorMessage}`
      )
    }
  }

  return policies
}

/**
 * Discover all policy files based on configuration
 */
export async function discoverPolicies(
  manifestPath?: string,
  baseDir: string = '.'
): Promise<PolicyFile[]> {
  if (manifestPath) {
    core.info('Using policy manifest for discovery')
    return discoverPoliciesFromManifest(manifestPath, baseDir)
  } else {
    core.info('Using default directory structure for discovery')
    return discoverPoliciesFromDefaultStructure(baseDir)
  }
}

/**
 * Validate that all discovered policies are valid
 */
export function validatePolicies(policies: PolicyFile[]): boolean {
  let isValid = true

  if (policies.length === 0) {
    core.warning('No policy files discovered')
    return false
  }

  const apiCounts = new Map<string, { api: number; operations: number }>()

  for (const policy of policies) {
    // Count policies per API
    const counts = apiCounts.get(policy.apiId) || { api: 0, operations: 0 }
    if (policy.scope === 'api') {
      counts.api++
    } else {
      counts.operations++
    }
    apiCounts.set(policy.apiId, counts)

    // Validate content again
    if (!validateXmlContent(policy.content)) {
      core.error(`Invalid XML content in policy: ${policy.filePath}`)
      isValid = false
    }
  }

  // Report summary
  for (const [apiId, counts] of apiCounts.entries()) {
    core.info(
      `API ${apiId}: ${counts.api} API policy, ${counts.operations} operation policies`
    )

    if (counts.api > 1) {
      core.warning(`Multiple API policies found for ${apiId}`)
      isValid = false
    }
  }

  return isValid
}

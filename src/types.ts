/**
 * Configuration for the Azure API Management service
 */
export interface ApimConfig {
  /** Azure subscription ID */
  subscriptionId: string
  /** Resource group name */
  resourceGroupName: string
  /** API Management service name */
  serviceName: string
  /** Optional path to policy manifest file */
  policyManifestPath?: string
}

/**
 * Policy file information
 */
export interface PolicyFile {
  /** Path to the policy XML file */
  filePath: string
  /** API ID */
  apiId: string
  /** Operation ID (undefined for API-level policies) */
  operationId?: string
  /** Policy scope: 'api' or 'operation' */
  scope: 'api' | 'operation'
  /** Policy XML content */
  content: string
}

/**
 * Policy manifest entry
 */
export interface PolicyManifestEntry {
  /** API ID */
  apiId: string
  /** Path to API-level policy file */
  apiPolicyPath?: string
  /** Operation-level policy mappings */
  operations?: Record<string, string>
}

/**
 * Policy manifest structure
 */
export interface PolicyManifest {
  /** Policy entries indexed by API ID */
  policies: Record<string, PolicyManifestEntry>
}

/**
 * Policy update result
 */
export interface PolicyUpdateResult {
  /** API ID */
  apiId: string
  /** Operation ID (undefined for API-level policies) */
  operationId?: string
  /** Whether the policy was updated */
  updated: boolean
  /** ETag of the updated resource */
  etag?: string
  /** Error message if update failed */
  error?: string
}

/**
 * Action outputs
 */
export interface ActionOutputs {
  /** Whether any policies were updated */
  updated: boolean
  /** ETag of the last updated resource */
  etag: string
}

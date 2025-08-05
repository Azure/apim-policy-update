# Azure API Management Policy Update

![Coverage Badge](./badges/coverage.svg)

A GitHub Action that automatically updates Azure API Management policies from
your Git repository using the Azure SDK. This action provides reliable policy
updates and comprehensive error handling to ensure your APIM policies are always
in sync with your repository.

## ✨ Features

- **🔍 Automatic Policy Discovery**: Supports both conventional directory
  structure (`policies/<apiId>/`) and custom manifest files
  (`policy_manifest.yaml`)
- **✅ Resource Validation**: Verifies API and operation existence before
  attempting policy updates to prevent errors
- **🏷️ ETag Support**: Proper concurrency control using Azure REST API ETags for
  safe updates
- **📊 Detailed Logging**: Comprehensive logging with API/operation listing for
  debugging and monitoring
- **🔒 Multiple Authentication Methods**: Supports Azure CLI, Service Principal,
  Managed Identity, and Workload Identity
- **🛡️ Error Resilience**: Robust error handling with detailed Azure API error
  reporting
- **⚡ Simple & Reliable**: Streamlined implementation focused on getting
  policies updated quickly and reliably

## 🏗️ Architecture

This action is built with TypeScript and uses the official Azure SDK for
JavaScript. It follows these design principles:

- **Policy-First**: Treats your Git repository as the single source of truth for
  APIM policies
- **Reliable**: Updates policies consistently with proper error handling and
  validation
- **Observable**: Provides detailed logging and outputs for integration with
  other workflow steps
- **Secure**: Uses Azure's recommended authentication patterns with proper
  credential handling

## 🚀 Quick Start

### Basic Usage

```yaml
name: Update APIM Policies

on:
  push:
    branches: [main]
    paths: ['Policies/**', 'policy_manifest.yaml']
  workflow_dispatch:

permissions:
  id-token: write
  contents: read

jobs:
  update-policies:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Azure Login (OpenID Connect)
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Update APIM Policies
        uses: azure/apim-policy-update@v1
        id: update-policies
        with:
          apim_name: 'my-apim-service'
          resource_group: 'my-resource-group'
          subscription_id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
          # policy_manifest_path: 'custom-manifest.yaml'  # Optional

      - name: Output Results
        run: |
          echo "Last ETag: ${{ steps.update-policies.outputs.etag }}"
```

## 📁 Policy File Structure

This action supports two methods for organizing your policy files:

### Method 1: Convention-based Directory Structure

```
policies/
├── sample-api/
│   ├── api.xml              # API level policy
│   └── operations/
│       ├── get-users.xml    # Operation level policy
│       └── post-users.xml   # Operation level policy
└── another-api/
    ├── api.xml
    └── operations/
        └── create-order.xml
```

- **API Level Policies**: `policies/<apiId>/api.xml`
- **Operation Level Policies**: `policies/<apiId>/operations/<operationId>.xml`

### Method 2: Custom Manifest File

Create a `policy_manifest.yaml` file to define custom file locations:

```yaml
policies:
  # API level policy
  - apiId: 'sample-api'
    file: 'custom-policies/sample-api-policy.xml'
    scope: 'api'

  # Operation level policies
  - apiId: 'sample-api'
    operationId: 'get-users'
    file: 'custom-policies/get-users-policy.xml'
    scope: 'operation'

  - apiId: 'sample-api'
    operationId: 'post-users'
    file: 'custom-policies/post-users-policy.xml'
    scope: 'operation'
```

### Policy XML Format

Policy files should contain valid Azure API Management policy XML:

```xml
<policies>
    <inbound>
        <base />
        <rate-limit calls="100" renewal-period="60" />
        <set-header name="X-Custom-Header" exists-action="override">
            <value>Custom Value</value>
        </set-header>
    </inbound>
    <backend>
        <base />
    </backend>
    <outbound>
        <base />
    </outbound>
    <on-error>
        <base />
    </on-error>
</policies>
```

## ⚙️ Inputs

| Name                   | Description                       | Required | Default                                |
| ---------------------- | --------------------------------- | -------- | -------------------------------------- |
| `subscription_id`      | Azure subscription ID             | ✅       |                                        |
| `resource_group`       | Azure resource group name         | ✅       |                                        |
| `apim_name`            | Azure API Management service name | ✅       |                                        |
| `policy_manifest_path` | Path to policy manifest file      | ❌       | `""` (uses convention-based discovery) |

## 📤 Outputs

| Name   | Description                       | Type     |
| ------ | --------------------------------- | -------- |
| `etag` | ETag of the last updated resource | `string` |

## 🔐 Authentication

This action uses Azure's `DefaultAzureCredential`, which supports multiple
authentication methods in order of precedence:

### 1. Workload Identity (Recommended for GitHub Actions)

```yaml
- name: Azure Login (OpenID Connect)
  uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

### 2. Service Principal with Client Secret

```yaml
- name: Azure Login (Service Principal)
  uses: azure/login@v2
  with:
    creds: ${{ secrets.AZURE_CREDENTIALS }}
```

Where `AZURE_CREDENTIALS` contains:

```json
{
  "clientId": "<client-id>",
  "clientSecret": "<client-secret>",
  "tenantId": "<tenant-id>",
  "subscriptionId": "<subscription-id>"
}
```

### 3. Azure CLI (for local development)

```bash
az login
```

### 4. Managed Identity (when running on Azure)

Automatically used when running on Azure resources with managed identity
enabled.

## 🧪 Testing Strategy

This action follows a comprehensive testing approach to ensure reliability
without compromising security:

### CI/CD Pipeline Tests

The continuous integration pipeline includes two types of tests:

1. **Mock Tests** (runs on every PR/push):
   - Tests action initialization and input validation
   - Uses mock Azure credentials to verify the action loads correctly
   - Fails gracefully without making real API calls
   - Safe to run in public repositories

2. **Integration Tests** (manual trigger or protected environments):
   - Tests against real Azure APIM resources
   - Requires valid Azure credentials stored as GitHub Secrets
   - Only runs when manually triggered or in trusted environments
   - Uses dedicated test APIM service to avoid affecting production

### Local Development Testing

For local testing during development:

```bash
# Install dependencies
npm install

# Run unit tests
npm run test

# Run linting checks
npm run lint

# Check code formatting
npm run format:check

# Fix formatting issues
npm run format:write

# Build the action
npm run bundle

# Test with mock Azure resources (will fail authentication, but validates logic)
node dist/index.js
```

### Local Linting Setup

To run comprehensive linting locally (similar to CI):

```bash
# Install additional linting tools
pip install yamllint
npm install -g markdownlint-cli

# Check YAML files
yamllint .github/workflows/*.yml

# Check Markdown files
markdownlint README.md examples/README.md

# Run all project lints
npm run lint && npm run format:check
```

### Required Secrets for Integration Testing

To run integration tests, configure these secrets in your repository:

- `AZURE_CREDENTIALS`: Service principal credentials (JSON format)
- `AZURE_SUBSCRIPTION_ID`: Azure subscription ID
- `AZURE_RESOURCE_GROUP`: Resource group containing test APIM service
- `AZURE_APIM_NAME`: Name of test APIM service

**Security Note**: Never commit real Azure credentials to version control.
Integration tests should only be run in controlled environments with proper
secret management.

## 🔧 Advanced Configuration

### Custom Manifest with Mixed Sources

```yaml
policies:
  # Use convention-based file for API policy
  - apiId: 'orders-api'
    file: 'policies/orders-api/api.xml'
    scope: 'api'

  # Use custom location for operation policy
  - apiId: 'orders-api'
    operationId: 'get-orders'
    file: 'src/policies/orders/get-orders-policy.xml'
    scope: 'operation'
```

### Multiple Environment Support

```yaml
strategy:
  matrix:
    environment: [dev, staging, prod]

steps:
  - name: Update APIM Policies
    uses: azure/apim-policy-update@v1
    with:
      apim_name: 'apim-${{ matrix.environment }}'
      resource_group: 'rg-${{ matrix.environment }}'
      subscription_id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

## 🔍 Monitoring and Debugging

### Enable Debug Logging

Set the `ACTIONS_STEP_DEBUG` secret to `true` in your repository settings to
enable detailed debug logging.

### Example Debug Output

```
::debug::Listing APIs in APIM service...
::debug::Found 3 APIs: sample-api, orders-api, users-api
::debug::API 'sample-api' operations: get-users, post-users
::debug::Getting current API policy for: sample-api
API policy for sample-api has changes, updating...
Updating API policy for: sample-api
Successfully updated API policy for: sample-api
```

### Action Outputs in Workflows

```yaml
- name: Update APIM Policies
  id: update-policies
  uses: azure/apim-policy-update@v1
  with:
    apim_name: 'my-apim-service'
    resource_group: 'my-resource-group'
    subscription_id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

- name: Report Results
  run: |
    echo "✅ Policies updated successfully"
    echo "🏷️ Latest ETag: ${{ steps.update-policies.outputs.etag }}"
```

## 🚨 Error Handling

The action provides comprehensive error handling for common scenarios:

### API/Operation Not Found

```
::warning::API 'non-existent-api' does not exist in APIM service. Available APIs: sample-api, orders-api
```

### Authentication Errors

```
::error::Azure connection test failed: Authentication failed
```

### Policy Validation Errors

```
::error::Failed to update API policy for sample-api: One or more fields contain incorrect values
```

### Network/Connectivity Issues

```
::warning::Failed to get API policy for sample-api: Network timeout
```

## 🧪 Testing

### Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Run tests: `npm test`
4. Build the action: `npm run bundle`

### Test Coverage

The action maintains high test coverage across all components:

- **Overall Coverage**: 84%+
- **Core Logic**: 93%+
- **Azure Integration**: 75%+
- **Policy Discovery**: 87%+

## 📚 Examples

### Example 1: Single API with Multiple Operations

```
policies/
└── user-management-api/
    ├── api.xml                    # Rate limiting, CORS
    └── operations/
        ├── get-user.xml          # Additional authentication
        ├── create-user.xml       # Input validation
        ├── update-user.xml       # Update-specific policies
        └── delete-user.xml       # Admin-only access
```

### Example 2: Multiple APIs with Shared Policies

Using manifest file for better organization:

```yaml
policies:
  # Users API
  - apiId: 'users-api'
    file: 'policies/shared/api-base.xml'
    scope: 'api'
  - apiId: 'users-api'
    operationId: 'get-users'
    file: 'policies/users/get-users.xml'
    scope: 'operation'

  # Orders API
  - apiId: 'orders-api'
    file: 'policies/shared/api-base.xml'
    scope: 'api'
  - apiId: 'orders-api'
    operationId: 'create-order'
    file: 'policies/orders/create-order.xml'
    scope: 'operation'
```

### Example 3: Environment-Specific Policies

```yaml
name: Deploy Policies

on:
  push:
    branches: [main]

jobs:
  deploy-dev:
    runs-on: ubuntu-latest
    environment: development
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - uses: azure/apim-policy-update@v1
        with:
          apim_name: 'apim-dev'
          resource_group: 'rg-dev'
          subscription_id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
          policy_manifest_path: 'environments/dev/policies.yaml'

  deploy-prod:
    runs-on: ubuntu-latest
    environment: production
    needs: deploy-dev
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - uses: azure/apim-policy-update@v1
        with:
          apim_name: 'apim-prod'
          resource_group: 'rg-prod'
          subscription_id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
          policy_manifest_path: 'environments/prod/policies.yaml'
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Ensure tests pass: `npm test`
5. Build the action: `npm run bundle`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file
for details.

## 🔗 Related Resources

- [Azure API Management Documentation](https://docs.microsoft.com/en-us/azure/api-management/)
- [Azure API Management REST API Reference](https://docs.microsoft.com/en-us/rest/api/apimanagement/)
- [Azure Authentication in GitHub Actions](https://docs.microsoft.com/en-us/azure/developer/github/connect-from-azure)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

## 🆘 Support

- **Issues**:
  [GitHub Issues](https://github.com/Azure/apim-policy-update/issues)
- **Documentation**: This README and inline code documentation
- **Community**:
  [GitHub Discussions](https://github.com/Azure/apim-policy-update/discussions)

---

Made with ❤️ by the Azure team

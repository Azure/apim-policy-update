# Manifest-Based Policy Management Example

This example demonstrates how to use a policy manifest file to specify custom
paths for your API Management policies.

## Structure

```
examples/
├── policy_manifest.yaml    # Manifest file specifying policy locations
└── policies/              # Policy files organized by API
    ├── README.md           # Development policies documentation
    └── sample-api/
        ├── api.xml         # API-level policy
        └── operations/
            └── get-data.xml # Operation-level policy
```

## Usage

To use manifest-based discovery, specify the manifest path in your GitHub
Action:

```yaml
- name: Update APIM Policies
  uses: azure/apim-policy-update@v1
  with:
    subscription_id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
    resource_group: ${{ secrets.AZURE_RESOURCE_GROUP }}
    apim_name: ${{ secrets.APIM_SERVICE_NAME }}
    policy_manifest_path: 'examples/policy_manifest.yaml'
```

## Manifest Format

The `policy_manifest.yaml` file specifies the mapping between APIs/operations
and their policy files:

```yaml
policies:
  sample-api:
    apiPolicyPath: 'examples/policies/sample-api/api.xml'
    operations:
      get-data: 'examples/policies/sample-api/operations/get-data.xml'
```

This approach is useful when you need:

- Custom file organization
- Policies stored in non-standard locations
- Selective policy deployment
- Complex directory structures

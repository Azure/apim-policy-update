# Azure API Management Policy Update

![Coverage Badge](./badges/coverage.svg)

GitHub Action to update Azure API Management (APIM) policies from files in your
repository using the official Azure SDK.

## What it does

- Automatic policy discovery
  - Convention: policies/<apiId>/api.xml and
    policies/<apiId>/operations/<operationId>.xml
  - Manifest: policy_manifest.yaml (see schema below)
- Resource checks: verifies API and operation exist before updating
- Basic XML validation: ensures files contain a <policies>…</policies> root
- Clear logging and error messages (lists APIs and some operations for context)
- Output: exposes the last ETag returned by Azure after updates

> Note: This action performs straightforward updates via the Azure SDK. It does
> not implement conditional-if-match concurrency using ETags or pre-update
> diffing.

## Quick start

```yaml
name: Update APIM Policies

on:
  push:
    branches: [main]
    paths: ['policies/**', 'policy_manifest.yaml']
  workflow_dispatch:

jobs:
  update-policies:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Azure Login
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Update APIM Policies
        uses: azure/apim-policy-update@v1
        id: update-apim-policy
        with:
          apim_name: 'my-apim-service'
          resource_group: 'my-resource-group'
          subscription_id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
          # policy_manifest_path: 'path/to/policy_manifest.yaml'  # optional

      - run: echo "Last ETag=${{ steps.update-apim-policy.outputs.etag }}"
```

## Policy layout

Option 1 — Convention (no manifest):

```
policies/
├── sample-api/
│   ├── api.xml
│   └── operations/
│       ├── get-users.xml
│       └── post-users.xml
└── another-api/
    ├── api.xml
    └── operations/
        └── create-order.xml
```

Option 2 — Manifest (policy_manifest.yaml):

```yaml
policies:
  users-api:
    apiPolicyPath: policies/users-api/api.xml # optional
    operations: # optional
      get-users: policies/users-api/operations/get-users.xml
      post-users: policies/users-api/operations/post-users.xml

  orders-api:
    apiPolicyPath: policies/orders-api/api.xml
    operations:
      create-order: policies/orders-api/operations/create-order.xml
```

Policy file contents must be valid APIM policy XML (only a basic XML check is
performed by the action).

## Inputs

| Name                 | Description               | Required |
| -------------------- | ------------------------- | -------- |
| subscription_id      | Azure subscription ID     | yes      |
| resource_group       | Azure resource group name | yes      |
| apim_name            | APIM service name         | yes      |
| policy_manifest_path | Path to manifest file     | no       |

## Outputs

| Name | Description                                   |
| ---- | --------------------------------------------- |
| etag | ETag returned from the last successful update |

## Debugging and errors

- Enable step debug: set ACTIONS_STEP_DEBUG=true (repo secret) to get extra
  logs.
- Typical warnings/errors:
  - API or operation not found (lists available items)
  - Authentication/connection failures
  - Invalid or malformed policy XML

## Local development

```bash
npm install
npm run all
```

Run action locally

```bash
cp .env.example .env
# Update .env with your Azure credentials

npm run local-action
```

## Contributing and license

- PRs welcome. Please keep changes scoped and add/update tests.
- Licensed under the MIT License (see LICENSE).

## Links

- Azure API Management docs: https://learn.microsoft.com/azure/api-management/
- GitHub Actions docs: https://docs.github.com/actions

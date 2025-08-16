# Azure API Management Policy Update

![Coverage Badge](./badges/coverage.svg)

GitHub Action to update Azure API Management (APIM) policies from files in your
repository using the official Azure SDK.

## What it does

- Automatic policy discovery
  - Convention: `policies/<apiId>/api.xml` and
    `policies/<apiId>/operations/<operationId>.xml`
  - Manifest: `policy_manifest.yaml` (see schema below)
- Resource checks: verifies API and operation exist before updating
- Basic XML validation: ensures files contain a `<policies>…</policies>` root
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

permissions:
  id-token: write
  contents: read

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
        uses: Azure/apim-policy-update@v1.1.3
        id: update-apim-policy
        with:
          apim_name: ${{ secrets.AZURE_APIM_NAME }}
          resource_group: ${{ secrets.AZURE_RESOURCE_GROUP }}
          subscription_id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
          policy_manifest_path: 'policy_manifest.yaml'

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

Option 2 — Manifest (`policy_manifest.yaml`):

**User can specify custom paths for API and operation policies.**

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

### Setup

```bash
# Clone the repository
git clone https://github.com/Azure/apim-policy-update.git
cd apim-policy-update

# Install dependencies
npm install
# Run script (include format/lint/test/coverage/package)
npm run all
```

### Run action locally

To try a real end-to-end update from your machine, prepare these first:

- Have an Azure API Management (APIM) instance
- In that APIM, create an API with id `sample-api` and an operation with id
  `get-data` (to match the examples)
- Copy `.env.example` to `.env` and set your Azure values:
  - `INPUT_SUBSCRIPTION_ID`
  - `INPUT_RESOURCE_GROUP`
  - `INPUT_APIM_NAME`
  - `INPUT_POLICY_MANIFEST_PATH` can stay as `examples/policy_manifest.yaml`
    (default), which maps to `examples/policies/sample-api/api.xml` and
    `examples/policies/sample-api/operations/get-data.xml`

With those in place, running the local action will update the `sample-api` API
policy and the `get-data` operation policy in your APIM using the example XML
files.

```bash
# Copy .env.example to .env
cp .env.example .env

# Update .env with your Azure credentials

# Login to Azure
az login

# Run action locally
npm run local-action
```

## Contributing

This project welcomes contributions and suggestions. Most contributions require
you to agree to a Contributor License Agreement (CLA) declaring that you have
the right to, and actually do, grant us the rights to use your contribution. For
details, visit <https://cla.opensource.microsoft.com>.

When you submit a pull request, a CLA bot will automatically determine whether
you need to provide a CLA and decorate the PR appropriately (e.g., status check,
comment). Simply follow the instructions provided by the bot. You will only need
to do this once across all repos using our CLA.

This project has adopted the
[Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the
[Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any
additional questions or comments.

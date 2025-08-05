# Development Policies

This directory contains policy files for **local development and testing** of
the Azure API Management Policy Update action.

## ⚠️ Important Notice

**These policies are for development/testing purposes only** and reference the
Azure APIM instance configured in `.env`:

- **Subscription**: `d2ef40cb-04b9-4578-a5cd-6b49d728d3de`
- **Resource Group**: `rg-apim-test`
- **APIM Service**: `dev-apim-momosuke`

## 📁 Structure

```
policies/
└── sample-api/
    ├── api.xml                    # API-level policies
    └── operations/
        └── get-data.xml          # Operation-level policies
```

## 🚀 Usage

These policies are automatically used when running:

```bash
npm run local-action
```

## Customization

Modify these files to test your own policy configurations locally before
deploying to production environments.

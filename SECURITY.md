# Security Policy

## Supported Versions

SchemaBridge is currently in **pre‑1.0** (`0.x`).  
Security fixes will be applied to the latest released version.

## Reporting a Vulnerability

If you believe you have found a security vulnerability in SchemaBridge:

1. **Do not** open a public GitHub issue.
2. Instead, please contact the maintainer privately:
   - Email: **a.adenuga@hotmail.com**

3. Include as much detail as possible:
   - Version of SchemaBridge
   - How you discovered the issue
   - Steps to reproduce (if applicable)
   - Any potential impact you see

We aim to:

- Acknowledge receipt of your report as soon as possible.
- Investigate and validate the issue.
- Work on a fix and coordinate a release.
- Credit you in release notes if you’d like (or keep you anonymous if you prefer).

## Public Disclosure

Please give us a reasonable amount of time to investigate and fix the issue before any public disclosure.  
We’ll coordinate with you on timing once we understand the impact and a fix is ready.

## Operational Security Notes

- The docs playground conversion endpoint is intended to run in a constrained environment.
- In production, require explicit opt-in via `SCHEMABRIDGE_ENABLE_DOCS_CONVERSION=true` to enable `/api/convert`.
- Apply external rate limiting/WAF controls at the edge in addition to in-process throttling.
- Treat CLI/folder conversion as trusted-input operations only.

## Security Release Checklist

Before release, run:

1. `pnpm -r test`
2. `pnpm security:audit`
3. Manual staging checks for `/api/convert`:
   - reject oversized requests before JSON parse
   - enforce timeout on expensive payloads
   - reject unsupported/non-safe schema expressions
4. Verify no secrets are exposed in error messages.

Record any accepted advisories (with reason and revisit date) in the release notes.

# Publishing Guide

This document explains how to publish SchemaBridge to npm, PyPI, and deploy documentation.

## Quick production checklist

- [ ] Working tree clean; `pnpm test` green
- [ ] `pnpm build` creates `bin/schemabridge.js` and copies it to `python/schemabridge/bin/schemabridge.js`
- [ ] Versions bumped and aligned in `package.json` **and** `python/pyproject.toml`; `CHANGELOG.md` updated
- [ ] `npm pack --dry-run` shows bundled CLI and python assets are included
- [ ] `cd python && python -m build` succeeds; `twine check dist/*` passes
- [ ] Tag and GitHub Release created; `publish.yml` run finishes successfully

## Prerequisites

### npm Publishing

1. **npm account**: Create an account at [npmjs.com](https://www.npmjs.com)

2. **First-time setup** (one-time, for initial publish):

   **Option A: Manual first publish** (simplest):

   ```bash
   # Login to npm locally
   npm login

   # Publish the first version manually
   npm publish --access public
   ```

   After the first publish, the GitHub Actions workflow will use Trusted Publishing automatically.

   **Option B: Use temporary token for first publish**:
   - Create a granular access token at https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Add it as GitHub secret `NPM_TOKEN` (temporary, only for first publish)
   - The workflow will use it once, then you can remove it
   - After first publish, the workflow automatically switches to Trusted Publishing

3. **Trusted Publishing (OIDC)** - **Automatic after first publish**:
   - No configuration needed! The workflow automatically uses OIDC when:
     - `id-token: write` permission is set (already configured)
     - `setup-node@v4` is used with `registry-url` (already configured)
     - `--provenance` flag is used (already configured)
   - npm will automatically authenticate using GitHub's OIDC provider

   **Why Trusted Publishing?**
   - No long-lived tokens to rotate (npm now limits granular tokens to 90 days max)
   - More secure: uses temporary, job-specific credentials
   - Automatic provenance attestation
   - Aligns with npm's new security requirements ([see announcement](https://github.blog/changelog/2025-09-29-strengthening-npm-security-important-changes-to-authentication-and-token-management/))

   **Note**: If you want to verify trusted publishing is working, check the workflow logs - you'll see OIDC authentication instead of token-based auth.

### PyPI Publishing

1. **PyPI account**: Create an account at [pypi.org](https://pypi.org)
2. **Trusted Publishing**: Set up trusted publishing (recommended):
   - Go to https://pypi.org/manage/account/publishing/
   - Add a new pending publisher
   - Owner: `iamtemi` (or your GitHub org)
   - Repository name: `schemabridge`
   - Workflow filename: `.github/workflows/publish.yml`
   - PyPI will verify and activate it

   **Alternative (legacy)**: If you prefer API tokens:
   - Create a token at https://pypi.org/manage/account/token/
   - Add as GitHub secret `PYPI_API_TOKEN`

### GitHub Pages

1. **Enable Pages**:
   - Go to repo → Settings → Pages
   - Source: "GitHub Actions"
   - The workflow will handle deployment automatically

## Publishing Process

### Option 1: Automated (Recommended)

#### npm & PyPI

1. **Update version** in `package.json`:

   ```bash
   # For patch: 0.1.0 → 0.1.1
   npm version patch

   # For minor: 0.1.0 → 0.2.0
   npm version minor

   # For major: 0.1.0 → 1.0.0
   npm version major
   ```

   This creates a git tag automatically.

2. **Push the tag**:

   ```bash
   git push origin main --tags
   ```

3. **Create a GitHub Release**:
   - Go to your repo → Releases → "Draft a new release"
   - Choose the tag you just pushed
   - Add release notes (you can copy from `CHANGELOG.md`)
   - Click "Publish release"
   - The `publish.yml` workflow will automatically:
     - Run tests
     - Build the project
     - Publish to npm
     - Publish to PyPI

#### Documentation

- **Automatic**: Docs deploy automatically on push to `main` or `dev` branches
- **Manual**: Go to Actions → "Deploy Docs" → "Run workflow"

### Option 2: Manual Publishing

#### npm (Manual)

```bash
# 1. Ensure you're logged in
npm login

# 2. Update version in package.json
npm version patch  # or minor/major

# 3. Build and test
pnpm ci
pnpm build

# 4. Publish
# Note: --access public is required for scoped packages, optional for unscoped
# (Our package is unscoped, but --access public doesn't hurt)
npm publish --access public
```

**Note**: Your package (`schemabridge`) is **unscoped**, so `--access public` is technically optional, but it's included in the workflow for consistency and in case you ever scope it (e.g., `@iamtemi/schemabridge`).

#### PyPI (Manual)

```bash
# 1. Build the Node.js CLI first
pnpm build

# 2. Build Python package
cd python
pip install build twine
python -m build

# 3. Upload to PyPI
twine upload dist/*
```

## Version Management

- **Version format**: Follow [Semantic Versioning](https://semver.org/)
- **Update locations**:
  - `package.json` (for npm)
  - `python/pyproject.toml` (for PyPI) - should match `package.json` version
  - `CHANGELOG.md` (add entry for new version)

## Documentation URLs

After deployment, your docs will be available at:

- **GitHub Pages**: `https://iamtemi.github.io/schemabridge/`

The base path is configured in `docs/.vitepress/config.ts` as `/schemabridge/`.

## Troubleshooting

### npm publish fails

- **If using Trusted Publishing (OIDC)**:
  - Verify trusted publishing is set up at https://www.npmjs.com/settings/YOUR_USERNAME/oauth-applications
  - Check that the workflow has `id-token: write` permission (already configured)
  - Ensure the GitHub App/OAuth app has "Publish packages" permission
  - Check workflow logs for OIDC authentication errors
- **If using tokens (legacy)**:
  - Check `NPM_TOKEN` secret is set correctly (if still using tokens)
  - Verify token hasn't expired (granular tokens now expire in 7-90 days)
  - Ensure version doesn't already exist on npm
  - **Note**: Consider migrating to trusted publishing to avoid token rotation

### PyPI publish fails

- Verify trusted publishing is set up correctly
- Check the workflow has `id-token: write` permission
- Ensure Python package version matches npm version

### Docs don't deploy

- Check GitHub Pages is enabled in repo settings
- Verify the workflow ran successfully in Actions tab
- Check the base path in VitePress config matches your repo name

## Pre-release Checklist

- [ ] All tests pass (`pnpm ci`)
- [ ] Version updated in `package.json` and `python/pyproject.toml`
- [ ] `CHANGELOG.md` updated with new version entry
- [ ] Documentation is up to date
- [ ] README badges point to correct versions
- [ ] Git tag created and pushed
- [ ] GitHub release created with notes

# Publishing Guide

This document explains how to publish SchemaBridge to npm, PyPI, and deploy documentation.

## Prerequisites

### npm Publishing

1. **npm account**: Create an account at [npmjs.com](https://www.npmjs.com)
2. **npm token**: Generate an access token:
   - Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Create a new "Automation" token
   - Add it as a GitHub secret named `NPM_TOKEN`:
     - Go to your repo → Settings → Secrets and variables → Actions
     - Click "New repository secret"
     - Name: `NPM_TOKEN`, Value: your token

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
npm publish --access public
```

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

- Check `NPM_TOKEN` secret is set correctly
- Verify you're not already logged in locally (conflicts with token)
- Ensure version doesn't already exist on npm

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

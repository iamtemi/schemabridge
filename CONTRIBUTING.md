# Contributing to SchemaBridge

Thanks for taking the time to contribute!

This document keeps the contribution process simple while setting expectations for code quality.

## Ways to Contribute

- **Bug reports**: Use the GitHub _Issues_ tab with the Bug Report template.
- **Feature requests**: Use the Feature Request template and explain your use case.
- **Pull requests**: Small, focused PRs are easier to review and merge.

## Development Setup

```bash
git clone https://github.com/iamtemi/schemabridge.git
cd schemabridge
pnpm install
```

Run tests and checks:

```bash
pnpm test
pnpm lint
pnpm typecheck
```

Build the project:

```bash
pnpm build
```

## Pull Request Guidelines

- **Describe the change**: What does the PR do and why?
- **Keep it focused**: One logical change per PR when possible.
- **Add tests**: For new behavior or bug fixes.
- **Keep style consistent**: Run:

  ```bash
  pnpm lint
  pnpm format:check
  ```

- **Docs**: Update README/docs if the user-facing behavior changes.

## Issue Guidelines

For bug reports, please include:

- What you ran (CLI command or code snippet)
- What you expected to happen
- What actually happened (including error messages)
- Environment (OS, Node version, Python version if relevant)

## Code of Conduct

By participating in this project, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

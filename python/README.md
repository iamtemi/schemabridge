# SchemaBridge Python Package

Python wrapper for SchemaBridge - a cross-language schema converter.

## Installation

```bash
pip install schemabridge
```

**Note:** This package requires Node.js to be installed on your system. SchemaBridge will automatically detect your Node.js installation.

## Usage

```bash
schemabridge convert zod input.ts --export enrichedTransactionSchema --to pydantic --out model.py
```

## Requirements

- Python >= 3.9
- Node.js >= 18.0.0

## Documentation

For full documentation, visit the [main SchemaBridge repository](https://github.com/iamtemi/schemabridge).

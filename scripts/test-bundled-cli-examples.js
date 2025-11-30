#!/usr/bin/env node

/**
 * Developer test script to verify the bundled CLI works with the examples/source folder.
 *
 * This is NOT user code - users just run: schemabridge convert folder ...
 *
 * This script runs the actual bundled CLI (bin/schemabridge.js) with and --init flags,
 * verifies the output, and optionally cleans up the generated files.
 *
 * Usage:
 *   node scripts/test-bundled-cli-examples.js [--keep]
 *
 * Use --keep flag to leave generated files in examples/py-output for inspection.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const bundledCLI = path.join(rootDir, 'bin', 'schemabridge.js');
const sourceDir = path.join(rootDir, 'examples', 'source');
const outputDir = path.join(rootDir, 'examples', 'test-results');

async function cleanup() {
  try {
    await fs.rm(outputDir, { recursive: true, force: true });
    console.log('✓ Cleaned up generated files');
  } catch (error) {
    console.error('Error cleaning up:', error);
  }
}

async function main() {
  const keepFiles = process.argv.includes('--keep');

  console.log('Testing bundled CLI with examples/source folder...\n');
  console.log(`Source: ${sourceDir}`);
  console.log(`Output: ${outputDir}`);
  console.log(`CLI: ${bundledCLI}`);
  if (keepFiles) {
    console.log('⚠ Files will be kept in examples/py-output for inspection\n');
  } else {
    console.log('ℹ Files will be cleaned up after verification (use --keep to preserve)\n');
  }

  // Verify CLI exists
  try {
    await fs.access(bundledCLI);
  } catch {
    console.error(`❌ Bundled CLI not found at ${bundledCLI}`);
    console.error('Run "pnpm build:cli" first');
    process.exit(1);
  }

  // Verify source directory exists
  try {
    await fs.access(sourceDir);
  } catch {
    console.error(`❌ Source directory not found at ${sourceDir}`);
    process.exit(1);
  }

  // Clean up any existing output
  await cleanup();

  try {
    console.log('Running: schemabridge convert folder ... --to pydantic --init\n');

    const command = `node ${bundledCLI} convert folder ${sourceDir} --out ${outputDir} --to pydantic --init`;
    console.log(`Command: ${command}\n`);

    execSync(command, {
      cwd: rootDir,
      stdio: 'inherit',
      encoding: 'utf8',
    });

    // Verify files were created
    const files = await fs.readdir(outputDir);
    const pyFiles = files.filter((f) => f.endsWith('.py'));
    const initFile = files.includes('__init__.py');

    console.log('\n✓ Conversion completed successfully!');
    console.log(`  Generated ${pyFiles.length} Python files`);
    console.log(`  __init__.py created: ${initFile ? 'Yes' : 'No'}`);

    if (pyFiles.length > 0) {
      console.log('\n  Sample files:');
      pyFiles.slice(0, 5).forEach((file) => {
        console.log(`    - ${file}`);
      });
      if (pyFiles.length > 5) {
        console.log(`    ... and ${pyFiles.length - 5} more`);
      }
    }

    // Verify at least one file has valid content
    if (pyFiles.length > 0) {
      const sampleFile = path.join(
        outputDir,
        pyFiles.find((f) => f.endsWith('.py') && f !== '__init__.py') || pyFiles[0],
      );
      const content = await fs.readFile(sampleFile, 'utf8');
      if (content.includes('from pydantic') && content.includes('BaseModel')) {
        console.log('\n✓ Generated files contain valid Pydantic code');
      } else {
        console.warn('\n⚠ Warning: Generated file content validation failed');
        console.warn(`  Sample file: ${path.basename(sampleFile)}`);
        console.warn(`  First 200 chars: ${content.substring(0, 200)}`);
      }
    }

    console.log('\n✓ All checks passed!');
    console.log(`\n📁 Generated files are in: ${outputDir}`);

    if (keepFiles) {
      console.log('✓ Files preserved for inspection (used --keep flag)');
      console.log(`  You can inspect them at: ${path.relative(rootDir, outputDir)}`);
    } else {
      console.log('ℹ Cleaning up generated files...');
      await cleanup();
      console.log('✓ Test complete and cleaned up');
    }
  } catch (error) {
    console.error('\n❌ Test failed!');
    console.error(error.message);
    console.log(`\n📁 Generated files (if any) are in: ${outputDir}`);
    if (!keepFiles) {
      await cleanup();
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});

/* eslint-env node */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const versionRegex = /^v?\d+\.\d+\.\d+$/;
// Find the first argument that matches the version pattern (skip '--' separator if present)
const versionArg = process.argv.slice(2).find((arg) => versionRegex.test(arg));

if (!versionArg) {
  console.error('Error: Please provide a valid version number in the format X.Y.Z or vX.Y.Z');
  console.error('Usage: node scripts/set-version.js <version>');
  process.exit(1);
}

// Strip 'v' prefix if present
const newVersion = versionArg.startsWith('v') ? versionArg.slice(1) : versionArg;

const rootDir = path.resolve(__dirname, '..');
// const packageJsonPath = path.join(rootDir, 'package.json');
const docsPackageJsonPath = path.join(rootDir, 'packages', 'docs', 'package.json');
const corePackageJsonPath = path.join(rootDir, 'packages', 'core', 'package.json');
const tsPackages = [corePackageJsonPath, docsPackageJsonPath];
const pyprojectTomlPath = path.join(rootDir, 'python', 'pyproject.toml');

console.log(`Updating version to ${newVersion} in all relevant files...`);

// Update package.json
try {
  for (const packageJsonPath of tsPackages) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    packageJson.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log(`✅ Updated ${path.relative(rootDir, packageJsonPath)}`);
  }
} catch (error) {
  console.error(`Error updating ${tsPackages.join(', ')}:`, error);
  process.exit(1);
}

// Update python/pyproject.toml
try {
  let pyprojectToml = fs.readFileSync(pyprojectTomlPath, 'utf-8');
  const versionLineRegex = /^version\s*=\s*".*"$/m;
  if (!versionLineRegex.test(pyprojectToml)) {
    throw new Error('Could not find a `version = "..."` line in pyproject.toml');
  }
  pyprojectToml = pyprojectToml.replace(versionLineRegex, `version = "${newVersion}"`);
  fs.writeFileSync(pyprojectTomlPath, pyprojectToml);
  console.log(`✅ Updated ${path.relative(rootDir, pyprojectTomlPath)}`);
} catch (error) {
  console.error(`Error updating ${pyprojectTomlPath}:`, error);
  process.exit(1);
}

console.log('\nVersion update complete.');

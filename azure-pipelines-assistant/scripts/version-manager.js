#!/usr/bin/env node

/**
 * Version management script for Azure Pipelines Assistant
 * Handles version bumping, changelog generation, and release preparation
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Execute command with error handling
 */
function executeCommand(command, description, options = {}) {
  console.log(`\n🔧 ${description}...`);
  console.log(`Command: ${command}`);

  try {
    const output = execSync(command, {
      stdio: options.silent ? 'pipe' : 'inherit',
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      ...options
    });
    console.log(`✅ ${description} completed successfully`);
    return { success: true, output: output?.trim() };
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Read package.json
 */
function readPackageJson() {
  const packagePath = path.join(__dirname, '..', 'package.json');
  return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
}

/**
 * Write package.json
 */
function writePackageJson(packageData) {
  const packagePath = path.join(__dirname, '..', 'package.json');
  fs.writeFileSync(packagePath, JSON.stringify(packageData, null, 2) + '\n');
}

/**
 * Get current version
 */
function getCurrentVersion() {
  const packageJson = readPackageJson();
  return packageJson.version;
}

/**
 * Validate version format
 */
function validateVersion(version) {
  const versionRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+(\.\d+)?)?$/;
  return versionRegex.test(version);
}

/**
 * Parse version string
 */
function parseVersion(version) {
  const parts = version.split('-');
  const [major, minor, patch] = parts[0].split('.').map(Number);
  const prerelease = parts[1] || null;

  return { major, minor, patch, prerelease, full: version };
}

/**
 * Increment version
 */
function incrementVersion(currentVersion, type) {
  const { major, minor, patch, prerelease } = parseVersion(currentVersion);

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    case 'prerelease':
      if (prerelease) {
        const prereleaseMatch = prerelease.match(/^([a-zA-Z]+)\.?(\d+)?$/);
        if (prereleaseMatch) {
          const label = prereleaseMatch[1];
          const number = parseInt(prereleaseMatch[2] || '0') + 1;
          return `${major}.${minor}.${patch}-${label}.${number}`;
        }
      }
      return `${major}.${minor}.${patch}-alpha.1`;
    default:
      throw new Error(`Invalid version type: ${type}`);
  }
}

/**
 * Update version in package.json
 */
function updatePackageVersion(newVersion) {
  console.log(`\n📝 Updating package.json version to ${newVersion}...`);

  const packageJson = readPackageJson();
  const oldVersion = packageJson.version;

  packageJson.version = newVersion;
  writePackageJson(packageJson);

  console.log(`✅ Version updated: ${oldVersion} → ${newVersion}`);
  return true;
}

/**
 * Get git commits since last tag
 */
function getCommitsSinceLastTag() {
  try {
    // Get the last tag
    const lastTagResult = executeCommand('git describe --tags --abbrev=0', 'Getting last tag', { silent: true });
    const lastTag = lastTagResult.success ? lastTagResult.output : null;

    // Get commits since last tag
    const range = lastTag ? `${lastTag}..HEAD` : '';
    const commitsResult = executeCommand(
      `git log ${range} --pretty=format:"%h|%s|%an|%ad" --date=short`,
      'Getting commits since last tag',
      { silent: true }
    );

    if (!commitsResult.success) {
      return [];
    }

    return commitsResult.output.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [hash, subject, author, date] = line.split('|');
        return { hash, subject, author, date };
      });
  } catch (error) {
    console.warn('Could not get git commits:', error.message);
    return [];
  }
}

/**
 * Categorize commits
 */
function categorizeCommits(commits) {
  const categories = {
    features: [],
    fixes: [],
    improvements: [],
    docs: [],
    tests: [],
    chore: [],
    breaking: [],
    other: []
  };

  commits.forEach(commit => {
    const subject = commit.subject.toLowerCase();

    if (subject.includes('breaking') || subject.includes('!:')) {
      categories.breaking.push(commit);
    } else if (subject.startsWith('feat') || subject.includes('feature')) {
      categories.features.push(commit);
    } else if (subject.startsWith('fix') || subject.includes('bug')) {
      categories.fixes.push(commit);
    } else if (subject.startsWith('improve') || subject.includes('enhance')) {
      categories.improvements.push(commit);
    } else if (subject.startsWith('docs') || subject.includes('documentation')) {
      categories.docs.push(commit);
    } else if (subject.startsWith('test') || subject.includes('testing')) {
      categories.tests.push(commit);
    } else if (subject.startsWith('chore') || subject.startsWith('build') || subject.startsWith('ci')) {
      categories.chore.push(commit);
    } else {
      categories.other.push(commit);
    }
  });

  return categories;
}

/**
 * Generate changelog entry
 */
function generateChangelogEntry(version, commits) {
  const date = new Date().toISOString().split('T')[0];
  const categories = categorizeCommits(commits);

  let changelog = `## [${version}] - ${date}\n\n`;

  // Breaking changes
  if (categories.breaking.length > 0) {
    changelog += '### ⚠️ BREAKING CHANGES\n\n';
    categories.breaking.forEach(commit => {
      changelog += `- ${commit.subject} (${commit.hash})\n`;
    });
    changelog += '\n';
  }

  // Features
  if (categories.features.length > 0) {
    changelog += '### ✨ Features\n\n';
    categories.features.forEach(commit => {
      changelog += `- ${commit.subject} (${commit.hash})\n`;
    });
    changelog += '\n';
  }

  // Bug fixes
  if (categories.fixes.length > 0) {
    changelog += '### 🐛 Bug Fixes\n\n';
    categories.fixes.forEach(commit => {
      changelog += `- ${commit.subject} (${commit.hash})\n`;
    });
    changelog += '\n';
  }

  // Improvements
  if (categories.improvements.length > 0) {
    changelog += '### 🚀 Improvements\n\n';
    categories.improvements.forEach(commit => {
      changelog += `- ${commit.subject} (${commit.hash})\n`;
    });
    changelog += '\n';
  }

  // Documentation
  if (categories.docs.length > 0) {
    changelog += '### 📚 Documentation\n\n';
    categories.docs.forEach(commit => {
      changelog += `- ${commit.subject} (${commit.hash})\n`;
    });
    changelog += '\n';
  }

  // Tests
  if (categories.tests.length > 0) {
    changelog += '### 🧪 Tests\n\n';
    categories.tests.forEach(commit => {
      changelog += `- ${commit.subject} (${commit.hash})\n`;
    });
    changelog += '\n';
  }

  // Other changes
  if (categories.other.length > 0) {
    changelog += '### 🔧 Other Changes\n\n';
    categories.other.forEach(commit => {
      changelog += `- ${commit.subject} (${commit.hash})\n`;
    });
    changelog += '\n';
  }

  return changelog;
}

/**
 * Update changelog
 */
function updateChangelog(version, commits) {
  console.log(`\n📝 Updating CHANGELOG.md for version ${version}...`);

  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  const newEntry = generateChangelogEntry(version, commits);

  let existingChangelog = '';
  if (fs.existsSync(changelogPath)) {
    existingChangelog = fs.readFileSync(changelogPath, 'utf8');
  } else {
    existingChangelog = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n';
  }

  // Insert new entry after the header
  const lines = existingChangelog.split('\n');
  const headerEndIndex = lines.findIndex(line => line.startsWith('## '));

  if (headerEndIndex === -1) {
    // No existing entries, add after header
    const headerLines = lines.slice(0, 3);
    const newChangelog = [...headerLines, '', ...newEntry.split('\n'), ...lines.slice(3)].join('\n');
    fs.writeFileSync(changelogPath, newChangelog);
  } else {
    // Insert before first existing entry
    const beforeEntry = lines.slice(0, headerEndIndex);
    const afterEntry = lines.slice(headerEndIndex);
    const newChangelog = [...beforeEntry, ...newEntry.split('\n'), ...afterEntry].join('\n');
    fs.writeFileSync(changelogPath, newChangelog);
  }

  console.log(`✅ Changelog updated with ${commits.length} commits`);
  return true;
}

/**
 * Create git tag
 */
function createGitTag(version) {
  console.log(`\n🏷️  Creating git tag v${version}...`);

  const tagResult = executeCommand(
    `git tag -a v${version} -m "Release version ${version}"`,
    'Creating git tag'
  );

  return tagResult.success;
}

/**
 * Commit version changes
 */
function commitVersionChanges(version) {
  console.log(`\n💾 Committing version changes for ${version}...`);

  // Add changed files
  const addResult = executeCommand('git add package.json CHANGELOG.md', 'Adding version files');
  if (!addResult.success) return false;

  // Commit changes
  const commitResult = executeCommand(
    `git commit -m "chore: bump version to ${version}"`,
    'Committing version changes'
  );

  return commitResult.success;
}

/**
 * Show version information
 */
function showVersionInfo() {
  const currentVersion = getCurrentVersion();
  const commits = getCommitsSinceLastTag();

  console.log('\n📊 Version Information');
  console.log('='.repeat(50));
  console.log(`Current Version: ${currentVersion}`);
  console.log(`Commits since last tag: ${commits.length}`);

  if (commits.length > 0) {
    console.log('\nRecent commits:');
    commits.slice(0, 5).forEach(commit => {
      console.log(`  ${commit.hash} - ${commit.subject}`);
    });

    if (commits.length > 5) {
      console.log(`  ... and ${commits.length - 5} more`);
    }
  }

  // Show suggested version bumps
  console.log('\nSuggested version bumps:');
  console.log(`  Patch: ${incrementVersion(currentVersion, 'patch')}`);
  console.log(`  Minor: ${incrementVersion(currentVersion, 'minor')}`);
  console.log(`  Major: ${incrementVersion(currentVersion, 'major')}`);
  console.log(`  Prerelease: ${incrementVersion(currentVersion, 'prerelease')}`);
}

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);

  const options = {
    action: 'info',
    versionType: null,
    customVersion: null,
    skipChangelog: false,
    skipCommit: false,
    skipTag: false,
    dryRun: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case 'bump':
        options.action = 'bump';
        break;
      case 'info':
        options.action = 'info';
        break;
      case '--patch':
        options.versionType = 'patch';
        break;
      case '--minor':
        options.versionType = 'minor';
        break;
      case '--major':
        options.versionType = 'major';
        break;
      case '--prerelease':
        options.versionType = 'prerelease';
        break;
      case '--version':
        options.customVersion = args[++i];
        break;
      case '--skip-changelog':
        options.skipChangelog = true;
        break;
      case '--skip-commit':
        options.skipCommit = true;
        break;
      case '--skip-tag':
        options.skipTag = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
        showHelp();
        process.exit(0);
        break;
    }
  }

  return options;
}

/**
 * Show help information
 */
function showHelp() {
  console.log(`
🏷️  Azure Pipelines Assistant Version Manager

Usage: node scripts/version-manager.js [action] [options]

Actions:
  info                  Show current version information (default)
  bump                  Bump version and update changelog

Version Types:
  --patch               Increment patch version (x.x.X)
  --minor               Increment minor version (x.X.0)
  --major               Increment major version (X.0.0)
  --prerelease          Increment prerelease version (x.x.x-alpha.X)
  --version <version>   Set specific version

Options:
  --skip-changelog      Skip changelog generation
  --skip-commit         Skip git commit
  --skip-tag            Skip git tag creation
  --dry-run             Show what would be done without making changes

Examples:
  node scripts/version-manager.js info
  node scripts/version-manager.js bump --patch
  node scripts/version-manager.js bump --minor --skip-tag
  node scripts/version-manager.js bump --version 1.2.3
  node scripts/version-manager.js bump --major --dry-run
`);
}

/**
 * Main function
 */
async function main() {
  const options = parseArguments();

  console.log('🏷️  Azure Pipelines Assistant Version Manager');
  console.log(`Action: ${options.action}`);

  if (options.action === 'info') {
    showVersionInfo();
    return;
  }

  if (options.action === 'bump') {
    const currentVersion = getCurrentVersion();
    let newVersion;

    if (options.customVersion) {
      if (!validateVersion(options.customVersion)) {
        console.error(`❌ Invalid version format: ${options.customVersion}`);
        process.exit(1);
      }
      newVersion = options.customVersion;
    } else if (options.versionType) {
      newVersion = incrementVersion(currentVersion, options.versionType);
    } else {
      console.error('❌ Version type or custom version is required for bump action');
      console.log('Use --patch, --minor, --major, --prerelease, or --version <version>');
      process.exit(1);
    }

    console.log(`\n🚀 Bumping version: ${currentVersion} → ${newVersion}`);

    if (options.dryRun) {
      console.log('\n🔍 Dry run mode - no changes will be made');
      console.log(`Would update version to: ${newVersion}`);

      if (!options.skipChangelog) {
        const commits = getCommitsSinceLastTag();
        console.log(`Would update changelog with ${commits.length} commits`);
      }

      if (!options.skipCommit) {
        console.log('Would commit version changes');
      }

      if (!options.skipTag) {
        console.log(`Would create git tag: v${newVersion}`);
      }

      return;
    }

    try {
      // Update package.json
      updatePackageVersion(newVersion);

      // Update changelog
      if (!options.skipChangelog) {
        const commits = getCommitsSinceLastTag();
        updateChangelog(newVersion, commits);
      }

      // Commit changes
      if (!options.skipCommit) {
        const commitSuccess = commitVersionChanges(newVersion);
        if (!commitSuccess) {
          console.error('❌ Failed to commit version changes');
          process.exit(1);
        }
      }

      // Create git tag
      if (!options.skipTag) {
        const tagSuccess = createGitTag(newVersion);
        if (!tagSuccess) {
          console.error('❌ Failed to create git tag');
          process.exit(1);
        }
      }

      console.log(`\n🎉 Version bump completed successfully!`);
      console.log(`New version: ${newVersion}`);

      if (!options.skipCommit || !options.skipTag) {
        console.log('\n📝 Next steps:');
        if (!options.skipCommit) {
          console.log('- Push commits: git push origin main');
        }
        if (!options.skipTag) {
          console.log('- Push tags: git push origin --tags');
        }
        console.log('- Create release: npm run package:all');
      }

    } catch (error) {
      console.error('❌ Version bump failed:', error);
      process.exit(1);
    }
  }
}

// Handle unhandled errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

// Run the main function
main().catch(error => {
  console.error('❌ Version manager failed:', error);
  process.exit(1);
});
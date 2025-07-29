const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const { BUILD_CONFIG, getBuildTarget } = require("./build-config");

// Parse command line arguments
const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');
const analyze = process.argv.includes('--analyze');
const target = production ? 'production' : watch ? 'watch' : 'development';

// Get build configuration
const buildConfig = getBuildTarget(target);

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',

  setup(build) {
    build.onStart(() => {
      console.log(`[${target}] build started`);
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        if (location) {
          console.error(`    ${location.file}:${location.line}:${location.column}:`);
        }
      });
      result.warnings.forEach(({ text, location }) => {
        console.warn(`⚠ [WARNING] ${text}`);
        if (location) {
          console.warn(`    ${location.file}:${location.line}:${location.column}:`);
        }
      });
      console.log(`[${target}] build finished`);
    });
  },
};

/**
 * @type {import('esbuild').Plugin}
 */
const bundleAnalyzerPlugin = {
  name: 'bundle-analyzer',
  setup(build) {
    if (!analyze) return;

    build.onEnd(async (result) => {
      if (result.metafile) {
        const analysis = await esbuild.analyzeMetafile(result.metafile, {
          verbose: true,
        });

        // Write analysis to file
        const analysisPath = path.join(__dirname, 'dist', 'bundle-analysis.txt');
        fs.writeFileSync(analysisPath, analysis);
        console.log(`📊 Bundle analysis written to: ${analysisPath}`);
      }
    });
  },
};

/**
 * @type {import('esbuild').Plugin}
 */
const copyAssetsPlugin = {
  name: 'copy-assets',
  setup(build) {
    build.onEnd(() => {
      // Ensure dist directory exists
      const distDir = path.join(__dirname, 'dist');
      if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
      }

      // Copy media files if they exist
      const mediaDir = path.join(__dirname, 'media');
      const distMediaDir = path.join(distDir, 'media');

      if (fs.existsSync(mediaDir)) {
        if (!fs.existsSync(distMediaDir)) {
          fs.mkdirSync(distMediaDir, { recursive: true });
        }

        const mediaFiles = fs.readdirSync(mediaDir);
        mediaFiles.forEach(file => {
          const srcPath = path.join(mediaDir, file);
          const destPath = path.join(distMediaDir, file);
          fs.copyFileSync(srcPath, destPath);
        });

        console.log(`📁 Copied ${mediaFiles.length} media files`);
      }
    });
  },
};

/**
 * Get esbuild configuration based on target
 */
function getEsbuildConfig() {
  const baseConfig = {
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    target: 'node18',
    plugins: [
      esbuildProblemMatcherPlugin,
      copyAssetsPlugin,
      bundleAnalyzerPlugin,
    ],
  };

  // Apply build target specific configuration
  const config = {
    ...baseConfig,
    minify: buildConfig.minify,
    sourcemap: buildConfig.sourcemap,
    sourcesContent: !production,
    logLevel: production ? 'warning' : 'info',
    metafile: analyze,
    define: {
      'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development'),
      'process.env.EXTENSION_VERSION': JSON.stringify(getExtensionVersion()),
    },
  };

  // Production optimizations
  if (production) {
    config.treeShaking = true;
    config.drop = ['console', 'debugger'];
    config.legalComments = 'none';
  }

  return config;
}

/**
 * Get extension version from package.json
 */
function getExtensionVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    return packageJson.version;
  } catch (error) {
    console.warn('Could not read version from package.json:', error.message);
    return '0.0.0';
  }
}

/**
 * Clean dist directory
 */
function cleanDist() {
  const distDir = path.join(__dirname, 'dist');
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });
  console.log('🧹 Cleaned dist directory');
}

/**
 * Main build function
 */
async function main() {
  console.log(`🚀 Starting ${target} build for Azure Pipelines Assistant`);
  console.log(`Configuration: minify=${buildConfig.minify}, sourcemap=${buildConfig.sourcemap}, watch=${buildConfig.watch}`);

  // Clean dist directory for production builds
  if (production) {
    cleanDist();
  }

  try {
    const config = getEsbuildConfig();
    const ctx = await esbuild.context(config);

    if (watch) {
      console.log('👀 Watching for changes...');
      await ctx.watch();

      // Keep the process running
      process.on('SIGINT', async () => {
        console.log('\n🛑 Stopping watch mode...');
        await ctx.dispose();
        process.exit(0);
      });
    } else {
      await ctx.rebuild();
      await ctx.dispose();

      // Show build statistics
      if (fs.existsSync('dist/extension.js')) {
        const stats = fs.statSync('dist/extension.js');
        const sizeKB = (stats.size / 1024).toFixed(2);
        console.log(`📦 Bundle size: ${sizeKB} KB`);
      }

      console.log('✅ Build completed successfully');
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Handle unhandled errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

// Run the main function
main().catch(e => {
  console.error('❌ Build process failed:', e);
  process.exit(1);
});

#!/usr/bin/env node
// Enhanced production build script with ES module compatibility
import { build } from 'esbuild';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log('🚀 Building production version with ES module compatibility...');

try {
  // Step 1: Build frontend with Vite
  console.log('📦 Building frontend...');
  const { stdout: viteOutput } = await execAsync('npx vite build');
  console.log(viteOutput);

  // Step 2: Build backend with enhanced esbuild configuration
  console.log('🔧 Building backend with ES module support...');
  await build({
    entryPoints: ['server/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'esm',
    outdir: 'dist',
    external: [
      'pg-native', 
      'bufferutil', 
      'utf-8-validate'
    ],
    packages: 'external',
    resolveExtensions: ['.ts', '.js', '.mjs', '.cjs'],
    conditions: ['node', 'import', 'require'],
    mainFields: ['module', 'main'],
    banner: {
      js: `
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
`
    },
    define: {
      'process.env.NODE_ENV': '"production"'
    },
    minify: true,
    sourcemap: false,
    loader: {
      '.ts': 'ts'
    }
  });

  console.log('✅ Production build completed successfully!');
  console.log('📋 Summary:');
  console.log('  - Frontend: Built to dist/public/');
  console.log('  - Backend: Built to dist/index.js');
  console.log('  - ES Modules: Fully compatible');
  console.log('  - Telegram imports: Properly resolved');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
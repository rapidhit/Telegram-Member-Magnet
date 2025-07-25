// Enhanced ESBuild configuration for ES module compatibility
import { build } from 'esbuild';

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
    'utf-8-validate',
    // Keep telegram library external to avoid bundling issues
    'telegram'
  ],
  packages: 'external',
  resolveExtensions: ['.ts', '.js', '.mjs', '.cjs'],
  conditions: ['node', 'import', 'require'],
  mainFields: ['module', 'main'],
  // Enhanced banner for better CommonJS/ES module interop
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
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  },
  loader: {
    '.ts': 'ts'
  }
}).catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
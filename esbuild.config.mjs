import * as esbuild from 'esbuild';
import { mkdirSync, cpSync, existsSync } from 'fs';

const watch = process.argv.includes('--watch');

const ctx = await esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  minify: !watch,
});

if (watch) {
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log('Build complete.');
}

copyStaticAssets();

function copyStaticAssets() {
  const templatesSrc = 'src/ui/webview/templates';
  const templatesDest = 'dist/webview/templates';
  if (existsSync(templatesSrc)) {
    mkdirSync(templatesDest, { recursive: true });
    cpSync(templatesSrc, templatesDest, { recursive: true });
  }

  const scriptsSrc = 'src/ui/webview/scripts';
  const scriptsDest = 'dist/webview/scripts';
  if (existsSync(scriptsSrc)) {
    mkdirSync(scriptsDest, { recursive: true });
    cpSync(scriptsSrc, scriptsDest, { recursive: true });
  }

  console.log('Static assets copied');
}

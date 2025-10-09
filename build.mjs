import { build, context } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const isWatch = process.argv.includes('--watch');
const isProd = process.argv.includes('--prod');
const outdir = path.join(__dirname, 'dist');

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}
function copyDir(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else copyFile(srcPath, destPath);
  }
}
function clean() { fs.rmSync(outdir, { recursive: true, force: true }); }

async function run() {
  clean();
  const options = {
    entryPoints: [
      'src/content/index.ts',
      'src/panel/index.ts',
      'src/background/sw.ts'
    ],
    bundle: true,
    outdir,
    format: 'esm',
    sourcemap: !isProd,
    minify: isProd,
    target: ['chrome118'],
    logLevel: 'info'
  };
  if (isWatch) {
    const ctx = await context(options);
    await ctx.watch();
  } else {
    await build(options);
  }
  copyFile('manifest.json', path.join(outdir, 'manifest.json'));
  copyFile('src/content/styles.css', path.join(outdir, 'content/styles.css'));
  copyFile('src/panel/index.html', path.join(outdir, 'panel/index.html'));
  copyFile('src/panel/styles.css', path.join(outdir, 'panel/styles.css'));
  copyDir('public/icons', path.join(outdir, 'icons'));
  console.log('✔ Static files copied to dist/');
  if (isWatch) console.log('👀 Watching for changes...');
}
run().catch((e) => { console.error(e); process.exit(1); });

import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

await mkdir('lib', { recursive: true });
await build({
  entryPoints: ['src/index.ts'], outfile: 'lib/index.js',
  bundle: true, platform: 'node', format: 'esm', target: 'node22',
  packages: 'external', sourcemap: true,
});
const client = await build({
  entryPoints: ['src/client/index.tsx'], bundle: true, write: false,
  platform: 'browser', format: 'cjs', target: 'es2022', jsx: 'automatic',
  external: ['react', 'react/*', '@deepseek-ai/*'],
});
// dsh's browser module loader supplies shared React/services via require().
await writeFile('lib/client.js', `window.__ModuleLoader__.load({id:"dsh-model-gateway",factory:(require)=>{var module={exports:{}};var exports=module.exports;\n${client.outputFiles[0].text}\nreturn module.exports;}});\n`);
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--emitDeclarationOnly'], { stdio: 'inherit' });

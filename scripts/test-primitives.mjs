// Execute the real DSH atoms in Node tests. CSS modules become class maps;
// the desktop/browser acceptance exercises their actual styles.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
await mkdir('test-results', { recursive: true });
await build({ stdin: { contents: "export { Button, Input, Checkbox, Switch, Modal, Tag, StateDot, Menu, DisclosureRow, IconPlusOutlineRegular, IconTrashOutlineRegular, IconChevronDownOutlineRegular, IconEllipsisOutlineRegular, IconSettingsOutlineRegular, IconSlidersTwoOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'", resolveDir: process.cwd() }, outfile: 'test-results/primitives.cjs', bundle: true, format: 'cjs', platform: 'node', treeShaking: true,
  plugins: [{ name: 'host-ui', setup(build) {
    build.onResolve({ filter: /^[^./]/ }, args => args.path === '@deepseek-ai/dsh-client-ui-primitives' ? undefined : { path: args.path, external: true, sideEffects: false });
    build.onLoad({ filter: /\.css$/ }, async args => { const css = await readFile(args.path, 'utf8'); const classes = Object.fromEntries([...css.matchAll(/\.([A-Za-z_][\w-]*)/g)].map(m => [m[1], m[1]])); return { contents: `export default ${JSON.stringify(classes)}`, loader: 'js' }; });
  } }],
});
// The real barrel warms its syntax highlighter on a zero-delay timer. That
// browser optimization is irrelevant to atom tests and can outlive jsdom's
// teardown; remove only this generated test timer, never the shipped client.
const primitiveBundle = await readFile('test-results/primitives.cjs', 'utf8');
await writeFile('test-results/primitives.cjs', primitiveBundle.replace(/setTimeout\(\(\) => \{\s*highlighter\(\);\s*\}, 0\)\.unref\?\.\(\);/, ''));

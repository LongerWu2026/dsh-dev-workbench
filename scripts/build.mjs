import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const check = process.argv.includes('--check')
const common = { absWorkingDir: root, bundle: true, write: false, target: 'es2022', charset: 'utf8', legalComments: 'inline', logLevel: 'warning' }
const require = createRequire(import.meta.url)
// Bundle only the two SQL grammars; the complete parser package stays a devDependency.
const sqlGrammarPlugin = {name:'sql-grammars',setup(builder){builder.onResolve({filter:/^(node-sql-parser\/build\/(mysql|postgresql)\.js|big-integer)$/},args=>({path:require.resolve(args.path,{paths:[args.resolveDir]}),external:false}))}}
const host = await build({ ...common, plugins:[sqlGrammarPlugin], entryPoints: ['src/host.ts'], platform: 'node', format: 'esm', packages: 'external' })
const client = await build({ ...common, entryPoints: ['src/client.ts'], platform: 'browser', format: 'cjs', external: ['react', 'react/*'], jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment' })
const cli = await build({ ...common, entryPoints: ['src/cli/harness-linky.ts'], platform: 'node', format: 'esm', packages: 'external' })
const cliCode=cli.outputFiles[0].text
const banner = '/** Generated from TypeScript modules by scripts/build.mjs. Do not edit. */\n'
const hostCode = banner + host.outputFiles[0].text
const clientCode = banner + 'window.__ModuleLoader__.load({ id: ' + JSON.stringify(pkg.name) + ', factory(require) {\nconst module = { exports: {} }; const exports = module.exports;\n' + client.outputFiles[0].text + '\nreturn module.exports;\n} });\n'
if (check && (readFileSync(join(root,'index.js'),'utf8') !== hostCode || readFileSync(join(root,'client.js'),'utf8') !== clientCode)) throw new Error('构建产物与源码不一致，请先 pnpm build')
if(check&&readFileSync(join(root,'bin/harness-linky.mjs'),'utf8')!==cliCode)throw new Error('CLI 构建产物与源码不一致，请先 pnpm build')
if (!check) {
  mkdirSync(join(root,'bin'),{recursive:true})
  // Touching an unchanged Client artifact needlessly reloads the desktop panel.
  for (const [name, code] of [['index.js', hostCode], ['client.js', clientCode], ['bin/harness-linky.mjs',cliCode]]) {
    const path=join(root,name)
    let previous
    try { previous=readFileSync(path,'utf8') } catch {}
    if (previous!==code) writeFileSync(path,code)
  }
  chmodSync(join(root,'bin/harness-linky.mjs'),0o755)
}
console.log((check ? 'build --check' : 'build') + ': TypeScript modules -> Host ESM / Client factory; ' + hostCode.length + ' / ' + clientCode.length + ' bytes')

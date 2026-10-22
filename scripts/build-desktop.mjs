/**
 * Gathers what the desktop app carries: the built UI, the runner and file tool as single files,
 * the sample flows, and a Node to run them with. Then `tauri build` wraps it all.
 * Run through `npm run desktop:build`.
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'esbuild'

const root = join(import.meta.dirname, '..')
const tauri = join(root, 'src-tauri')
const resources = join(tauri, 'resources')
const binaries = join(tauri, 'binaries')
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit' })

rmSync(resources, { recursive: true, force: true })
mkdirSync(resources, { recursive: true })
mkdirSync(binaries, { recursive: true })

run('npx', ['vite', 'build'])
cpSync(join(root, 'dist'), join(resources, 'dist'), { recursive: true })

// Bundled packages still use require(), so give the ES module one.
const banner = { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" }
const bundle = (entry, outfile) =>
  build({ entryPoints: [entry], outfile: join(resources, outfile), bundle: true, platform: 'node', format: 'esm', target: 'node22', banner, logLevel: 'warning' })
await bundle(join(root, 'runner/server.ts'), 'runner.mjs')
await bundle(join(root, 'runner/mcp.ts'), 'mcp.mjs')
cpSync(join(root, 'skills'), join(resources, 'skills'), { recursive: true })
await bundle(join(root, 'node_modules/@modelcontextprotocol/server-filesystem/dist/index.js'), 'files-server.mjs')

// What a first launch puts in the person's folder. Same inputs the repo commits.
const seed = join(resources, 'seed')
cpSync(join(root, 'flows'), join(seed, 'flows'), { recursive: true })
mkdirSync(join(seed, 'workspace/northwind'), { recursive: true })
cpSync(join(root, 'workspace/brief.md'), join(seed, 'workspace/brief.md'))
for (const f of ['company.md', 'support-inbox.md']) cpSync(join(root, 'workspace/northwind', f), join(seed, 'workspace/northwind', f))

// Node for Apple silicon only: the one you have is both chips (about 214 MB), this is half that.
const triple = 'aarch64-apple-darwin'
const node = join(binaries, `node-${triple}`)
if (!existsSync(node)) {
  execFileSync('lipo', ['-thin', 'arm64', process.execPath, '-output', node])
  execFileSync('strip', ['-x', node], { stdio: 'ignore' })
  execFileSync('codesign', ['--force', '--sign', '-', node])
}
console.log('Desktop pieces ready in src-tauri/')

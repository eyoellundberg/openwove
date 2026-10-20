# Development

## Setup

Needs Node 22 or later ([`.nvmrc`](../.nvmrc) pins the version CI uses).

```sh
npm install
cp .env.example .env.local   # only for real runs
```

| Variable | Used by | Meaning |
|---|---|---|
| `ANTHROPIC_API_KEY` | Runner | Your Anthropic key. `ANTHROPIC_AUTH_TOKEN` works too. Without either, simulated runs still work. |
| `RUNNER_PORT` | Runner, Vite proxy | The runner's port. Defaults to 5189. |

`.env.local` is ignored by git. Only the runner reads it.

## Running it

| Command | Port | What |
|---|---|---|
| `npm run dev -- --port 5188` | 5188 | The app, with hot reload. |
| `npm run runner` | 5189 | The runner. Restarts when its files change. |
| `npm run site` | 5173, or the next free one | The website. |
| `npm run mcp` | stdio | The MCP server. Normally your agent starts it. |

To run a second copy alongside the first, for example from another worktree, set `RUNNER_PORT=5199` for both the runner and the app. [`.claude/launch.json`](../.claude/launch.json) has these set up for Claude Code's preview: `openwove`, `openwove-alt`, `runner-alt` and `site`.

## Before you commit

```sh
npx tsc -b && npm run lint && npm run build && npm run site:build
```

CI runs the same checks, plus `check-flow` on every file in `flows/`, on every pull request and on every push to `main`. See [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

After a UI change, look at it in the browser in light and dark mode and at phone width. Type checks don't catch layout.

## Code

- **The flow format** lives in [`src/lib/flow-file.ts`](../src/lib/flow-file.ts). Keep it free of app imports: the runner, MCP server and checker use it too. Its `.describe()` texts are what agents read, so write them for an agent.
- **Run logic** goes in [`src/lib/engine.ts`](../src/lib/engine.ts) as pure functions. The store in [`src/lib/store.ts`](../src/lib/store.ts) only wraps it.
- **Numbers** go in [`src/lib/constants.ts`](../src/lib/constants.ts), named and with a comment saying what they mean. No magic numbers in components.
- **Model prices** go in [`src/lib/models.ts`](../src/lib/models.ts). Anthropic prices are list prices (`listPrice: true`); others are examples and show with `~`.
- **The MCP server** must never write to stdout; it's the protocol.
- **Comments** say why, not what. Match the density of the file you're in.

## UI

- Build from the shadcn components in [`src/components/ui`](../src/components/ui) and the Tailwind scale.
- No arbitrary values like `w-[237px]`. Add a theme token in [`src/index.css`](../src/index.css), or a named constant.
- Status colors are tokens: `running`, `waiting`, `earned`, `failed`, each with a `-subtle` pair. Use them instead of palette colors.
- Geist is the only font. Headings are semibold with tight tracking.
- The website in `site/` imports from `@/` like the app does, so it uses the same components and tokens. Keep anything only the site needs in `site/`.

## Copy

Write from the person's side, plainly:

- "Waiting for you", not "Pending approvals".
- "Runs on your computer", not "Local-first execution environment".
- Error messages say what happened and what to do: "Add ANTHROPIC_API_KEY to .env.local and restart the runner."

## Common changes

**Add a model.** Add it to `MODELS` in `src/lib/models.ts` with its prices. Real runs only call Anthropic models.

**Add a tool icon.** Add it to `TOOLS` in [`src/lib/catalog.ts`](../src/lib/catalog.ts). It shows on cards and runs in simulated mode. Running it for real also needs the runner to connect it (see `runner/files-tool.ts` for how `files` does it, and `ACTING_TOOLS` there for which calls ask first), and its id in `RUNNABLE_TOOLS` in `catalog.ts` so the checker stops warning about it.

**Change the flow format.** Edit the schema, then update [flow-format.md](flow-format.md), the builder skill and the sample flows, and run `check-flow` on each sample. Agents read the schema's descriptions, so keep them accurate.

**Add a runner route.** Add it to `runner/server.ts`, the client in [`src/lib/runner-client.ts`](../src/lib/runner-client.ts), and [runner-api.md](runner-api.md). Shapes the runner and the app both use go in [`src/lib/runner-types.ts`](../src/lib/runner-types.ts), so neither side keeps its own copy.

## Git

- Commit straight to `main` and push once the pre-commit command above passes. No pull requests: nobody reviews them, and CI runs on every push to `main` anyway. Don't rewrite `main`'s history.
- Use a branch only for work you want to leave half done, and fast-forward it into `main` when it's ready.
- Keep commits focused, one change each, so they're easy to review and to revert.
- Commit messages: a subject in the imperative that says what changed for the person using it, under about 72 characters, e.g. "Ask what to do when a step fails". Add a body when the why isn't obvious.
- Never commit `.env.local`, `runs/`, `dist/`, `dist-site/`, or agent output in `workspace/`. `.gitignore` covers all of them.
- `workspace/` keeps only the sample flows' inputs: `brief.md`, `northwind/company.md` and `northwind/support-inbox.md`. A new sample's inputs need an exception in `.gitignore`.

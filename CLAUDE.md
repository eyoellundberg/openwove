# Agent Flow

A friendly place to see and tweak multi-agent flows. A person's own agent writes a flow file; the app shows it on a canvas (Set up), runs it, and shows a live timeline with cost and a "Waiting for you" tray (Live). Simulated runs are free playback; real runs go through the local runner.

## Commands

- `npm run dev -- --port 5188` — the app (5173 is often taken on this machine).
- `npm run runner` — the local runner on port 5189 (Vite proxies `/api` to it). Needs `ANTHROPIC_API_KEY` in `.env.local`.
- `npm run check-flow flows/<file>.json` — validate a flow file.
- `npm run mcp` — the MCP server a person's agent connects to (stdio; `.mcp.json` registers it for Claude Code here).
- `npx tsc -b`, `npm run lint`, `npm run build` — check before committing.

## Writing flows

When someone asks for multi-agent work, follow `skills/agentflow-builder/SKILL.md` and write the result to `flows/`. Real runs read and write only inside `workspace/`.

## Code

- `src/lib/flow-file.ts` is the flow format (zod), shared by the app, the runner and `scripts/check-flow.ts`. Keep it free of app imports.
- `src/lib/engine.ts` holds the run logic as pure functions; `src/lib/store.ts` (zustand) wraps it. Runner events arrive through `applyRunnerEvent`.
- `src/lib/models.ts` has model prices. Anthropic prices are list prices; others are marked as examples and show with "~".
- `runner/` is a small Node server: it runs stages, calls the Anthropic API, connects the `files` tool through the filesystem MCP server, and pauses at approvals.
- `runner/mcp.ts` is the MCP server agents use to save and open flows. It writes through `runner/flows.ts` and tells open apps via the runner's `/app-events`. It never runs flows or touches the API key. Keep stdout clean: it's the protocol.

## Style

- Build UI from the shadcn components in `src/components/ui` and the Tailwind scale. No arbitrary values like `w-[237px]`; add theme tokens in `src/index.css` and named constants in `src/lib/constants.ts` instead.
- Status colors are tokens: `running`, `waiting`, `earned`, `failed` (each with `-subtle`).
- Copy is plain and written from the user's side ("Waiting for you", not "Pending approvals").

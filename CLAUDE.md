# OpenWove

A friendly place to see and tweak multi-agent flows. A person's own agent writes a flow file; the app shows it on a canvas (Set up), runs it, and shows a live timeline with cost and a "Waiting for you" tray (Live). Simulated runs are free playback; real runs go through the local runner.

## Commands

- `npm run dev -- --port 5188` — the app (5173 is often taken on this machine).
- `npm run runner` — the local runner on port 5189 (Vite proxies `/api` to it). Needs `ANTHROPIC_API_KEY` in `.env.local`.
- `npm run check-flow flows/<file>.json` — validate a flow file.
- `npm run schemas` — rewrite `schemas/*.json` from the zod schemas (`flow-file.ts`, `run-report.ts`). Run it whenever either changes; CI checks it.
- `npm run mcp` — the MCP server a person's agent connects to (stdio; `.mcp.json` registers it for Claude Code here).
- `npm run desktop:build` — the Mac app (`src-tauri/`, Tauri; needs Rust). See `docs/development.md`.
- `npm run site:deploy` — publish the site to Cloudflare Pages (it also deploys from CI). Releasing the Mac app and using a domain are in `docs/deploy.md`.
- `npm run site` / `npm run site:build` — the marketing site in `site/` (React, built with the app's theme and shadcn components through `@/`; output in `dist-site/`).
- `npx tsc -b && npm run lint && npm run build && npm run site:build` — what CI checks (plus `check-flow` on every file in `flows/`); run it before committing.

## Docs

`docs/` explains the architecture, flow format, MCP server, runner API and development rules. When a change touches the flow format, a runner route, an MCP tool or a command, update the matching doc in the same commit.

## Writing flows

When someone asks for multi-agent work, follow `skills/openwove-builder/SKILL.md` and write the result to `flows/`. Real runs read and write only inside `workspace/`.

## Code

- `src/lib/flow-file.ts` is the flow format (zod), shared by the app, the runner and `scripts/check-flow.ts`. Keep it free of app imports.
- `src/lib/run-report.ts` is what a run came to, as structured data for reviewers (the MCP `get_run` tool and `GET /runs/:id/report`). It's built from a saved run's events; if you add an event, say how it shows up there.
- `src/lib/runner-types.ts` holds the shapes the runner sends and accepts (`/health`, `/status`, `/flows`, app events, `Resolution`), imported by both `runner/` and `src/lib/runner-client.ts`. Don't redeclare them on either side.
- `src/lib/engine.ts` holds the run logic as pure functions; `src/lib/store.ts` (zustand) wraps it. Runner events arrive through `applyRunnerEvent`.
- `src/lib/models.ts` has model prices. Anthropic prices are list prices; others are marked as examples and show with "~".
- `runner/` is a small Node server: it runs stages, calls the Anthropic API, connects the `files` tool through the filesystem MCP server, and pauses at approvals.
- `runner/mcp.ts` is the MCP server agents use to save and open flows. It writes through `runner/flows.ts` and tells open apps via the runner's `/app-events`. It never runs flows or touches the API key. Keep stdout clean: it's the protocol.

## Style

- Build UI from the shadcn components in `src/components/ui` and the Tailwind scale. No arbitrary values like `w-[237px]`; add theme tokens in `src/index.css` and named constants in `src/lib/constants.ts` instead.
- Icons are Hugeicons (`@hugeicons/react` + `@hugeicons/core-free-icons`), not Lucide.
- Status colors are tokens: `running`, `waiting`, `earned`, `failed` (each with `-subtle`).
- Copy is plain and written from the user's side ("Waiting for you", not "Pending approvals").

## Git

- Commit straight to `main` and push once the CI command above passes. No pull requests.
- Commit subjects are imperative and say what changed for the person, e.g. "Ask what to do when a step fails".
- Don't commit agent output in `workspace/` or saved runs in `runs/`; `.gitignore` covers them.

# Agent Flow

A friendly place to see and tweak a multi-agent flow that your own agent set up.

- **Set up**: a zoomable canvas (React Flow). Each card is one step: which agent, what it does, its prompt (••• → View and edit prompt), and whether it asks you before acting. Drag a card beside another to run them at the same time, or between two to give it its own stage.
- **Live**: a 30-minute timeline of what every agent is doing, a "Waiting for you" tray with Approve/Deny, and an approvals-per-run strip.
- **"Ask until it's earned it"**: a step asks every time until you approve it 3 times in a row, then asks less. This is where Decision Runtime would plug in: each Approve/Deny becomes feedback, and its PASS/HOLD replaces the simple counter in `src/lib/engine.ts` (`askChance`).

- **Cost**: every bar, agent and run shows what it cost. Real runs use the API's token counts and Anthropic list prices; simulated runs and non-Anthropic models are estimates, marked with "~".

## Run it

```sh
npm install
npm run dev -- --port 5188
```

That's enough for simulated runs. For real runs, start the local runner in a second terminal:

```sh
cp .env.example .env.local   # then add your ANTHROPIC_API_KEY
npm run runner
```

In the app, open **Flows → Lumen landing page**, switch to **Real run**, and press **Run flow**. Agents read and write only inside `workspace/`; the Writer asks before saving the page.

## Let your agent set up a flow

Ask Claude Code (or any coding agent) in this folder for multi-agent work, e.g. *"Set up a flow that turns workspace/brief.md into a landing page and a launch email."* It follows `skills/agentflow-builder/SKILL.md`, writes `flows/<name>.json`, and checks it with `npm run check-flow`. The flow then appears under **Flows**.

### Or connect your agent with MCP

Agent Flow is a view of how your agent set up your agents, so your agent can talk to it directly. `runner/mcp.ts` is an MCP server with a `set_up_flow` prompt and tools to read the guide, list, read, save and open flows. `save_flow` checks the flow, writes it to `flows/` and opens it in the app right away (the runner must be running). Press **Save changes** after tweaking it on the canvas, and your agent reads your version with `get_flow`.

- Claude Code in this folder picks it up from `.mcp.json`.
- Anywhere else: in the app, **Set up with your agent → Connect your agent** has a ready-to-copy command and MCP config with your folder's path.

Your API key stays in `.env.local` and is used only by the runner. The MCP server never sees it and doesn't run flows; you do that from the app.

What real runs support today: Anthropic models, and one tool (`files`, through the filesystem MCP server). Other providers and tools open on the canvas and run in simulated mode.

## Where things are

| Path | What it is |
|---|---|
| `src/lib/flow-file.ts` | The flow file format (zod), shared by the app, runner and checker. |
| `src/lib/engine.ts` | Run logic: stages, ticking time, approvals, cost, runner events. Pure functions. |
| `src/lib/models.ts` | Model prices and cost formatting. |
| `runner/` | Local runner: real Claude calls, the `files` MCP tool, approvals, event stream. |
| `runner/mcp.ts` | The MCP server your agent connects to (`npm run mcp`). |
| `skills/agentflow-builder/` | The skill an agent follows to write a flow file. |
| `flows/` | Flow files. `docs/user-test.md` is the five-person test script. |
| `src/lib/store.ts` | Zustand store wrapping the engine; the app's single source of state. |
| `src/lib/seed.ts` | The sample flow, its simulated playback, and timeline history. |
| `src/lib/constants.ts` | Every tuning number, named. |
| `src/components/setup/` | Canvas, step card node, prompt and setup dialogs. |
| `src/components/live/` | Timeline, task bars, waiting tray, runs strip. |
| `src/components/ui/` | shadcn/ui components (Radix, Nova preset). |

Styling uses Tailwind v4 with theme tokens in `src/index.css` (`running`, `waiting`, `earned`, `failed`, …). No arbitrary Tailwind values.

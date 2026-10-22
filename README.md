<p align="center">
  <img src="public/favicon.svg" width="56" height="56" alt="" />
</p>

<h1 align="center">OpenWove</h1>

<p align="center">
  See, tweak and run the multi-agent flows your own agent sets up.
</p>

---

You ask your coding agent (Claude Code, or anything that speaks MCP) for work that needs several agents. It writes a **flow**: which agents do what, in which order, and which steps ask you first. OpenWove shows that flow on a canvas, runs it on your computer with your own API key, and stops to ask you before anything important happens.

- **Set up.** A zoomable canvas where each card is one step: the agent, its task, its prompt, and whether it asks before acting. Drag a card beside another to run them at the same time.
- **Live.** A timeline of what every agent is doing, what it costs, and a **Waiting for you** tray where you approve or deny.
- **Ask until it's earned it.** A step asks every time until you've approved it three times in a row, then asks less. One deny and it asks every time again.
- **Cost.** Every bar, agent and run shows its cost. Real runs use the API's token counts and Anthropic list prices (cached input tokens count at the full input rate, so if anything the number is high); estimates are marked with `~`.

## Quick start

Needs Node 22 or later.

```sh
npm install
npm run dev -- --port 5188
```

Open <http://localhost:5188>. That's enough for **simulated runs**: free playback of made-up work, so you can try a flow before spending anything.

For **real runs**, add your Anthropic key and start the local runner in a second terminal:

```sh
cp .env.example .env.local   # then set ANTHROPIC_API_KEY
npm run runner
```

In the app, open **Flows → Lumen landing page**, switch to **Real run**, and press **Run flow**. Agents read and write only inside `workspace/`, and the Writer asks you before it saves the page.

## Let your agent set up flows

OpenWove comes with an MCP server, so your agent can save a flow and open it in the app for you.

- **Claude Code in this folder** picks it up from [`.mcp.json`](.mcp.json) automatically.
- **Anywhere else:** in the app, **Connect your agent** has a ready-to-copy command with your folder's path, or run:

  ```sh
  claude mcp add openwove -- /path/to/OpenWove/node_modules/.bin/tsx /path/to/OpenWove/runner/mcp.ts
  ```

Then ask for multi-agent work, for example *"Set up a flow that turns workspace/brief.md into a landing page and a launch email."* The flow opens on the canvas. Tweak it, press **Save changes**, and your agent reads your version next time. The MCP server never runs flows and never sees your key. See [docs/mcp.md](docs/mcp.md).

Without MCP, an agent can follow [`skills/openwove-builder/SKILL.md`](skills/openwove-builder/SKILL.md), write `flows/<name>.json` itself, and check it with `npm run check-flow`. The format is also published as a JSON Schema, [`schemas/flow.schema.json`](schemas/flow.schema.json), and a run's outcome as [`schemas/run-report.schema.json`](schemas/run-report.schema.json).

## What works today

| | Simulated runs | Real runs |
|---|---|---|
| Anthropic models | Yes | Yes |
| OpenAI and Google models | Yes | Not yet; they open on the canvas and run in simulated mode |
| Tools | Any, shown on the cards | `files` only: read and write inside `workspace/` |
| Approvals, failed-step choices, cost | Yes | Yes |
| Run history (**Usage**) | No | Yes, saved in `runs/` |

## Your data

- Everything runs on your computer. There's no account and no OpenWove server in between.
- Your API keys stay on your computer, in the Keychain in the Mac app or in `.env.local` from source, and only the runner uses them. Add them in **Settings → Models and keys**.
- The welcome screen's company, country and language are saved in your OpenWove folder and given to your agents as context.
- Agents can only reach `workspace/`. Runs are saved to `runs/`, and neither folder's contents are committed.

## Commands

| Command | What it does |
|---|---|
| `npm run dev -- --port 5188` | The app. Port 5173 is often taken, hence 5188. |
| `npm run runner` | The local runner on port 5189. The app reaches it through Vite's `/api` proxy. |
| `npm run mcp` | The MCP server your agent starts (stdio). |
| `npm run check-flow flows/<file>.json` | Check a flow file and list every problem. |
| `npm run schemas` | Rewrite `schemas/*.json` from the zod schemas. Run it after changing the flow format or the run report. |
| `npm run site` | The website in `site/`. `npm run site:build` builds it into `dist-site/`; `npm run site:deploy` publishes it. |
| `npm run desktop:build` | The Mac app (needs Rust). See [docs/deploy.md](docs/deploy.md) for releasing it. |
| `npx tsc -b && npm run lint && npm run build && npm run site:build` | What CI checks, before you commit. CI also checks every sample flow and that `schemas/` is current. |

## Documentation

| Doc | Read it to |
|---|---|
| [Architecture](docs/architecture.md) | Understand how the app, runner and MCP server fit together, and how a run works. |
| [Flow file format](docs/flow-format.md) | Write or check a flow by hand: every field and rule. |
| [MCP server](docs/mcp.md) | Connect an agent, and see the tools it gets. |
| [Runner API](docs/runner-api.md) | Work on the runner, or talk to it directly. |
| [Development](docs/development.md) | Set up, follow the code style, and get a change merged. |
| [User test script](docs/user-test.md) | Run the five-person usability test. |

## Project layout

| Path | What's there |
|---|---|
| `src/` | The app: React, Tailwind, shadcn/ui, React Flow, and a zustand store. |
| `src/lib/flow-file.ts` | The flow format (zod), shared by the app, runner, MCP server and checker. |
| `src/lib/engine.ts` | Run logic as pure functions: stages, time, approvals, cost, runner events. |
| `runner/` | The local runner, the MCP server, and saved-run storage. |
| `skills/openwove-builder/` | The instructions an agent follows to write a flow. |
| `flows/` | Flow files. Four samples: Lumen landing page, a pricing page, and two for Northwind Coffee. |
| `workspace/` | The only folder agents can read and write. Inputs for the samples are committed; outputs aren't. |
| `site/` | The website, sharing the app's theme and components. |
| `docs/` | The documentation above, including [deploying the site and releasing the app](docs/deploy.md). |

## Contributing and license

Issues and pull requests are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). Report security problems privately, as described in [SECURITY.md](SECURITY.md). OpenWove is released under the [MIT License](LICENSE).

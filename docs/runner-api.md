# Runner API

The runner ([`runner/server.ts`](../runner/server.ts)) is a small HTTP server on `localhost:5189`; set `RUNNER_PORT` to change it. The app reaches it at `/api/...`, which Vite proxies to the runner with the `/api` prefix removed.

It listens on `127.0.0.1` only and has no authentication, so don't expose its port.

Bodies are JSON. Errors come back as `{ "error": "A sentence you can show the person." }` with a 4xx or 5xx status.

## Health and status

| Method and path | Returns |
|---|---|
| `GET /health` | `{ providers: { anthropic, openai, google }, tools: ["files"], workspace }`. Each provider is `true` when you've added a key for it. Only Anthropic runs for real so far. |
| `GET /agent` | How to start the MCP server: `{ command, args, env, claudeCode }`. `claudeCode` is true when the `claude` command was found. |
| `POST /agent/claude-code` | Runs `claude mcp add --scope user openwove …` (replacing an older entry). Answers `{ ok: true }`, or an error saying what Claude Code refused. |
| `GET /profile`, `PUT /profile` | What the person told the welcome screen: `{ company, country, language }` (country is a two-letter code), or `null` before they have. Saved in `profile.json` and added to every agent's system prompt. |
| `PUT /keys/:provider`, `DELETE /keys/:provider` | Add or remove a key (`anthropic`, `openai`, `google`), body `{ key }`. Keys go in and never come out; `/health` only says whether one exists. In the Mac app they're kept in the Keychain (service `OpenWove`); run from source, in `.env.local`. |
| `GET /status` | `{ anthropic: { level, text, incident?, checkedAt } }`, from Anthropic's public status page. `level` is `ok`, `slow`, `down` or `unknown`. Cached for 30 seconds. |

## Schemas

| Method and path | Returns |
|---|---|
| `GET /schemas/:name` | A JSON Schema, `flow` or `run-report`, the same as the files in [`schemas/`](../schemas/). 404 with the known names otherwise. |

## Flows

| Method and path | Does |
|---|---|
| `GET /flows` | Lists `flows/` as `[{ file, name }]`. |
| `GET /flows/:file` | Returns one flow file. 404 if it isn't there. |
| `PUT /flows/:file` | Checks and saves a flow (the app's **Save changes**). 400 with every problem if it isn't valid. Returns `{ ok, file, warnings }`. |

## App events

| Method and path | Does |
|---|---|
| `GET /app-events` | An event stream for open app windows. Sends `{ type: "flow-saved", file, open }` when your agent saves a flow. |
| `POST /app-events` | `{ file, open? }`. Used by the MCP server after a save; forwards `flow-saved` to every open window. Returns `{ apps }`, the number of windows told. 400 without `file`. |

## Runs

| Method and path | Does |
|---|---|
| `POST /runs` | `{ flow, streaks? }` starts a real run. `streaks` maps step ids to approvals in a row. Returns `{ runId }`. 400 if there's no API key or the flow isn't valid. |
| `GET /runs` | Every run on this computer, newest first, with status, cost and per-step usage. This is what the **Usage** page shows. |
| `GET /runs/:id/report` | The run as structured data, following [`schemas/run-report.schema.json`](../schemas/run-report.schema.json): status, cost, what's waiting for you, and per step what it did, asked, touched and cost. Works while it's going and after. |
| `GET /runs/:id/events` | The run's event stream. See below. |
| `POST /runs/:id/decide` | `{ stepId, approve }` answers a step that's waiting for you. 409 if it isn't waiting anymore. |
| `POST /runs/:id/resolve` | `{ stepId, action }` answers a step that ran into trouble. `action` is `retry`, `skip` or `stop`; anything else is a 400. 409 if it isn't waiting anymore. |
| `POST /runs/:id/stop` | Stops the run. A step waiting for approval is denied, a step waiting after a problem is failed, and later steps are skipped. |

Run routes return 404 for a run this runner doesn't know, and 409 ("That run has ended") for one that has finished, whether in this runner or before a restart. `events` is the exception: it replays a finished run.

## Run events

`GET /runs/:id/events` is a [server-sent event](https://developer.mozilla.org/docs/Web/API/Server-sent_events) stream. It first replays what has already happened, then sends new events as they occur. The app also uses it to ask whether a run is still known (a 404 means it isn't; see `knowsRun` in [`src/lib/runner-client.ts`](../src/lib/runner-client.ts)).

Each event's `id` is its index in the run. On reconnect, the browser sends `Last-Event-ID` and gets only what it missed, so token counts and logs are never applied twice. A finished run's stream stays open on purpose, so the browser doesn't keep reconnecting.

| Event | Fields | Meaning |
|---|---|---|
| `step_started` | `stepId` | The step began. |
| `step_log` | `stepId`, `text` | A line for the timeline, e.g. a file it read or wrote. |
| `step_usage` | `stepId`, `inputTokens`, `outputTokens` | Tokens used by one API call. Add them up. |
| `step_output` | `stepId`, `text` | What the agent said it did, in full. Shown in the report's `summary`. |
| `step_action` | `stepId`, `tool`, `path?`, `ok` | One tool call, e.g. a file written. Shown in the report's `actions`. |
| `step_waiting` | `stepId`, `gateText` | Waiting for your approval. `gateText` reads after the agent's name. |
| `step_acted_alone` | `stepId` | Would have asked, but its earned trust let it go ahead. |
| `step_resumed` | `stepId` | Going again after an approval or a retry. |
| `step_problem` | `stepId`, `error`, `attempt` | Ran into trouble. Waiting for retry, skip or stop. |
| `step_done` | `stepId` | Finished. |
| `step_denied` | `stepId` | You said no. The run stops. |
| `step_failed` | `stepId`, `error` | Gave up. The run stops. |
| `step_skipped` | `stepId` | Didn't run, because an earlier step stopped the run or you chose skip. |
| `step_stopped` | `stepId` | Stopped mid-way, because you stopped the run or the runner shut down. |
| `run_done` | | Nothing more will happen. |

The event type lives in [`src/lib/engine.ts`](../src/lib/engine.ts) (`RunnerEvent`), and `applyRunnerEvent` is how the app applies each one. The other shapes above (`/health`, `/status`, `/flows`, app events, `action`) live in [`src/lib/runner-types.ts`](../src/lib/runner-types.ts), shared by the runner and the client.

## Saved runs

Every run is written to `runs/<id>.json` as it goes (a burst of events costs one write), as `{ id, startedAt, endedAt, interrupted?, flow, events }`. A run that was going when the runner stopped is closed out as interrupted the next time it starts. `runs/` is ignored by git.

Everything derived from a run comes from one place: `buildReport` in [`src/lib/run-report.ts`](../src/lib/run-report.ts) turns the events into the report, and the Usage page's `summarize` is a cut of that report. If you add an event, handle it there and it shows up in both.

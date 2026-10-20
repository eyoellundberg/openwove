# Flow file format

A flow is one JSON file in `flows/`. Your agent writes it, the canvas opens it, and the runner runs it. The source of truth is the zod schema in [`src/lib/flow-file.ts`](../src/lib/flow-file.ts); its field descriptions are also what agents see over MCP. This page explains it for people.

## Example

```json
{
  "version": 1,
  "name": "Lumen landing page",
  "request": "Make a simple landing page for Lumen from the brief, and let me OK it before anything is saved to the site.",
  "agents": [
    { "id": "researcher", "name": "Researcher", "provider": "anthropic", "model": "claude-haiku-5-5", "effort": "low", "tools": ["files"] },
    { "id": "writer", "name": "Writer", "provider": "anthropic", "model": "claude-sonnet-5-5", "effort": "medium", "tools": ["files"] }
  ],
  "steps": [
    {
      "id": "read-brief",
      "agent": "researcher",
      "task": "Read the brief",
      "stage": 0,
      "prompt": "Read brief.md. Write notes.md with who Lumen is for, its three strongest benefits, and words to use and avoid."
    },
    {
      "id": "write-page",
      "agent": "writer",
      "task": "Write the landing page",
      "stage": 1,
      "approval": "always",
      "asks": "wants to save the landing page to site/index.html",
      "prompt": "Using brief.md and notes.md, write site/index.html: one page with a headline, the three benefits, the price and one button."
    }
  ]
}
```

The full version is [`flows/landing-page.json`](../flows/landing-page.json).

## Flow

| Field | Type | Required | Meaning |
|---|---|---|---|
| `version` | `1` | Yes | The format version. Always `1` for now. |
| `name` | string | Yes | What you'll recognize the flow by. Shown in the sidebar and on the canvas. |
| `request` | string | No | What the person asked for, in their words. Defaults to `""`. |
| `agents` | Agent[] | Yes, at least one | Who does the work. |
| `steps` | Step[] | Yes, at least one | What gets done, and in which order. |

## Agent

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | id | Yes | Short id that steps refer to, e.g. `"writer"`. |
| `name` | string | Yes | Named by its job, e.g. `"Writer"`. |
| `provider` | `"anthropic"`, `"openai"`, `"google"` | Yes | Only `anthropic` runs for real today. Others run in simulated mode. |
| `model` | string | Yes | The provider's model id, e.g. `"claude-sonnet-5-5"`. |
| `effort` | `"low"`, `"medium"`, `"high"` | No | How hard the model thinks. Defaults to `"medium"`. |
| `tools` | string[] | No | Tool ids the agent uses, e.g. `["files"]`. Defaults to `[]`. |

## Step

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | id | Yes | Unique step id, e.g. `"draft-page"`. |
| `agent` | string | Yes | The `id` of the agent that does this step. |
| `task` | string | Yes | A short name for the card, e.g. `"Draft pricing page"`. |
| `prompt` | string | Yes | What the agent is told to do, in plain language: what to make, from what, and where to save it. Earlier steps' results are passed along automatically. |
| `stage` | integer ≥ 0 | Yes | Steps in the same stage run at the same time. A stage starts when every step in the stage before it is done. |
| `tools` | string[] | No | Replaces the agent's tools for this step. |
| `approval` | `"never"`, `"always"`, `"earned"` | No | When to ask you before acting. Defaults to `"never"`. |
| `asks` | string | No | How the request reads after the agent's name, e.g. `"wants to publish the page"`. Only for steps that ask. |

### Approval

- `"never"`: for steps that only read, or write drafts.
- `"always"`: asks every time before it changes anything.
- `"earned"`: asks every time until you've approved it 3 times in a row, then asks less. One deny and it asks every time again. See [architecture.md](architecture.md#ask-until-its-earned-it).

In a real run, a step that asks pauses before its first file write, edit or move. It can read freely before that.

### Tools

`files` is the only tool connected for real runs: read and write inside `workspace/`, with paths relative to it. Other tool ids (`google`, `notion`, `figma`, `slack`, …) show on the cards and work in simulated runs. In a real run, a step goes ahead without them and logs which ones it skipped.

## Rules

`parseFlow` lists every problem at once, so a flow can be fixed in one go. Besides the types above:

- An **id** uses lowercase letters, digits and dashes, starting with a letter or digit, like `"draft-page"`.
- Agent ids are unique, and step ids are unique.
- Every step's `agent` names an agent in the flow.
- `asks` only appears on steps whose `approval` isn't `"never"`.
- Stages count up from 0 without gaps: `0, 1, 2`, not `0, 2`.
- Unknown fields are rejected, so typos don't pass silently.

The checker also gives **notes** that don't block saving, for things that won't work the way the writer probably expects in a real run:

- An agent on a provider other than Anthropic, which only runs in simulated mode.
- A model OpenWove doesn't know, which has no cost and may fail.
- A known model listed under the wrong provider.
- Tools that won't connect, which real runs skip.

## Checking a flow

```sh
npm run check-flow flows/landing-page.json
```

```
flows/landing-page.json is valid: "Lumen landing page", 4 steps in 3 stages.
```

It exits non-zero with every problem listed if the flow isn't valid. Over MCP, `save_flow` runs the same check and saves nothing if it fails.

## Known models

Costs use the prices in [`src/lib/models.ts`](../src/lib/models.ts). Anthropic prices are list prices; others are examples and show with `~`.

| Model id | Provider | Runs for real |
|---|---|---|
| `claude-opus-5-5` | anthropic | Yes |
| `claude-sonnet-5-5` | anthropic | Yes |
| `claude-haiku-5-5` | anthropic | Yes |
| `gpt-6-sol` | openai | Simulated only |
| `gemini-3.8-flash` | google | Simulated only |

To add a model, add it to `MODELS` in `src/lib/models.ts`.

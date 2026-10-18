---
name: agentflow-builder
description: Turn a plain-language request for multi-agent work into an Agent Flow file (flows/<name>.json) that the Agent Flow app opens on its canvas and can run. Use when someone describes work for several agents, asks to "set up a flow", or wants agents to research, write, review or publish something in steps.
---

# Agent Flow builder

You write one JSON file. The person reviews it on the Agent Flow canvas, tweaks it, and presses Run. Don't run anything yourself.

## Steps

1. Read the request. If the work needs input files (a brief, data), check they exist in `workspace/`; if not, say what to put there.
2. Split the work into **stages**. Steps in the same stage run at the same time; a stage starts when every step in the stage before it is done. Two to five steps is typical. Don't invent work the person didn't ask for.
3. For each step, pick an agent and write its prompt (below).
4. Save it as `flows/<short-name>.json`.
5. Check it: `npm run check-flow flows/<short-name>.json`. Fix every problem it lists, and pass its notes (unknown models, tools that won't connect) on to the person.
6. Tell the person, in two or three sentences, what each stage does, which steps will ask before acting, and that it's under **Flows** in the app.

If the Agent Flow MCP tools are connected (`save_flow`, `get_flow`), use `save_flow` for steps 4 and 5: it checks the flow against the schema, saves it, opens it in the app, and returns the same notes. Before changing an existing flow, read it with `get_flow`; the person may have edited it on the canvas.

## The file

```json
{
  "version": 1,
  "name": "Lumen landing page",
  "request": "The person's request, in their words.",
  "agents": [
    { "id": "writer", "name": "Writer", "provider": "anthropic", "model": "claude-sonnet-5-5", "effort": "medium", "tools": ["files"] }
  ],
  "steps": [
    {
      "id": "write-page",
      "agent": "writer",
      "task": "Write the landing page",
      "stage": 0,
      "prompt": "What to do, in plain language.",
      "approval": "always",
      "asks": "wants to save the landing page to site/index.html"
    }
  ]
}
```

- `id`s: lowercase letters, digits and dashes. Step ids are unique.
- `stage`: counts up from 0 with no gaps.
- `tools` on a step overrides the agent's tools; leave it out to use the agent's.
- `asks`: how the approval request reads after the agent's name ("Writer wants to …").

## Agents and models

Name agents by their job (Researcher, Writer, Reviewer), not by model. Reuse an agent across steps when the job is the same.

| Work | Model | Effort |
|---|---|---|
| Reading, sorting, short summaries, checklists | `claude-haiku-5-5` | `low` |
| Writing, editing, most everyday steps | `claude-sonnet-5-5` | `medium` |
| Hard reasoning, tricky judgment, long documents | `claude-opus-5-5` | `medium` |

Only `provider: "anthropic"` runs for real today. Other providers (`openai`, `google`) open on the canvas but only run in simulated mode; use them only if the person asks.

## Tools

Only give a step the tools it needs.

- `files`: read and write files in the person's `workspace/` folder. This is the only tool connected for real runs today. Paths in prompts are relative to `workspace/` (write `site/index.html`, not `workspace/site/index.html`).
- Any other tool name (`notion`, `slack`, `github`, …) shows on the canvas but isn't connected yet; a real run skips it. Say so if the flow depends on one.

## Prompts

Write each prompt like a message to a capable colleague: what to produce, from which inputs, where to save it, and any limits (length, tone, facts to stick to). Name exact file paths. Don't restate the whole plan; each agent only needs its own job. Earlier stages' results are passed along automatically.

## Approvals

Set `approval` on any step whose action is hard to undo or reaches other people: publishing, sending, paying, deleting, changing live settings.

- `"always"`: always ask before acting.
- `"earned"`: ask every time until the person has approved it 3 times in a row, then ask less. Use for routine actions the person will repeat often.
- `"never"`: the default, for steps that only read or write drafts.

When unsure, pick `"always"`. The person can loosen it on the canvas.

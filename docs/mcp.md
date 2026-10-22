# MCP server

[`runner/mcp.ts`](../runner/mcp.ts) is an [MCP](https://modelcontextprotocol.io) server that lets your own agent set up flows in OpenWove. Your agent starts it over stdio; you don't run it yourself.

It can read the guide and list, read, save and open flows. It **can't** run flows, and it never sees your API key. You run flows from the app.

## Connect your agent

**Claude Code in this folder** connects automatically through [`.mcp.json`](../.mcp.json).

**In the Mac app:** open **Connect your agent** and press **Connect Claude Code**. The app runs `claude mcp add --scope user` for you, pointing at the Node and MCP server bundled inside the app and at your `~/OpenWove` folder, so it works from any folder. If you move the app, press the button again. Other agents take the JSON config shown there.

**Claude Code from source, anywhere else:**

```sh
claude mcp add openwove -- /path/to/OpenWove/node_modules/.bin/tsx /path/to/OpenWove/runner/mcp.ts
```

**Other agents** take a JSON config:

```json
{
  "mcpServers": {
    "openwove": {
      "command": "/path/to/OpenWove/node_modules/.bin/tsx",
      "args": ["/path/to/OpenWove/runner/mcp.ts"]
    }
  }
}
```

From source, **Connect your agent** shows both with your folder's real path filled in (the runner reports them on `GET /agent`).

## What your agent gets

| Name | Kind | What it does |
|---|---|---|
| `set_up_flow` | Prompt | Turns a request into a flow. Takes `request`, the work in your words, and comes with the guide. |
| `get_guide` | Tool, read-only | The flow format, how to pick agents and models, and when to ask before acting. Read it before the first save. |
| `list_flows` | Tool, read-only | The flows in `flows/`, by file and name. |
| `get_flow` | Tool, read-only | One flow as it is now, including changes you made on the canvas. Takes `file`. |
| `save_flow` | Tool | Checks a flow and saves it to `flows/`, then opens it in the app. Takes `flow`, and optionally `file` (defaults to the flow's name; an existing file of that name is replaced) and `open` (defaults to true). If the flow has a problem, nothing is saved and the agent gets the list to fix. |
| `open_flow` | Tool | Opens a saved flow in the app. Takes `file`. |

The guide is [`skills/openwove-builder/SKILL.md`](../skills/openwove-builder/SKILL.md) plus a short section on using these tools instead of the file and checker, and the absolute path of your `workspace/`. So an agent gets the same rules over MCP as from the file.

## Saving opens the flow in the app

After a save, the server asks the runner to tell every open app window (see [architecture.md](architecture.md#when-your-agent-saves-a-flow)). It answers your agent with which of these happened:

- **The app is showing it.** If you had unsaved changes or a run going, the app asked you first.
- **The app has it under Flows.** Your agent saved with `open: false`, so nothing changed on screen.
- **The app isn't open.** The flow is under **Flows** when you open it.
- **The runner isn't running.** The flow is saved, but the app couldn't be told. Start the runner with `npm run runner`.

## Your changes come back

When you tweak a flow on the canvas and press **Save changes**, the app writes it back to `flows/`. Next time your agent calls `get_flow`, it reads your version, so it can build on your edits instead of overwriting them.

## For contributors

- stdout is the protocol. Anything logged there breaks the connection; use stderr.
- The server writes through [`runner/flows.ts`](../runner/flows.ts), the same code the runner uses, so both check and name files the same way.

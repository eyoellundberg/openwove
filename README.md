# Agent Flow

A friendly place to see and tweak a multi-agent flow that your own agent set up.

- **Set up**: a zoomable canvas (React Flow). Each card is one step: which agent, what it does, its prompt (••• → View and edit prompt), and whether it asks you before acting. Drag a card beside another to run them at the same time, or between two to give it its own stage.
- **Live**: a 30-minute timeline of what every agent is doing, a "Waiting for you" tray with Approve/Deny, and an approvals-per-run strip.
- **"Ask until it's earned it"**: a step asks every time until you approve it 3 times in a row, then asks less. This is where Decision Runtime would plug in: each Approve/Deny becomes feedback, and its PASS/HOLD replaces the simple counter in `src/lib/engine.ts` (`askChance`).

Everything is simulated: no real agents run yet.

## Run it

```sh
npm install
npm run dev -- --port 5188
```

## Where things are

| Path | What it is |
|---|---|
| `src/lib/engine.ts` | The simulation: stages, ticking time, approvals, fast-forward. Pure functions. |
| `src/lib/store.ts` | Zustand store wrapping the engine; the app's single source of state. |
| `src/lib/seed.ts` | The example flow and timeline history. |
| `src/lib/constants.ts` | Every tuning number, named. |
| `src/components/setup/` | Canvas, step card node, prompt and setup dialogs. |
| `src/components/live/` | Timeline, task bars, waiting tray, runs strip. |
| `src/components/ui/` | shadcn/ui components (Radix, Nova preset). |

Styling uses Tailwind v4 with theme tokens in `src/index.css` (`running`, `waiting`, `earned`, `failed`, …). No arbitrary Tailwind values.

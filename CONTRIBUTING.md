# Contributing

Thanks for wanting to help. OpenWove is small, so most changes are quick to review.

## Run it

Needs Node 22 or later.

```sh
npm install
npm run dev -- --port 5188     # the app, with simulated runs
npm run runner                 # optional: the local runner, for real runs (needs ANTHROPIC_API_KEY in .env.local)
```

The Mac app (`src-tauri/`) also needs Rust. [docs/development.md](docs/development.md) covers it, the code layout and the rules below in more detail.

## Before you open a pull request

```sh
npx tsc -b && npm run lint && npm run build && npm run site:build
npm run schemas -- --check
for f in flows/*.json; do npm run -s check-flow "$f"; done
```

CI runs the same. If you change the flow format (`src/lib/flow-file.ts`) or the run report (`src/lib/run-report.ts`), run `npm run schemas` and commit the updated files in `schemas/`.

## What we care about

- **Plain words.** Copy is written from the person's side: "Waiting for you", not "Pending approvals". Error messages say what happened and what to do.
- **The design system.** Build UI from the shadcn components in `src/components/ui`, Hugeicons for icons, and the Tailwind scale. No arbitrary values like `w-[237px]`: add a theme token in `src/index.css` or a named constant in `src/lib/constants.ts`.
- **Docs move with code.** If a change touches the flow format, a runner route, an MCP tool or a command, update the matching page in `docs/` in the same pull request.
- **One copy of everything shared.** The flow format lives in `src/lib/flow-file.ts` and the runner's shapes in `src/lib/runner-types.ts`. Import them; don't redeclare them.
- **Privacy.** Keys stay on the person's computer, and agents only reach the `workspace/` folder. Please don't add anything that sends data elsewhere.

Commit subjects are imperative and say what changed for the person, for example "Ask what to do when a step fails". Don't commit anything from `workspace/` or `runs/`.

## Bugs and ideas

Open an issue with what you did, what you expected, and what happened. For a flow that misbehaves, attach the flow file (and the run report from the MCP `get_run` tool, if you have one). Remove any private information first.

## Security

Please report vulnerabilities privately; see [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contribution is licensed under the [MIT License](LICENSE).

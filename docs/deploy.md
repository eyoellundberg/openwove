# Deploying the website

The site in `site/` is a static build (`npm run site:build` → `dist-site/`), hosted on **Cloudflare Pages** as the project `openwove`. It's live at <https://openwove.pages.dev>. The Mac app's `.dmg` is hosted on GitHub Releases, and the site's Download button links to the newest release's `OpenWove-arm64.dmg`.

## Deploying

- **Automatically.** [`.github/workflows/deploy-site.yml`](../.github/workflows/deploy-site.yml) deploys on every push to `main` that changes the site, the app code it imports, `public/` or `wrangler.toml`. It needs two repository secrets (Settings › Secrets and variables › Actions): `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. Without the token it still builds the site, then warns instead of deploying, so the run stays green.
- **By hand.** `npm run site:deploy` (needs `npx wrangler login` once).

To make the token: Cloudflare dashboard › My Profile › API Tokens › Create Token › the **Edit Cloudflare Workers** template is more than needed; a custom token with **Account › Cloudflare Pages › Edit** is enough. Add it as the `CLOUDFLARE_API_TOKEN` secret.

## Using your own domain

1. Buy the domain (Cloudflare Registrar sells at cost and puts DNS in the same account, which makes the next step automatic).
2. Cloudflare dashboard › Workers & Pages › `openwove` › **Custom domains** › Set up a custom domain. Add the bare domain (`example.com`), and `www` if you want it. With the domain's DNS on Cloudflare it creates the records and the certificate for you.
3. Change `VITE_SITE_URL` in [`site/.env`](../site/.env) to the new address. It fills in the page's canonical link and social-card address.
4. In `site/src/facts.ts`, nothing changes: the download link points at GitHub Releases, not the domain.
5. Commit and push. The workflow deploys it.

Optionally, redirect `openwove.pages.dev` to the domain once it works (Pages › Settings, or a `_redirects` file).

## The share card

Links to the site show `site/og/og.png` (1200×630). It's drawn with [og-cards](https://github.com/eyoellundberg/og-cards) from the app's colors, which are in `site/og/theme.css` as hex (copied from `src/index.css`). To change it, edit the colors or the title, then from a checkout of og-cards:

```sh
npx tsx <og-cards>/src/cli.ts generate site/og/og-cards.json
cd site/og && npx tsx <og-cards>/src/cli.ts preview og-cards.json "Multi-agent work, where you can see it." "Free Mac app"
mv preview.png og.png   # then commit og.png, ground.png and card.json
```

The build copies `og.png` into the site (`vite.site.config.ts`), and `site/index.html` points at `VITE_SITE_URL/og.png`. Sites cache cards by URL, so after a change, check it with the platforms' card validators or add a `?v=` to the URL in `index.html`.

## Releasing the Mac app

1. Bump the version in `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and `package.json` (`npm version X.Y.Z --no-git-tag-version` does the last one and the lockfile), and `VERSION` in `site/src/facts.ts`.
2. `npm run desktop:build` (see [development.md](development.md#the-desktop-app)). The `.dmg` is in `src-tauri/target/release/bundle/dmg/`.
3. Check it: mount it, `codesign --verify --deep --strict` the app, and launch the copy. Then publish it with `gh release create vX.Y.Z`, uploading the `.dmg` renamed to **`OpenWove-arm64.dmg`** (the site's link relies on that name staying the same) and its `.sha256`.

The beta is ad-hoc signed with the hardened runtime **off** (`tauri.conf.json`). The runtime stops the bundled Node's JIT, so before notarizing with an Apple Developer ID, add an entitlements file allowing JIT and turn the runtime back on.

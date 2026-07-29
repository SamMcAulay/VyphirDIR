# Manual Setup Guide — Cloudflare Pages, Cloudinary, GitHub

This guide covers everything that requires a human logged into a dashboard.
No agent or script can create accounts, move DNS, or generate API secrets on
your behalf — this is that missing piece.

> **⚠️ WARNING — READ BEFORE DOING ANYTHING ELSE**
>
> **Do not merge this branch to `main` until Step 7 below is complete and
> verified — this branch already removes `.github/workflows/pages.yml`, so
> merging before Cloudflare Pages is live and building successfully will
> leave the site with no working deploy path.**
>
> In other words: `main` currently has no way to deploy the site once this
> branch is merged, until Cloudflare Pages is confirmed working. Follow the
> steps in order and do not skip ahead to Step 9.

---

## Before you start

You will need accounts with:

- **Cloudflare** (free tier is sufficient)
- **Cloudinary** (free tier is sufficient)
- **GitHub** (you already have this — you're using it to read this file)

Have the owner's email address ready (the one that should be allowed to log
into `/admin`) — this guide uses `sammcaulay1@gmail.com` as the example, but
substitute your own throughout.

---

## Step 1: Create a Cloudflare account and connect this repo as a Pages project

1. Go to <https://dash.cloudflare.com/sign-up> and create an account (or log
   in if you already have one).
2. In the left sidebar, go to **Workers & Pages**.
3. Click **Create application** → the **Pages** tab → **Connect to Git**.
   *(Labels may vary slightly if Cloudflare has updated their dashboard —
   look for "Connect to Git" or "Import an existing Git repository".)*
4. Authorize Cloudflare's GitHub App and select this repository
   (`vyphir.com` / the repo containing this file).
5. On the "Set up builds and deployments" screen, set:
   - **Production branch**: leave as-is for now (you will point this at
     `main` only after Step 9 — for the initial verification in Step 7 you
     will deploy from this branch instead; see that step for how).
   - **Framework preset**: `None`
   - **Build command**: `npm run build`
   - **Build output directory**: `.`
   (These match `wrangler.toml` in this repo, which sets
   `pages_build_output_dir = "."`.)
6. Click **Save and Deploy**. Cloudflare will attempt a first build — it may
   fail or produce an incomplete site at this point because the environment
   variables from Step 6 aren't configured yet. That's expected; you'll fix
   it before Step 7's real verification.

---

## Step 2: Move `vyphir.com` DNS to Cloudflare

1. In the Cloudflare dashboard, go to **Websites** (formerly the top-level
   overview) → **Add a site** → enter `vyphir.com`.
2. Choose the **Free** plan.
3. Cloudflare scans your existing DNS records and shows you an import
   preview. Review it and confirm the import.
4. Cloudflare gives you two **nameservers** (e.g. `xxx.ns.cloudflare.com` and
   `yyy.ns.cloudflare.com`). Go to your domain registrar (wherever
   `vyphir.com` is registered) and replace the existing nameservers with
   these two.
5. Wait for propagation (Cloudflare will email you and show an "Active"
   status on the site's overview page once the switch is detected — this can
   take anywhere from minutes to ~24 hours).
6. Once the zone is active, go to your Pages project → **Custom domains** →
   **Set up a custom domain** → enter `vyphir.com` (and `www.vyphir.com` if
   you use it). Cloudflare will create the necessary DNS records
   automatically inside its own zone.

**Do not remove the old GitHub Pages DNS records yet** — leave the old setup
in place until Step 9. If your registrar's records already point elsewhere
before propagation completes, GitHub Pages will simply keep serving the old
site in the meantime, which is safe.

---

## Step 3: Restrict `/admin/*` and `/api/*` with Cloudflare Access

This site's entire authentication model is Cloudflare Access sitting in
front of these two paths — there is no login form, no password, and no
OAuth flow in the application code itself. Access intercepts the request
before it reaches the Pages Function or static file and requires a one-time
PIN emailed to an approved address (or a magic link) before letting the
request through.

1. In the Cloudflare dashboard, go to **Zero Trust** (may also be labeled
   **Access** depending on your dashboard version) → **Access** →
   **Applications**.
2. Click **Add an application** → **Self-hosted**.
3. Configure:
   - **Application name**: `Vyphir Admin`
   - **Session duration**: your preference (e.g. `24 hours`)
   - **Application domain**: `vyphir.com`, **path**: `/admin`
     (this covers `/admin/*` since Access path matching is prefix-based)
4. Click **Add another path** (or create a second application) and add a
   second domain/path rule for `vyphir.com` with path `/api` to also cover
   `/api/*`. Either two rules on one application, or two separate
   applications pointed at `/admin` and `/api`, both work — the requirement
   is that both prefixes are protected.
5. Under **Policies**, click **Add a policy**:
   - **Policy name**: `Owner only`
   - **Action**: `Allow`
   - **Session duration**: same as above
   - **Include** rule: **Emails** → enter your own email address (e.g.
     `sammcaulay1@gmail.com`)
6. Under **Login methods** (in your Zero Trust account settings, not the
   per-app config), make sure **One-time PIN** is enabled. This is the
   default and requires no setup — Cloudflare emails a 6-digit code to the
   address on each login attempt. You do not need to configure Google/GitHub
   OAuth or any identity provider; one-time PIN is sufficient and is what
   this project assumes.
7. Save the application.

After this, visiting `https://vyphir.com/admin` or any `/api/*` endpoint will
show a Cloudflare-hosted login page prompting for your email, then a PIN
sent to that inbox, before the real page or Function loads.

---

## Step 4: Create a Cloudinary account for signed image uploads

1. Go to <https://cloudinary.com/users/register/free> and create an account.
2. Once logged in, the **Dashboard** (home screen after login) shows your
   **Cloud Name**, **API Key**, and **API Secret** near the top under
   "Product Environment Credentials" / "API Keys".
   *(Labels may vary slightly if Cloudinary has updated their dashboard —
   look for a "Cloud name" field and an "API Keys" or "Access Keys"
   section.)*
3. Note down:
   - **Cloud Name** — a short slug, e.g. `dxxxxxxxx` or a custom name if you
     set one.
   - **API Key** — a numeric string.
   - **API Secret** — click "reveal"/the eye icon to see it. Treat this like
     a password.
4. **Do not create an unsigned upload preset.** This project's Cloudflare
   Pages Functions (`functions/api/_shared/cloudinary.js`) generate the
   upload signature themselves server-side using the API secret (SHA-1 over
   `folder`, `public_id`, and `timestamp`, per Cloudinary's signed-upload
   spec) — the admin UI never talks to Cloudinary directly and never needs
   an unsigned preset. If an unsigned preset exists on your account it isn't
   used by this code and isn't a substitute for the values above; you can
   leave your account's preset settings at their defaults.

You will enter the Cloud Name, API Key, and API Secret as Cloudflare Pages
secrets in Step 6.

---

## Step 5: Create a fine-grained GitHub Personal Access Token

The publish Functions commit content changes (`data/characters.json`,
`data/commissions.json`) back to this repository via the GitHub Contents
API, authenticated with a PAT you create here.

1. Go to
   <https://github.com/settings/personal-access-tokens/new>
   (GitHub → your avatar → **Settings** → **Developer settings** →
   **Personal access tokens** → **Fine-grained tokens** → **Generate new
   token**).
2. Configure:
   - **Token name**: `vyphir-pages-content-publish` (or any descriptive
     name)
   - **Expiration**: pick a concrete date (e.g. 90 days or 1 year — GitHub
     requires fine-grained tokens to expire; note the date somewhere so you
     remember to rotate it before it lapses, since an expired token will
     make the admin UI's "Publish" button fail with an authentication
     error).
   - **Repository access**: **Only select repositories** → choose this
     repository specifically. Do **not** choose "All repositories".
3. Under **Permissions** → **Repository permissions**, set:
   - **Contents**: **Read and write**
   - Leave **every other permission** at its default (`No access`). This
     token does not need Issues, Pull requests, Actions, Metadata write, or
     any other scope — only Contents read/write, because that's the only
     GitHub API surface `functions/api/_shared/github.js` calls
     (`GET /repos/{owner}/{repo}/contents/{path}` and
     `PUT /repos/{owner}/{repo}/contents/{path}`).
4. Click **Generate token** and copy the value immediately (it starts with
   `github_pat_`) — GitHub will not show it again. Store it somewhere safe
   until Step 6.

---

## Step 6: Add environment variables as encrypted secrets on the Cloudflare Pages project

These exact names were verified against the actual Function code
(`functions/api/publish-character.js` and
`functions/api/publish-commissions.js`, both of which read from `env`) —
they must match exactly, with no typos, extra spaces, or different casing:

| Variable name            | Value                                          |
|---------------------------|------------------------------------------------|
| `GITHUB_TOKEN`             | The fine-grained PAT from Step 5 (`github_pat_...`) |
| `GITHUB_OWNER`             | Your GitHub username or org (the repo owner)   |
| `GITHUB_REPO`              | This repository's name (without the owner prefix) |
| `GITHUB_BRANCH`            | `main` (the branch the Functions commit to — must be a real, existing branch; the code defaults to `main` if unset, but set it explicitly) |
| `CLOUDINARY_CLOUD_NAME`    | The Cloud Name from Step 4                     |
| `CLOUDINARY_API_KEY`       | The API Key from Step 4                        |
| `CLOUDINARY_API_SECRET`    | The API Secret from Step 4                     |

To add them:

1. In the Cloudflare dashboard, go to your Pages project (**Workers & Pages**
   → the project you created in Step 1).
2. Go to **Settings** → **Environment variables**.
3. For **Production** (and repeat for **Preview** if you want admin
   publishing to also work on preview deployments — recommended, since
   Step 7's initial verification deploy will run under the Preview
   environment when deploying from a non-production branch), click **Add
   variable** for each of the 7 names above.
4. For every one of these 7 variables, click the **Encrypt** button/toggle
   next to the value (sometimes shown as a padlock icon) before saving. All
   seven are secrets — none of them should be left as plaintext "Variable"
   type, only "Secret"/encrypted type. This applies especially to
   `GITHUB_TOKEN` and `CLOUDINARY_API_SECRET`, but do it for all seven for
   consistency and because `GITHUB_OWNER`/`GITHUB_REPO`/`GITHUB_BRANCH`
   still reveal internal configuration if left in plaintext logs.
5. Click **Save**. Cloudflare will prompt you to redeploy for the new
   variables to take effect — allow it, or trigger a new deployment manually
   from the project's **Deployments** tab.

---

## Step 7: Trigger the first deploy from THIS branch and verify

Do this before merging anything to `main`.

1. In the Pages project, go to the **Deployments** tab.
2. Find the option to deploy a specific branch (either it auto-deploys every
   pushed branch as a **Preview** deployment, or use **Create deployment** /
   **Retry deployment** and select this branch, `worktree-dynamic-content-cms`
   — or whatever branch name this work is pushed under — explicitly). If
   Cloudflare hasn't already built a preview for this branch, push the
   branch to GitHub first (`git push origin <branch-name>`) so Cloudflare's
   GitHub integration picks it up.
3. Wait for the build to finish. Check the build log — it should show
   `npm run build` running `node scripts/generate-characters.js`
   successfully with exit code 0.
4. Open the **Preview URL** Cloudflare gives you (a `*.pages.dev` address)
   and verify, in order:
   - The **homepage** (`/`) loads with no console errors and the gallery
     list renders.
   - A **character page**, e.g. `/gallery/drasil/`, loads and shows that
     character's images/bio (adjust the slug to whatever exists in
     `data/characters.json` at deploy time).
   - `/commissions` loads and renders the commissions info (status, tiers,
     past work) from `data/commissions.json`.
5. If any of these fail, check the Function logs (**Deployments** → the
   deployment → **Functions** tab, or **Real-time Logs**) and re-check the
   Step 6 environment variables for typos before proceeding.

Do not move on to Step 9 until all three checks above pass.

---

## Step 8: Log into `/admin` and publish one test character end-to-end

1. Visit `https://<your-preview-url>.pages.dev/admin` (or `vyphir.com/admin`
   if DNS/custom domain is already active).
2. You should be redirected to a Cloudflare Access login page. Enter your
   email (the one allow-listed in Step 3), then check that inbox for the
   one-time PIN email and enter the code.
3. Once through Access and the admin UI loads, use the character form to
   publish a small test character (a throwaway name, one test image is
   enough).
4. Click **Publish** and confirm the confirmation step, then wait for
   success.
5. Verify the result:
   - The publish call succeeded (no inline error shown in the admin UI).
   - `data/characters.json` in the GitHub repo now has a new commit (check
     the repo's commit history) adding your test character, authored via the
     GitHub API using the PAT from Step 5.
   - The uploaded image appears in your Cloudinary Media Library under the
     `vyphir/characters` folder.
   - After the next build/deploy picks up the updated `data/characters.json`
     (Cloudflare Pages redeploys automatically on a new commit to the
     watched branch), the new character's page is live, e.g.
     `/gallery/<test-slug>/`.
6. Clean up: delete the test character's entry from `data/characters.json`
   (via a normal commit, or via the admin UI's delete/edit path if one
   exists) and its test image from Cloudinary, so it doesn't linger on the
   live site.

If publishing fails, check the Function's error response in the admin UI
(shown inline) — most first-time failures are a mismatched or expired
`GITHUB_TOKEN`, a `GITHUB_OWNER`/`GITHUB_REPO` typo, or the Cloudinary
credentials being swapped/mistyped in Step 6.

---

## Step 9: Merge to `main` and remove GitHub Pages

Only after Steps 7 and 8 both pass:

1. Merge this branch into `main` (via a pull request, following your normal
   process).
2. In the Cloudflare Pages project **Settings** → **Builds & deployments**,
   set the **Production branch** to `main` if it isn't already, so future
   merges to `main` auto-deploy to production.
3. Confirm the production deployment (triggered by the merge) builds
   successfully and re-run the Step 7 checks (homepage, a character page,
   `/commissions`) against the real `vyphir.com` domain.
4. Remove GitHub Pages as a fallback:
   - In this repository's **Settings** → **Pages**, set the source back to
     "None" / disable GitHub Pages (there is no `.github/workflows/pages.yml`
     left in this branch to rebuild it, so this mainly just turns off
     serving the last-built static content).
   - In Cloudflare's DNS settings for the `vyphir.com` zone, remove any
     leftover CNAME/A records that were pointing at GitHub Pages
     (`<username>.github.io` or GitHub Pages' IP addresses) if they weren't
     already replaced by the custom domain setup in Step 2.
5. Double-check `vyphir.com` (not just the `*.pages.dev` preview URL) loads
   correctly one more time now that it's the production domain.

At this point Cloudflare Pages is the sole deploy path for the site, and
GitHub Pages is fully decommissioned.

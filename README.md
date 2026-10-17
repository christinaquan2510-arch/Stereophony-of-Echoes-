# 古今回响 · Stereophony of Echoes

A roundtable where AI echoes of Virginia Woolf, Plato, 苏轼, Sigmund Freud, Leonardo da Vinci, Albert Einstein and Emily Dickinson answer a visitor's questions in their own voices, hosted by Roland Barthes. Powered by Kimi.

## What's in this folder

| Path | What it is |
|---|---|
| `index.html` | The page visitors see |
| `api/table.js` | The server function: holds the Kimi key, builds the prompt, streams the reply |
| `api/_prompts.js` | The cards and rules, packaged for the server (generated; don't edit by hand) |
| `prompts/` | The founding principle, table rules, host card and guest cards, as Markdown |
| `scripts/build-prompts.mjs` | Rebuilds `api/_prompts.js` after you edit anything in `prompts/` |

## Deploy (about 20 minutes)

### 1. Kimi API key
1. Sign in at **platform.moonshot.cn** (mainland account) or **platform.moonshot.ai** (international account).
2. Top up a small amount (e.g. ¥30–50 or US$5). This balance is also your spending cap: if the key ever leaks, the most anyone can use is what's in the account.
3. Create an API key and copy it somewhere safe. It is shown only once. **Never paste it into any file or chat.**
4. In the console, check the list of model names, and note whether `kimi-k2.6` is there.

### 2. Put the code on GitHub
1. Create a free account at github.com.
2. New repository → name it e.g. `gujin-huixiang` → **Private** → Create.
3. "uploading an existing file" → drag in **everything inside** this folder (including the `api`, `prompts` and `scripts` folders) → Commit.

### 3. Deploy on Vercel
1. Create a free account at vercel.com and sign in with GitHub.
2. **Add New → Project** → import `gujin-huixiang`.
3. Before clicking Deploy, open **Environment Variables** and add:

| Name | Value |
|---|---|
| `MOONSHOT_API_KEY` | your Kimi key |
| `ACCESS_CODE` | a code you choose, e.g. `echoes2026` (only people with it can use the table) |
| `MOONSHOT_BASE_URL` | only if you have an **international** account: `https://api.moonshot.ai/v1` (leave it out for platform.moonshot.cn) |
| `MOONSHOT_MODEL` | only if `kimi-k2.6` isn't in your console's model list: the model name you want |

4. Click **Deploy**. You get a link like `https://gujin-huixiang.vercel.app`.

### 4. Test
- Open `https://<your-link>/?code=<your access code>`. The code is remembered for that browser tab.
- Ask a question, then use **Reply** to continue.
- **Ask someone in mainland China to open the link.** `*.vercel.app` addresses are sometimes blocked there. If it doesn't load for them, a custom domain (around US$10/year, added in Vercel → Settings → Domains) usually helps; send the video and case study as well either way.

## Changing a card
Edit the file in `prompts/`, run `node scripts/build-prompts.mjs` (or ask Claude to), and upload the changed files to GitHub. Vercel redeploys automatically.

## Privacy and safety
- Nothing the visitor writes is stored. The server never logs messages, only error codes.
- The Kimi key stays on the server and is never sent to the browser.
- Table Rules §0 (never romanticise death; step out of the play for a visitor in danger) applies to every figure. If the model returns nothing, the page shows a fixed supportive message instead of a blank table.

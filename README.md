# Proposal Strategist Agent

An AI agent that turns an RFP into a win strategy. Sales teams upload an RFP in a web app (or run it from the command line) and get back, in a few minutes:

| Step | What it produces |
|---|---|
| 1. Opportunity analysis | Requirements, evaluation weighting, buyer language, competitor read, open questions |
| 2. Win theme matrix | 3-5 buyer-specific win themes plus competitive positioning |
| 3. Executive summary | One-page summary in the five-part structure |
| 4. Proposal architecture | Three-act narrative flow, theme integration map, compliance checklist, pricing narrative |
| 5. Red-team review | Scorecard, top 5 fixes, and the evidence the team still needs to gather |

The agent's personality, rules and deliverable formats live in `prompts/system.md`. Edit that file to change how it behaves.

## Quick start (web app)

```bash
npm install
npm run build                 # builds the React UI into web/dist
cp .env.example .env          # then add your GEMINI_API_KEY
npm start                     # http://localhost:3001
```

Want to click around without an API key? Run `MOCK_AI=1 npm start` and the agent returns placeholder text.

For development with hot reload, run `npm run dev` (API on :3001, UI on :5173).

### Using it

1. **Company profile** (sidebar, set up once): paste your real case studies, metrics, differentiators and team credentials. The agent may only cite evidence found here. Anything missing becomes a highlighted `[INSERT: ...]` placeholder, so it never invents proof points.
2. **New proposal**: enter the buyer name, upload the RFP (PDF, Word, .txt or .md) or paste its text, choose the saved profile, and click *Build win strategy*.
3. Watch the five steps finish, read each output in its tab, copy sections, or download everything as one markdown file.
4. Past proposals stay in the sidebar and survive restarts.

Scanned PDFs without selectable text can't be read; paste the text instead.

## Configuration (`.env`)

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Required (unless `MOCK_AI=1`) |
| `ACCESS_TOKEN` | Optional shared token the team enters in the UI. **Set this before exposing the app beyond your own machine**, because every proposal costs API usage |
| `MODEL` | Model override (default `gemini-2.5-flash`) |
| `PORT` | Server port (default 3001) |
| `DATA_DIR` | Where jobs and the company profile are stored (default `./data`) |

## Command line

```bash
node agent.js --rfp rfp.md --buyer "Buyer Name" --company company.md
npm run dry-run               # print the prompts, no API call
npm run demo                  # full run on the bundled sample RFP
```

## Project layout

```
agent.js              CLI
core/pipeline.js      the five-step pipeline (shared by CLI and server)
prompts/system.md     the Proposal Strategist spec
server/               Express API: uploads, text extraction, jobs, storage
web/                  React UI (Vite)
samples/              sample RFP and company profile
```

## Notes

- Jobs and the company profile are stored as files under `data/`. `server/store.js` is the only module that touches storage, so moving to MongoDB later means rewriting that one file.
- Jobs run inside the server process. A restart during a run leaves that proposal unfinished; start it again.
- Treat the output as a strategic first draft. Every highlighted placeholder is evidence a person must supply before the proposal goes out.
=======
# Proposal-Strategist-Agent
Strategic proposal architect who transforms RFPs and sales opportunities into compelling win narratives. Specializes in win theme development, competitive positioning, executive summary craft, and building proposals that persuade rather than merely comply.

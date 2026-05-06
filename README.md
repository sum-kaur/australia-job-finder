# Australia-Job-Finder

> AI-powered job search pipeline built specifically for the Australian tech market.

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org)
[![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=flat&logo=playwright&logoColor=white)](https://playwright.dev)
[![Claude Code](https://img.shields.io/badge/Claude_Code-000?style=flat&logo=anthropic&logoColor=white)](https://claude.ai/code)
[![Gemini CLI](https://img.shields.io/badge/Gemini_CLI-4285F4?style=flat&logo=google&logoColor=white)](https://github.com/google-gemini/gemini-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## What is this?

Australia-Job-Finder turns any AI coding CLI into a job search pipeline tailored to the Australian tech market.

Paste a job URL. It scores fit against your CV, generates a tailored PDF, fills application forms, and tracks everything — without touching a spreadsheet.

Built by an AI Engineer based in Sydney who got tired of manually filtering hundreds of global job boards for AU-relevant roles.

Inspired by [career-ops](https://github.com/santifer/career-ops) — a job search automation tool originally built for the US/EU market. This project extends that foundation specifically for the Australian tech market: AU company ATS configurations, AU job board queries, location filtering to strip offshore roles, and AU salary benchmarks.

> **Not spray-and-pray.** The system scores every role 0–5 and recommends skipping anything below 4.0. Quality applications only.

---

## What makes this AU-specific

Most job search tools are US/EU-centric. This one is built around the Australian market:

- **30+ AU companies** pre-configured with verified ATS APIs — Culture Amp, Canva, Atlassian, Airwallex, Xero, REA Group, Seek, Afterpay/Block, Employment Hero, Deputy, Plenti, Buildkite, Linktree, Brighte, Zip Co, MYOB, Dovetail, Octopus Deploy, SafetyCulture, and more
- **AU job board search queries** — Seek, LinkedIn AU, Indeed AU, Ethical Jobs, Jora, Wellfound
- **Location filter** — strips India/US/UK/Singapore offshore roles from global boards so only AU results reach your pipeline
- **Workday support** — scans Telstra and CBA directly via Workday API (not just Greenhouse/Lever)
- **AU salary benchmarks** — comp research calibrated to Sydney/Melbourne market rates

---

## Features

| Feature | Description |
|---------|-------------|
| **Auto-Pipeline** | Paste a URL — get evaluation + tailored PDF + tracker entry |
| **Structured Scoring** | 6-block evaluation: role fit, CV match, seniority, comp, tailoring, interview prep |
| **Tailored PDF CVs** | ATS-optimized CV generated per job, rendered via Playwright |
| **Portal Scanner** | Hits Greenhouse/Lever/Ashby/Workday APIs directly — zero LLM cost |
| **Location Filter** | Drops non-AU roles from global boards before they hit your pipeline |
| **Application Fill** | Fills Greenhouse/Lever forms in Chrome via browser automation |
| **Batch Processing** | Evaluate 10+ jobs in parallel with AI sub-agents |
| **Human-in-the-Loop** | AI prepares everything. You review and submit. Never auto-submits. |

---

## Requirements

- [Claude Code](https://claude.ai/code) **or** [Gemini CLI](https://github.com/google-gemini/gemini-cli)
- Node.js 18+
- Git

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/sum-kaur/australia-job-finder.git
cd australia-job-finder
npm install
npx playwright install chromium
```

### 2. Configure

```bash
cp config/profile.example.yml config/profile.yml
cp templates/portals.example.yml portals.yml
```

Edit `config/profile.yml` with your name, email, target roles, and salary range.

In `portals.yml`, uncomment `exclude_locations` to strip offshore roles:

```yaml
exclude_locations:
  - "India"
  - "Bengaluru"
  - "Singapore"
  - "United States"
  - "US - "
  - "United Kingdom"
```

### 3. Add your CV

Create `cv.md` in the project root:

```markdown
# Your Name

## Summary
Senior AI Engineer with 4 years building production LLM systems...

## Experience
### Company — Role (2022–present)
- Built X that achieved Y...

## Skills
Python, AWS, LangChain, FastAPI...
```

### 4. Start

```bash
claude   # or: gemini
```

The system onboards itself — reads your CV and asks a few questions to calibrate scoring to your situation.

### 5. Scan for AU jobs

```
/career-ops scan
```

Scans 30+ AU companies and drops new roles into `data/pipeline.md`. Takes ~60 seconds.

---

## Daily workflow

```
/career-ops scan        → Find new AU roles (Greenhouse, Lever, Ashby, Workday)
/career-ops pipeline    → Batch-evaluate all pending URLs
/career-ops pdf         → Generate tailored PDF CV for a specific job
/career-ops apply       → Fill application form in browser
/career-ops tracker     → View pipeline status
```

Or paste any job URL directly — auto-detects and runs the full pipeline.

---

## How scoring works

| Block | What it checks |
|-------|----------------|
| **A — Role Fit** | Does this match your archetype and level? |
| **B — CV Match** | Skills, stack, and experience overlap |
| **C — Level Strategy** | Step up, lateral, or step down? |
| **D — Comp Research** | Estimated salary vs your AU target |
| **E — Personalization** | How much the CV can be tailored |
| **F — Interview Prep** | STAR+R stories pre-generated for this role |

Score >= 4.0 → apply. Below 4.0 → skip (or override if you have a reason).

---

## AU companies included

**AI / ML**
Culture Amp · SafetyCulture · Canva · Atlassian · Dovetail

**Fintech**
Plenti · Airwallex · Afterpay/Block · Zip Co · Prospa · Brighte · Employment Hero

**Marketplaces**
REA Group · Seek · Airtasker

**SaaS / Developer tools**
Xero · MYOB · Deputy · Buildkite · Octopus Deploy · Secure Code Warrior · Linktree · Siteminder · Vend/Lightspeed

**Enterprise / Cloud**
Telstra · Commonwealth Bank · Medibank

---

## Customise it

The AI reads and edits its own config files. Just ask:

```
"Add more AU companies to my portals"
"Change target roles to backend engineering"
"Update my salary target to $130k"
"Scan every 2 days automatically"
```

---

## Your data stays on your machine

Every personal file is gitignored:

```
cv.md                      # your CV
config/profile.yml         # your profile
portals.yml                # your portal config
article-digest.md          # your proof points
data/                      # tracker, pipeline, follow-ups
reports/                   # evaluation reports
output/                    # generated PDFs
interview-prep/*-*.md      # company-specific interview prep
```

Run `git status` before any push to confirm nothing personal is staged.

---

## Project structure

```
australia-job-finder/
├── cv.md                         # Your CV (gitignored)
├── config/profile.example.yml    # Profile template
├── templates/portals.example.yml # Scanner config (30+ AU companies)
├── templates/cv-template.html    # ATS CV template
├── modes/                        # AI skill modes
│   ├── _shared.md                # System context
│   ├── oferta.md                 # Evaluation logic
│   ├── pdf.md                    # PDF generation
│   └── scan.md                   # Scanner logic
├── scan.mjs                      # Zero-token portal scanner
├── generate-pdf.mjs              # Playwright PDF renderer
├── data/                         # Pipeline data (gitignored)
├── reports/                      # Evaluation reports (gitignored)
└── output/                       # Generated PDFs (gitignored)
```

---

## Tech stack

- **Agent runtime**: Claude Code / Gemini CLI with custom skill modes
- **Scanner**: Direct Greenhouse / Lever / Ashby / Workday API — no browser, no LLM tokens
- **PDF**: Playwright + HTML/CSS (Space Grotesk + DM Sans)
- **Dashboard**: Go + Bubble Tea terminal UI

---

## Contributing

PRs welcome. If you verify a new AU company ATS slug that works reliably, open a PR — that's the most useful contribution.

---

## License

MIT — see [LICENSE](LICENSE).

Built by [Sumneet Kaur](https://github.com/sum-kaur) · [linkedin.com/in/sumneet-kaur](https://linkedin.com/in/sumneet-kaur)

# Career-Ops — AI Job Search Pipeline

<p align="center">
  <img src="docs/hero-banner.jpg" alt="Career-Ops — AI Job Search Pipeline" width="800">
</p>

<p align="center">
  <em>Stop tracking jobs in spreadsheets. Let an AI agent run your pipeline.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Claude_Code-000?style=flat&logo=anthropic&logoColor=white" alt="Claude Code">
  <img src="https://img.shields.io/badge/Gemini_CLI-4285F4?style=flat&logo=google&logoColor=white" alt="Gemini CLI">
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Playwright-2EAD33?style=flat&logo=playwright&logoColor=white" alt="Playwright">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT">
</p>

---

## What is this?

Career-Ops turns any AI coding CLI (Claude Code, Gemini CLI, OpenCode) into a full job search command center.

You paste a job URL. It evaluates fit against your CV, scores it, generates a tailored PDF, and tracks it. Automatically.

Built specifically for the **Australian tech job market** — pre-configured with AU companies on Greenhouse, Lever, Ashby, and Workday, with location filtering to strip offshore roles from global job boards.

> **Not a spray-and-pray tool.** Career-ops helps you find the few roles worth applying to out of hundreds. It recommends against anything scoring below 4.0/5. Quality over volume.

---

## What it does

| Feature | What happens |
|---------|-------------|
| **Auto-Pipeline** | Paste a job URL → full evaluation + PDF CV + tracker entry, automatically |
| **Structured Scoring** | 6-block evaluation: role fit, CV match, seniority, comp research, tailoring, interview prep |
| **Tailored PDF CVs** | ATS-optimized CV generated per job description, rendered with Playwright |
| **Portal Scanner** | Scans Greenhouse/Lever/Ashby/Workday APIs directly — zero LLM cost, zero browser |
| **Location Filter** | Strips India/US/UK/Singapore roles from global boards — AU results only |
| **AU Companies** | 16 AU companies pre-configured: Canva, Atlassian, Airwallex, Culture Amp, SafetyCulture, REA Group, Seek, Deputy, Plenti, Employment Hero, Afterpay/Block, Telstra, CBA, Prospa, Immutable, Secure Code Warrior |
| **Batch Processing** | Evaluate 10+ jobs in parallel with sub-agents |
| **Application Fill** | Fills Greenhouse/Lever forms in Chrome via browser automation |
| **Human-in-the-Loop** | AI prepares everything, you review and submit. Never auto-submits. |

---

## Before you start

You need:
- [Claude Code](https://claude.ai/code) **or** [Gemini CLI](https://github.com/google-gemini/gemini-cli) installed
- Node.js 18+
- Git

That's it. No hosted service, no API keys beyond your chosen AI CLI.

---

## Setup (5 minutes)

### 1. Clone and install

```bash
git clone https://github.com/sum-kaur/australia-job-finder.git
cd australia-job-finder
npm install
npx playwright install chromium
```

### 2. Set up your config files

```bash
cp config/profile.example.yml config/profile.yml
cp templates/portals.example.yml portals.yml
```

Open `config/profile.yml` and fill in your name, email, location, and target roles.

Open `portals.yml` — for Australian candidates, uncomment the `exclude_locations` block to strip offshore roles:

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

Create `cv.md` in the project root with your CV in plain markdown. Example:

```markdown
# Your Name

## Summary
...

## Experience
### Company — Role (2022–present)
- Built X that did Y, resulting in Z
...

## Skills
Python, AWS, LangChain...
```

### 4. Open Claude Code (or Gemini)

```bash
claude   # Claude Code
# or
gemini   # Gemini CLI
```

Career-ops auto-loads on startup. The first thing it will do is guide you through onboarding — it'll read your CV and ask a few questions to calibrate the scoring to your situation.

### 5. Run your first scan

```
/career-ops scan
```

This scans the pre-configured AU companies and drops new job URLs into `data/pipeline.md`. Takes about 30–60 seconds.

---

## Daily workflow

```
/career-ops scan              → Find new AU jobs (Greenhouse, Lever, Ashby, Workday)
/career-ops pipeline          → Evaluate all pending URLs in batch
/career-ops pdf               → Generate tailored PDF for a specific job
/career-ops apply             → Fill application form in browser
/career-ops tracker           → View your pipeline status
```

Or just paste a job URL directly — career-ops detects it and runs the full pipeline automatically.

---

## How scoring works

Every job gets a score from 0–5 across 6 blocks:

| Block | What it checks |
|-------|---------------|
| **A — Role Fit** | Does this role match your archetype and level? |
| **B — CV Match** | Skills, stack, experience overlap |
| **C — Level Strategy** | Is this a step up, lateral, or step down? |
| **D — Comp Research** | Estimated salary vs your target |
| **E — Personalization** | How much the CV/cover letter can be tailored |
| **F — Interview Prep** | STAR+R stories pre-generated for this role |

Score below 4.0 → skip. Score 4.0+ → apply. The system tells you why.

---

## AU companies pre-configured

The scanner is ready to check these Australian companies out of the box:

**AI / ML Platforms**
Culture Amp · SafetyCulture · Canva · Atlassian

**Fintech**
Plenti · Airwallex · Afterpay/Block · Prospa · Employment Hero

**Marketplaces & Data**
REA Group · Seek · Immutable

**Workforce / Cloud**
Deputy · Secure Code Warrior · Telstra (Workday) · Commonwealth Bank (Workday)

Global companies (Anthropic, OpenAI, ElevenLabs, n8n, Zapier, and 40+ more) are also included. The location filter keeps only AU roles from their boards.

---

## Customizing for your search

Career-ops is designed to be customized by the AI itself. Just tell it what you want:

```
"Change the target roles to data engineering"
"Add these companies to my portals: [list]"
"Update my salary target to $130k"
"I don't want roles at companies under 50 people"
"Translate the modes to French"
```

It reads and edits the same files it uses. No manual config editing required.

---

## Project structure

```
career-ops/
├── cv.md                        # Your CV (you create this — gitignored)
├── config/
│   └── profile.example.yml      # Profile template (copy to profile.yml)
├── templates/
│   ├── portals.example.yml      # Scanner config (copy to portals.yml)
│   └── cv-template.html         # HTML CV template
├── modes/                       # Skill modes loaded by the AI
│   ├── _shared.md               # System context
│   ├── oferta.md                # Job evaluation logic
│   ├── pdf.md                   # PDF generation
│   ├── scan.md                  # Scanner logic
│   └── ...
├── scan.mjs                     # Zero-token portal scanner
├── generate-pdf.mjs             # Playwright PDF renderer
├── data/                        # Your pipeline data (gitignored)
├── reports/                     # Evaluation reports (gitignored)
└── output/                      # Generated PDFs (gitignored)
```

**Everything in `data/`, `reports/`, `output/`, `cv.md`, `portals.yml`, and `config/profile.yml` is gitignored — your personal data never leaves your machine.**

---

## Keeping your data private

Personal files are gitignored by default:

```
cv.md                    # Your CV
article-digest.md        # Your proof points
config/profile.yml       # Your profile
portals.yml              # Your portal config
data/applications.md     # Your tracker
data/pipeline.md         # Your job queue
data/follow-ups.md       # Your follow-up history
reports/                 # Your evaluation reports
output/                  # Your generated PDFs
interview-prep/*-*.md    # Your company-specific interview prep
```

Before pushing to GitHub, run `git status` to confirm nothing personal is staged.

---

## Tech stack

- **Agent**: Claude Code / Gemini CLI with custom skill modes
- **Scanner**: Direct Greenhouse/Lever/Ashby/Workday API calls — no browser, no LLM tokens
- **PDF**: Playwright + HTML/CSS template (Space Grotesk + DM Sans)
- **Dashboard**: Go + Bubble Tea terminal UI

---

## Contributing

Issues and PRs welcome. If you add AU companies that work reliably, please open a PR with the verified ATS slug.

---

## Disclaimer

Career-ops is a local, open-source tool — not a hosted service. Your CV and personal data stay on your machine. The tool never auto-submits applications — you always review and submit yourself.

See [LEGAL_DISCLAIMER.md](LEGAL_DISCLAIMER.md) for full details. MIT licensed.

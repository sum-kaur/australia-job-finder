#!/usr/bin/env node

/**
 * scan.mjs — Zero-token portal scanner
 *
 * Fetches Greenhouse, Ashby, Lever, Workday, BambooHR, SmartRecruiters, and
 * Teamtailor APIs directly. Applies title + location filters from portals.yml,
 * deduplicates against existing history, and appends new offers to
 * pipeline.md + scan-history.tsv.
 *
 * Zero Claude API tokens — pure HTTP + JSON.
 *
 * Usage:
 *   node scan.mjs                  # scan all enabled companies
 *   node scan.mjs --dry-run        # preview without writing files
 *   node scan.mjs --company Xero   # scan a single company
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import yaml from 'js-yaml';
const parseYaml = yaml.load;

// ── Config ──────────────────────────────────────────────────────────

const PORTALS_PATH = 'portals.yml';
const SCAN_HISTORY_PATH = 'data/scan-history.tsv';
const PIPELINE_PATH = 'data/pipeline.md';
const APPLICATIONS_PATH = 'data/applications.md';

mkdirSync('data', { recursive: true });

const CONCURRENCY = 5;
const FETCH_TIMEOUT_MS = 30_000;

// ── API detection ───────────────────────────────────────────────────

function detectApi(company) {
  // Explicit api_provider field takes priority
  if (company.api && company.api_provider) {
    return { type: company.api_provider, url: company.api };
  }

  // Explicit api field with Greenhouse domain
  if (company.api && company.api.includes('greenhouse')) {
    return { type: 'greenhouse', url: company.api };
  }

  const url = company.careers_url || '';

  // Ashby
  const ashbyMatch = url.match(/jobs\.ashbyhq\.com\/([^/?#]+)/);
  if (ashbyMatch) {
    return {
      type: 'ashby',
      url: `https://api.ashbyhq.com/posting-api/job-board/${ashbyMatch[1]}?includeCompensation=true`,
    };
  }

  // Lever
  const leverMatch = url.match(/jobs\.lever\.co\/([^/?#]+)/);
  if (leverMatch) {
    return {
      type: 'lever',
      url: `https://api.lever.co/v0/postings/${leverMatch[1]}`,
    };
  }

  // Greenhouse (standard and EU boards)
  const ghMatch = url.match(/job-boards(?:\.eu)?\.greenhouse\.io\/([^/?#]+)/);
  if (ghMatch && !company.api) {
    return {
      type: 'greenhouse',
      url: `https://boards-api.greenhouse.io/v1/boards/${ghMatch[1]}/jobs`,
    };
  }

  // BambooHR
  const bambooMatch = url.match(/([^.]+)\.bamboohr\.com/);
  if (bambooMatch) {
    return {
      type: 'bamboohr',
      url: `https://${bambooMatch[1]}.bamboohr.com/careers/list`,
    };
  }

  // Workday — requires explicit api field (URL varies per tenant)
  if (url.includes('myworkdayjobs.com') && company.api) {
    return { type: 'workday', url: company.api };
  }

  // Teamtailor RSS
  const teamtailorMatch = url.match(/([^.]+)\.teamtailor\.com/);
  if (teamtailorMatch) {
    return {
      type: 'teamtailor',
      url: `https://${teamtailorMatch[1]}.teamtailor.com/jobs.rss`,
    };
  }

  // SmartRecruiters — requires explicit api field
  if (company.api && company.api.includes('smartrecruiters')) {
    return { type: 'smartrecruiters', url: company.api };
  }

  return null;
}

// ── API parsers ─────────────────────────────────────────────────────

function parseGreenhouse(json, companyName) {
  const jobs = json.jobs || [];
  return jobs.map(j => ({
    title: j.title || '',
    url: j.absolute_url || '',
    company: companyName,
    location: j.location?.name || '',
    publishedAt: j.updated_at || null,
  }));
}

function parseAshby(json, companyName) {
  const jobs = json.jobs || [];
  return jobs.map(j => ({
    title: j.title || '',
    url: j.jobUrl || '',
    company: companyName,
    location: j.location || '',
    publishedAt: j.publishedDate || j.updatedAt || null,
  }));
}

function parseLever(json, companyName) {
  if (!Array.isArray(json)) return [];
  return json.map(j => ({
    title: j.text || '',
    url: j.hostedUrl || '',
    company: companyName,
    location: j.categories?.location || '',
    publishedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
  }));
}

function parseBambooHR(json, companyName) {
  const jobs = json.result || json.jobs || [];
  const slug = companyName.toLowerCase().replace(/\s+/g, '');
  return jobs.map(j => ({
    title: j.jobOpeningName || j.title || '',
    url: j.jobOpeningShareUrl || `https://${slug}.bamboohr.com/careers/${j.id}/detail`,
    company: companyName,
    location: j.location?.city || j.location || '',
    publishedAt: j.datePosted || null,
  }));
}

function parseWorkday(json, companyName) {
  const jobs = json.jobPostings || [];
  return jobs.map(j => ({
    title: j.title || j.positionTitle || '',
    url: j.externalPath
      ? `https://placeholder.myworkdayjobs.com${j.externalPath}`
      : '',
    company: companyName,
    location: j.locationsText || j.location || '',
    _workdayPath: j.externalPath || '',
  }));
}

function parseTeamtailor(text, companyName) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(text)) !== null) {
    const block = match[1];
    const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                   block.match(/<title>(.*?)<\/title>/))?.[1] || '';
    const link = (block.match(/<link>(.*?)<\/link>/))?.[1] || '';
    items.push({
      title: title.trim(),
      url: link.trim(),
      company: companyName,
      location: '',
    });
  }
  return items;
}

function parseSmartRecruiters(json, companyName) {
  const jobs = json.content || json.items || [];
  return jobs.map(j => ({
    title: j.name || j.title || '',
    url: `https://jobs.smartrecruiters.com/${companyName}/${j.id}`,
    company: companyName,
    location: j.location?.city || j.location?.country || '',
    publishedAt: j.releasedDate || j.createdOn || null,
  }));
}

const PARSERS = {
  greenhouse: parseGreenhouse,
  ashby: parseAshby,
  lever: parseLever,
  bamboohr: parseBambooHR,
  workday: parseWorkday,
  teamtailor: parseTeamtailor,
  smartrecruiters: parseSmartRecruiters,
};

// ── Fetch helpers ───────────────────────────────────────────────────

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, ...options });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// Workday requires paginated POST
async function fetchWorkday(apiUrl, companyName) {
  const allJobs = [];
  let offset = 0;
  const limit = 20;

  while (true) {
    const body = JSON.stringify({
      appliedFacets: {},
      limit,
      offset,
      searchText: '',
    });
    const json = await fetchJson(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body,
    });

    const jobs = parseWorkday(json, companyName);

    // Resolve placeholder URLs to real Workday job URLs
    const base = new URL(apiUrl);
    const baseUrl = `${base.protocol}//${base.host}`;
    for (const job of jobs) {
      if (job._workdayPath) {
        job.url = `${baseUrl}${job._workdayPath}`;
      }
      delete job._workdayPath;
    }

    allJobs.push(...jobs);

    const total = json.total || json.totalJobPostings || 0;
    offset += limit;
    if (offset >= total || jobs.length === 0) break;
  }

  return allJobs;
}

// ── Recency filter ──────────────────────────────────────────────────

function isRecent(publishedAt, maxAgeDays) {
  if (!maxAgeDays || !publishedAt) return true;
  const date = new Date(publishedAt);
  if (isNaN(date.getTime())) return true;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);
  return date >= cutoff;
}

// ── Title filter ────────────────────────────────────────────────────

function buildTitleFilter(titleFilter) {
  const positive = (titleFilter?.positive || []).map(k => k.toLowerCase());
  const negative = (titleFilter?.negative || []).map(k => k.toLowerCase());

  return (title) => {
    const lower = title.toLowerCase();
    const hasPositive = positive.length === 0 || positive.some(k => lower.includes(k));
    const hasNegative = negative.some(k => lower.includes(k));
    return hasPositive && !hasNegative;
  };
}

// ── Location filter ─────────────────────────────────────────────────
// Drops jobs whose location contains any excluded string (case-insensitive).
// Empty location always passes — remote-first companies often omit location.
// auCompany: true → bypass filter entirely (AU-HQ companies always pass).
// Pure remote tokens (Remote, Worldwide, etc.) always pass regardless of exclusions.

const REMOTE_TOKENS = new Set(['remote', 'worldwide', 'global', 'anywhere', 'distributed']);

function buildLocationFilter(excludeLocations) {
  if (!excludeLocations || excludeLocations.length === 0) return () => false;
  const patterns = excludeLocations.map(l => l.toLowerCase());
  return (location, auCompany = false) => {
    if (auCompany) return false;
    if (!location) return false;
    const lower = location.toLowerCase().trim();
    if (REMOTE_TOKENS.has(lower)) return false;
    return patterns.some(p => lower.includes(p));
  };
}

// ── Dedup ───────────────────────────────────────────────────────────

function loadSeenUrls() {
  const seen = new Set();

  if (existsSync(SCAN_HISTORY_PATH)) {
    const lines = readFileSync(SCAN_HISTORY_PATH, 'utf-8').split('\n');
    for (const line of lines.slice(1)) {
      const url = line.split('\t')[0];
      if (url) seen.add(url);
    }
  }

  if (existsSync(PIPELINE_PATH)) {
    const text = readFileSync(PIPELINE_PATH, 'utf-8');
    for (const match of text.matchAll(/- \[[ x]\] (https?:\/\/\S+)/g)) {
      seen.add(match[1]);
    }
  }

  if (existsSync(APPLICATIONS_PATH)) {
    const text = readFileSync(APPLICATIONS_PATH, 'utf-8');
    for (const match of text.matchAll(/https?:\/\/[^\s|)]+/g)) {
      seen.add(match[0]);
    }
  }

  return seen;
}

function loadSeenCompanyRoles() {
  const seen = new Set();
  if (existsSync(APPLICATIONS_PATH)) {
    const text = readFileSync(APPLICATIONS_PATH, 'utf-8');
    for (const match of text.matchAll(/\|[^|]+\|[^|]+\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g)) {
      const company = match[1].trim().toLowerCase();
      const role = match[2].trim().toLowerCase();
      if (company && role && company !== 'company') {
        seen.add(`${company}::${role}`);
      }
    }
  }
  return seen;
}

// ── Pipeline writer ─────────────────────────────────────────────────

function appendToPipeline(offers) {
  if (offers.length === 0) return;

  if (!existsSync(PIPELINE_PATH)) {
    writeFileSync(PIPELINE_PATH,
      '# Job Pipeline\n\n## Pending\n\n## Processed\n', 'utf-8');
  }

  let text = readFileSync(PIPELINE_PATH, 'utf-8');
  const marker = '## Pending';
  const idx = text.indexOf(marker);

  if (idx === -1) {
    text += `\n${marker}\n\n` + offers.map(o =>
      `- [ ] ${o.url} | ${o.company} | ${o.title}`
    ).join('\n') + '\n\n';
  } else {
    const afterMarker = idx + marker.length;
    const nextSection = text.indexOf('\n## ', afterMarker);
    const insertAt = nextSection === -1 ? text.length : nextSection;
    const block = '\n' + offers.map(o =>
      `- [ ] ${o.url} | ${o.company} | ${o.title}`
    ).join('\n') + '\n';
    text = text.slice(0, insertAt) + block + text.slice(insertAt);
  }

  writeFileSync(PIPELINE_PATH, text, 'utf-8');
}

function appendToScanHistory(offers, date) {
  if (!existsSync(SCAN_HISTORY_PATH)) {
    writeFileSync(SCAN_HISTORY_PATH,
      'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\n', 'utf-8');
  }
  const lines = offers.map(o =>
    `${o.url}\t${date}\t${o.source}\t${o.title}\t${o.company}\tadded`
  ).join('\n') + '\n';
  appendFileSync(SCAN_HISTORY_PATH, lines, 'utf-8');
}

// ── Parallel fetch with concurrency limit ───────────────────────────

async function parallelFetch(tasks, limit) {
  const results = [];
  let i = 0;
  async function next() {
    while (i < tasks.length) {
      const task = tasks[i++];
      results.push(await task());
    }
  }
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => next());
  await Promise.all(workers);
  return results;
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const companyFlag = args.indexOf('--company');
  const filterCompany = companyFlag !== -1 ? args[companyFlag + 1]?.toLowerCase() : null;

  if (!existsSync(PORTALS_PATH)) {
    console.error('Error: portals.yml not found. Run onboarding first.');
    process.exit(1);
  }

  const config = parseYaml(readFileSync(PORTALS_PATH, 'utf-8'));
  const companies = config.tracked_companies || [];
  const titleFilter = buildTitleFilter(config.title_filter);
  const isExcludedLocation = buildLocationFilter(config.exclude_locations);
  const maxAgeDays = config.max_age_days || null;

  if (maxAgeDays) console.log(`Recency filter: last ${maxAgeDays} days`);
  if (config.exclude_locations?.length) {
    console.log(`Location exclusions: ${config.exclude_locations.join(', ')}`);
  }

  const targets = companies
    .filter(c => c.enabled !== false)
    .filter(c => !filterCompany || c.name.toLowerCase().includes(filterCompany))
    .map(c => ({ ...c, _api: detectApi(c) }))
    .filter(c => c._api !== null);

  const skippedCount = companies.filter(c => c.enabled !== false).length - targets.length;

  console.log(`Scanning ${targets.length} companies via API (${skippedCount} skipped — no API detected)`);
  if (dryRun) console.log('(dry run — no files will be written)\n');

  const seenUrls = loadSeenUrls();
  const seenCompanyRoles = loadSeenCompanyRoles();
  const date = new Date().toISOString().slice(0, 10);

  let totalFound = 0;
  let totalTitleFiltered = 0;
  let totalLocationFiltered = 0;
  let totalStaleFiltered = 0;
  let totalDupes = 0;
  const newOffers = [];
  const errors = [];

  const tasks = targets.map(company => async () => {
    const { type, url } = company._api;
    try {
      let jobs;

      if (type === 'workday') {
        jobs = await fetchWorkday(url, company.name);
      } else if (type === 'teamtailor') {
        const text = await fetchText(url);
        jobs = parseTeamtailor(text, company.name);
      } else {
        const json = await fetchJson(url);
        const parser = PARSERS[type];
        if (!parser) {
          errors.push({ company: company.name, error: `Unknown API type: ${type}` });
          return;
        }
        jobs = parser(json, company.name);
      }

      totalFound += jobs.length;

      for (const job of jobs) {
        if (!job.url) continue;

        // Title filter — drops Senior/Lead/Staff/Principal and non-target roles
        if (!titleFilter(job.title)) {
          totalTitleFiltered++;
          continue;
        }

        // Location filter — drops non-AU offices (Bengaluru, India, Manila, etc.)
        // au_company: true bypasses filter; pure "Remote" tokens always pass.
        if (isExcludedLocation(job.location, company.au_company)) {
          totalLocationFiltered++;
          continue;
        }

        // Recency filter
        if (!isRecent(job.publishedAt, maxAgeDays)) {
          totalStaleFiltered++;
          continue;
        }

        // Dedup
        if (seenUrls.has(job.url)) {
          totalDupes++;
          continue;
        }
        const key = `${job.company.toLowerCase()}::${job.title.toLowerCase()}`;
        if (seenCompanyRoles.has(key)) {
          totalDupes++;
          continue;
        }

        seenUrls.add(job.url);
        seenCompanyRoles.add(key);
        newOffers.push({ ...job, source: `${type}-api` });
      }
    } catch (err) {
      errors.push({ company: company.name, error: err.message });
    }
  });

  await parallelFetch(tasks, CONCURRENCY);

  if (!dryRun && newOffers.length > 0) {
    appendToPipeline(newOffers);
    appendToScanHistory(newOffers, date);
  }

  console.log(`\n${'━'.repeat(50)}`);
  console.log(`Portal Scan — ${date}`);
  console.log(`${'━'.repeat(50)}`);
  console.log(`Companies scanned:      ${targets.length}`);
  console.log(`Total jobs found:       ${totalFound}`);
  console.log(`Filtered by title:      ${totalTitleFiltered} removed (non-target role)`);
  console.log(`Filtered by location:   ${totalLocationFiltered} removed (non-AU)`);
  console.log(`Filtered by age:        ${totalStaleFiltered} removed (older than ${maxAgeDays || '∞'} days)`);
  console.log(`Duplicates:             ${totalDupes} skipped`);
  console.log(`New offers added:       ${newOffers.length}`);

  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`);
    for (const e of errors) {
      console.log(`  ✗ ${e.company}: ${e.error}`);
    }
  }

  if (newOffers.length > 0) {
    console.log('\nNew offers:');
    for (const o of newOffers) {
      console.log(`  + ${o.company} | ${o.title} | ${o.location || 'Remote'}`);
    }
    if (!dryRun) {
      console.log(`\nResults saved to ${PIPELINE_PATH} and ${SCAN_HISTORY_PATH}`);
    }
  }

  console.log(`\n→ Run /australia-job-finder pipeline to evaluate new offers.`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

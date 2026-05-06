#!/usr/bin/env node
/**
 * export-tracker.mjs
 * Converts data/applications.md → output/tracker.csv
 * Open the CSV in Excel or Google Sheets to track applications.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TRACKER = path.join(__dirname, 'data', 'applications.md');
const OUTPUT_DIR = path.join(__dirname, 'output');
const OUTPUT = path.join(OUTPUT_DIR, 'tracker.csv');

if (!fs.existsSync(TRACKER)) {
  console.error('No tracker found at data/applications.md — run /career-ops scan first.');
  process.exit(1);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const lines = fs.readFileSync(TRACKER, 'utf8').split('\n');

// Find the table rows (lines starting with |)
const tableLines = lines.filter(l => l.trim().startsWith('|'));

if (tableLines.length < 2) {
  console.error('No data rows found in applications.md.');
  process.exit(1);
}

function parseRow(line) {
  return line
    .split('|')
    .slice(1, -1) // drop leading/trailing empty splits
    .map(cell => {
      let val = cell.trim();
      // Strip markdown links [text](url) → text
      val = val.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
      // Normalise emoji
      val = val.replace(/✅/g, 'Yes').replace(/❌/g, 'No');
      // Escape double-quotes for CSV
      val = val.replace(/"/g, '""');
      return `"${val}"`;
    });
}

const rows = [];

for (const line of tableLines) {
  // Skip separator rows (---|---|...)
  if (/^\|[-| :]+\|$/.test(line.trim())) continue;
  rows.push(parseRow(line).join(','));
}

fs.writeFileSync(OUTPUT, rows.join('\n'), 'utf8');

console.log(`✓ Exported ${rows.length - 1} applications to output/tracker.csv`);
console.log(`  Open in Excel:        start output\\tracker.csv`);
console.log(`  Import to Google Sheets: File → Import → Upload`);

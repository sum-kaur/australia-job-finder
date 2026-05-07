#!/usr/bin/env node
/**
 * export-jobs-xlsx.mjs
 * Exports evaluated AU job applications (≥4.0 score) to a formatted Excel spreadsheet.
 * Includes a status dropdown column the user can update manually after applying.
 *
 * Usage:
 *   node export-jobs-xlsx.mjs                   # writes output/jobs-recommended.xlsx
 *   node export-jobs-xlsx.mjs --all             # include all entries (SKIP too)
 *   node export-jobs-xlsx.mjs --min-score 4.2   # custom score threshold
 */

import { readFileSync, existsSync, mkdirSync } from 'fs';
import ExcelJS from 'exceljs';
import { resolve } from 'path';

const APPLICATIONS_PATH = 'data/applications.md';
const OUTPUT_PATH       = 'output/jobs-recommended.xlsx';
const REPORTS_BASE_URL  = 'https://github.com/sum-kaur/australia-job-finder/blob/main/reports/';

const args = process.argv.slice(2);
const includeAll  = args.includes('--all');
const minScoreArg = args.indexOf('--min-score');
const MIN_SCORE   = minScoreArg !== -1 ? parseFloat(args[minScoreArg + 1]) : 4.0;

// ── Parse applications.md ────────────────────────────────────────────

function parseApplications() {
  if (!existsSync(APPLICATIONS_PATH)) {
    console.error(`Error: ${APPLICATIONS_PATH} not found.`);
    process.exit(1);
  }
  const text = readFileSync(APPLICATIONS_PATH, 'utf-8');
  const rows = [];

  for (const line of text.split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').map(c => c.trim()).filter((_, i) => i > 0);
    // Skip header and separator rows
    if (cells[0] === '#' || cells[0].startsWith('---') || cells.length < 8) continue;

    const [num, date, company, role, scoreRaw, status, pdfEmoji, reportCell, ...notesParts] = cells;
    const score = parseFloat(scoreRaw);
    if (isNaN(score)) continue;

    // Extract report number from markdown link [num](reports/...)
    const reportMatch = reportCell?.match(/\[([^\]]+)\]\(reports\/([^)]+)\)/);
    const reportSlug = reportMatch ? reportMatch[2] : null;
    const reportNum  = reportMatch ? reportMatch[1] : num;

    rows.push({
      num:      num.trim(),
      date:     date.trim(),
      company:  company.trim(),
      role:     role.trim(),
      score,
      status:   status.trim(),
      pdf:      pdfEmoji?.trim() === '✅',
      reportUrl: reportSlug ? `${REPORTS_BASE_URL}${reportSlug}` : null,
      notes:    notesParts.join('|').trim(),
    });
  }
  return rows;
}

// ── Score → color ────────────────────────────────────────────────────

function scoreColor(score) {
  if (score >= 4.4) return 'FF2E7D32'; // dark green
  if (score >= 4.2) return 'FF388E3C'; // green
  if (score >= 4.0) return 'FFF57F17'; // amber
  if (score >= 3.8) return 'FFE65100'; // orange
  return 'FFB71C1C';                   // red
}

function rowFill(score, status) {
  if (status === 'Applied')   return 'FFE3F2FD'; // blue tint
  if (status === 'Interview') return 'FFF3E5F5'; // purple tint
  if (status === 'Offer')     return 'FFE8F5E9'; // green tint
  if (status === 'Rejected')  return 'FFFAFAFA'; // grey tint
  if (score >= 4.4) return 'FFECEFF1';
  return 'FFFFFFFF';
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const all = parseApplications();

  const recommended = includeAll
    ? all
    : all.filter(r => r.score >= MIN_SCORE && r.status !== 'SKIP' && r.status !== 'Discarded');

  // Sort: score descending, then date descending
  recommended.sort((a, b) => b.score - a.score || b.date.localeCompare(a.date));

  console.log(`Found ${recommended.length} roles (≥${MIN_SCORE}/5) from ${all.length} total entries.`);

  const wb = new ExcelJS.Workbook();
  wb.creator  = 'australia-job-finder';
  wb.created  = new Date();
  wb.modified = new Date();

  // ── Sheet 1: Recommended roles ──────────────────────────────────────
  const ws = wb.addWorksheet('Recommended Roles', {
    views: [{ state: 'frozen', ySplit: 1 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  ws.columns = [
    { header: '#',           key: 'num',       width: 6  },
    { header: 'Date',        key: 'date',       width: 12 },
    { header: 'Company',     key: 'company',    width: 20 },
    { header: 'Role',        key: 'role',       width: 38 },
    { header: 'Score',       key: 'score',      width: 8  },
    { header: 'Apply Status', key: 'applyStatus', width: 14 },
    { header: 'Report',      key: 'report',     width: 10 },
    { header: 'Notes',       key: 'notes',      width: 55 },
  ];

  // Style header row
  const headerRow = ws.getRow(1);
  headerRow.eachCell(cell => {
    cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1565C0' } };
    cell.font   = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF0D47A1' } } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
  });
  headerRow.height = 22;

  // Status values for dropdown
  const STATUS_OPTIONS = '"Not Applied,Applied,Interviewing,Offer Received,Rejected,On Hold"';

  for (const [i, r] of recommended.entries()) {
    const rowNum = i + 2;
    const applyStatus = r.status === 'Applied' ? 'Applied'
                      : r.status === 'Interview' ? 'Interviewing'
                      : r.status === 'Offer'   ? 'Offer Received'
                      : r.status === 'Rejected' ? 'Rejected'
                      : 'Not Applied';

    const dataRow = ws.addRow({
      num:         r.num,
      date:        r.date,
      company:     r.company,
      role:        r.role,
      score:       r.score,
      applyStatus: applyStatus,
      report:      r.reportUrl ? 'View →' : '',
      notes:       r.notes,
    });

    // Score cell — colored badge
    const scoreCell = dataRow.getCell('score');
    scoreCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: scoreColor(r.score) } };
    scoreCell.font  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    scoreCell.alignment = { horizontal: 'center', vertical: 'middle' };
    scoreCell.numFmt = '0.0';

    // Row background based on status/score
    const fill = rowFill(r.score, applyStatus === 'Interviewing' ? 'Interview' : applyStatus === 'Offer Received' ? 'Offer' : applyStatus);
    dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber === 5) return; // skip score cell (already colored)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
      cell.alignment = { vertical: 'middle', wrapText: colNumber === 8 };
      cell.font = { size: 10 };
    });

    // Report link
    if (r.reportUrl) {
      const reportCell = dataRow.getCell('report');
      reportCell.value = { text: 'View →', hyperlink: r.reportUrl };
      reportCell.font  = { color: { argb: 'FF1565C0' }, underline: true, size: 10 };
      reportCell.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    // Status dropdown data validation
    ws.getCell(`F${rowNum}`).dataValidation = {
      type:        'list',
      allowBlank:  false,
      formulae:    [STATUS_OPTIONS],
      showDropDown: false,
      prompt:      'Select application status',
      promptTitle: 'Status',
    };

    // Alternating row tint for uncolored rows
    dataRow.height = 18;

    // Thin border
    dataRow.eachCell({ includeEmpty: true }, cell => {
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      };
    });
  }

  // Auto-filter on header row
  ws.autoFilter = { from: 'A1', to: 'H1' };

  // ── Sheet 2: All entries (reference) ────────────────────────────────
  const wsAll = wb.addWorksheet('All Evaluations', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  wsAll.columns = [
    { header: '#',       key: 'num',    width: 6  },
    { header: 'Date',    key: 'date',   width: 12 },
    { header: 'Company', key: 'company', width: 20 },
    { header: 'Role',    key: 'role',   width: 38 },
    { header: 'Score',   key: 'score',  width: 8  },
    { header: 'Status',  key: 'status', width: 12 },
    { header: 'Notes',   key: 'notes',  width: 55 },
  ];

  const wsAllHeader = wsAll.getRow(1);
  wsAllHeader.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF37474F' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  wsAllHeader.height = 22;

  for (const r of all.sort((a, b) => b.score - a.score)) {
    const row = wsAll.addRow({
      num:    r.num,
      date:   r.date,
      company: r.company,
      role:   r.role,
      score:  r.score,
      status: r.status,
      notes:  r.notes,
    });

    const sc = row.getCell('score');
    sc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: scoreColor(r.score) } };
    sc.font  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    sc.alignment = { horizontal: 'center', vertical: 'middle' };
    sc.numFmt = '0.0';
    row.height = 17;
  }

  wsAll.autoFilter = { from: 'A1', to: 'G1' };

  // Write file
  mkdirSync('output', { recursive: true });
  const outPath = resolve(OUTPUT_PATH);
  await wb.xlsx.writeFile(outPath);
  console.log(`\n✅ Spreadsheet written: ${outPath}`);
  console.log(`   Sheet 1 "Recommended Roles": ${recommended.length} roles (≥${MIN_SCORE}/5)`);
  console.log(`   Sheet 2 "All Evaluations":   ${all.length} total entries`);
  console.log(`\n   Column F = Apply Status — click a cell for the dropdown.`);
  console.log(`   Change status from "Not Applied" → "Applied" after submitting.`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

#!/usr/bin/env node
/*
  mergeReport.js — OTST HTML Report Generator
  ============================================
  Merges:
    • Validation_Reports/.bru_results.json  (Bruno --reporter-json output — all assertions)
    • Validation_Reports/.report_tmp.json   (request/response bodies captured in after-response)
  into:
    • Validation_Reports/YYYYMMDD_<EnvName>_Report.html

  Usage (run AFTER bru.cmd):
    node library-bruno/mergeReport.js OTST_Chaps_Env
*/

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Paths ────────────────────────────────────────────────────────────────────
const ROOT       = path.resolve(__dirname, '..');
const VAL_DIR    = path.join(ROOT, 'Validation_Reports');
const BRU_JSON   = path.join(VAL_DIR, '.bru_results.json');
const TMP_JSON   = path.join(VAL_DIR, '.report_tmp.json');

// ─── Args ─────────────────────────────────────────────────────────────────────
const rawEnvArg  = process.argv[2] || 'Unknown';
const envName    = rawEnvArg.replace(/^OTST_/i, '').replace(/_Env$/i, '');
const dateStr    = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const htmlPath   = path.join(VAL_DIR, `${dateStr}_${envName}_Report.html`);

// ─── Load data ────────────────────────────────────────────────────────────────
if (!fs.existsSync(BRU_JSON)) {
  console.error('[mergeReport] ERROR: Bruno JSON report not found: ' + BRU_JSON);
  console.error('  Run with: bru.cmd run --sandbox=developer --env <EnvName> --reporter-json "Validation_Reports/.bru_results.json"');
  process.exit(1);
}

const bruRaw  = JSON.parse(fs.readFileSync(BRU_JSON, 'utf8'));
const tmpData = fs.existsSync(TMP_JSON)
  ? JSON.parse(fs.readFileSync(TMP_JSON, 'utf8'))
  : { meta: {}, requests: [] };

// ─── Parse Bruno JSON reporter (handle both v1 and v2 formats) ───────────────
// Bruno CLI may emit { results: [...] } or { testResults: [...] } or just [...]
const bruResults = Array.isArray(bruRaw)              ? bruRaw
                 : Array.isArray(bruRaw.results)      ? bruRaw.results
                 : Array.isArray(bruRaw.testResults)  ? bruRaw.testResults
                 : [];

const bruSummary = bruRaw.summary || {};

// ─── Build lookup of captured bodies by request URL (normalized) ──────────────
function normUrl(u) { return (u || '').split('?')[0].replace(/\/+$/, '').toLowerCase(); }

const bodyLookup = {};
(tmpData.requests || []).forEach(r => {
  const key = r.requestMethod + '|' + normUrl(r.requestUrl);
  bodyLookup[key] = r;
});

// ─── Helper: match a Bruno result entry to a body entry ──────────────────────
function findBody(bruEntry) {
  const method = (bruEntry.request && bruEntry.request.method || '').toUpperCase();
  const url    = bruEntry.request && bruEntry.request.url || '';
  const key    = method + '|' + normUrl(url);
  return bodyLookup[key] || null;
}

// ─── Helper: extract test results from Bruno result entry ─────────────────────
function getTests(bruEntry) {
  // Bruno may use "tests" or "assertions" or both
  const tests = [];

  // tests[] array (test() calls)
  const rawTests = bruEntry.tests || bruEntry.testResults || [];
  rawTests.forEach(t => {
    tests.push({
      name:   t.name || t.description || '',
      passed: t.status === 'passed' || t.passed === true,
      error:  t.error  || t.message || null
    });
  });

  // assertions[] array (assert block in .yml)
  const rawAsserts = bruEntry.assertions || [];
  rawAsserts.forEach(a => {
    tests.push({
      name:   a.name || a.lhsExpr + ' ' + a.rhsExpr || 'assertion',
      passed: a.status === 'passed' || a.passed === true,
      error:  a.error || null
    });
  });

  return tests;
}

// ─── Classify auth vs OSDM ────────────────────────────────────────────────────
function isAuthRequest(bruEntry) {
  const url = ((bruEntry.request && bruEntry.request.url) || '').toLowerCase();
  const name = (bruEntry.suiteName || bruEntry.filename || '').toLowerCase();
  return /\/(token|login|auth|logon|oauth)/.test(url) || /access.?token/i.test(name);
}

// ─── Build merged request list ────────────────────────────────────────────────
const mergedRequests = bruResults.map((entry, i) => {
  const body    = findBody(entry);
  const tests   = getTests(entry);
  const status  = (entry.response && entry.response.status) || (body && body.responseStatus) || 0;
  const method  = (entry.request && entry.request.method)  || (body && body.requestMethod)  || '';
  const url     = (entry.request && entry.request.url)     || (body && body.requestUrl)      || '';

  // Request body: prefer Bruno's captured data, fall back to our tmp
  let reqBody = '';
  if (entry.request && entry.request.data != null) {
    reqBody = typeof entry.request.data === 'string' ? entry.request.data : JSON.stringify(entry.request.data, null, 2);
  } else if (body && body.requestBody) {
    reqBody = body.requestBody;
  }

  // Request headers
  let reqHeaders = {};
  if (entry.request && entry.request.headers) reqHeaders = entry.request.headers;

  // Response body: prefer Bruno's, fall back to our tmp
  let resBody = '';
  if (entry.response && entry.response.data != null) {
    resBody = typeof entry.response.data === 'string' ? entry.response.data : JSON.stringify(entry.response.data, null, 2);
  } else if (body && body.responseBody) {
    resBody = body.responseBody;
  }

  // Response headers
  let resHeaders = {};
  if (entry.response && entry.response.headers) resHeaders = entry.response.headers;

  // Display name: "FolderName \ RequestName"
  const suite = (entry.suiteName || '').trim();
  const file  = (entry.filename  || '').replace(/\.yml$|\.bru$/i, '').trim();
  const displayName = suite ? `${suite} \\ ${file}` : file;

  return {
    index:        i + 1,
    displayName,
    method:       method.toUpperCase(),
    url,
    status,
    reqHeaders,
    reqBody,
    resHeaders,
    resBody,
    tests,
    group:        isAuthRequest(entry) ? 'auth' : 'osdm',
    error:        entry.error || null
  };
});

// ─── Scenario meta from tmpData ───────────────────────────────────────────────
const meta = tmpData.meta || {};

// ─── Stats ────────────────────────────────────────────────────────────────────
const osdmReqs   = mergedRequests.filter(r => r.group === 'osdm');
const authReqs   = mergedRequests.filter(r => r.group === 'auth');
const authOk     = authReqs.some(r => r.status >= 200 && r.status < 300);
const totalTests = osdmReqs.reduce((s, r) => s + r.tests.length, 0);
const passTests  = osdmReqs.reduce((s, r) => s + r.tests.filter(t => t.passed).length, 0);
const failTests  = totalTests - passTests;

// ─── HTML helpers ─────────────────────────────────────────────────────────────
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function prettyJson(raw) {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'object') return JSON.stringify(raw, null, 2);
  try { return JSON.stringify(JSON.parse(raw), null, 2); } catch (_) { return String(raw); }
}

function maskHeaderValue(name, value) {
  const key = String(name || '').toLowerCase();
  const raw = value == null ? '' : String(value);
  const maskTail = 'xxxxxxxxxxxxxxxxx';

  if (key === 'authorization' && /^bearer\s+/i.test(raw)) {
    const token = raw.replace(/^bearer\s+/i, '').trim();
    const first3 = token.slice(0, 3);
    return `Bearer ${first3}${maskTail}`;
  }

  if (key === 'requestor') {
    const trimmed = raw.trim();
    if (!trimmed || /^null$/i.test(trimmed)) return raw;
    return `${trimmed.slice(0, 3)}${maskTail}`;
  }

  return raw;
}

function headerTable(hdrs) {
  if (!hdrs || !Object.keys(hdrs).length) return '<em style="color:#90a4ae">no headers captured</em>';
  return '<table class="hdrtbl">' +
    Object.entries(hdrs).map(([k, v]) =>
      `<tr><td class="hdrk">${esc(k)}</td><td class="hdrv">${esc(maskHeaderValue(k, v))}</td></tr>`
    ).join('') +
    '</table>';
}

function statusBadge(s) {
  const cls = (s >= 200 && s < 300) ? 'badge-ok' : (s >= 400) ? 'badge-err' : 'badge-warn';
  return `<span class="badge ${cls}">${esc(s)}</span>`;
}

// ─── Request block HTML ────────────────────────────────────────────────────────
function requestBlock(r) {
  const isOk = r.status >= 200 && r.status < 300;
  const pCount = r.tests.filter(t => t.passed).length;
  const fCount = r.tests.length - pCount;

  const testsHtml = r.tests.length > 0
    ? r.tests.map(t => `
      <div class="tr ${t.passed ? 'tr-ok' : 'tr-fail'}">
        <span class="ti">${t.passed ? '✅' : '❌'}</span>
        <span class="tn">${esc(t.name)}</span>
        ${!t.passed && t.error ? `<div class="te">${esc(t.error)}</div>` : ''}
      </div>`).join('')
    : '<div class="no-test">ℹ️ No assertions recorded for this request</div>';

  const errorBanner = r.error
    ? `<div class="req-error">⛔ Script error: ${esc(r.error)}</div>` : '';

  return `
<div class="rb ${isOk ? 'rb-ok' : 'rb-err'}">
  <div class="rh">
    <span class="ri">${r.index}</span>
    <span class="rm rm-${esc(r.method)}">${esc(r.method)}</span>
    <span class="rname">${esc(r.displayName)}</span>
    ${statusBadge(r.status)}
    <span class="ru">${esc(r.url)}</span>
  </div>
  ${errorBanner}
  <details>
    <summary>📤 Request Headers &amp; Body</summary>
    <div class="panel">
      <div class="panel-section-title">Headers</div>
      ${headerTable(r.reqHeaders)}
      ${r.reqBody ? `
      <div class="panel-section-title" style="margin-top:10px">Body</div>
      <pre class="code">${esc(prettyJson(r.reqBody))}</pre>` : '<em class="muted">No request body</em>'}
    </div>
  </details>
  <details>
    <summary>📥 Response Body</summary>
    <div class="panel">
      ${r.resBody ? `<pre class="code">${esc(prettyJson(r.resBody))}</pre>` : '<em class="muted">No response body captured</em>'}
    </div>
  </details>
  <details open>
    <summary>🧪 Assertions
      <span class="assert-badge assert-ok">${pCount} passed</span>
      ${fCount > 0 ? `<span class="assert-badge assert-fail">${fCount} failed</span>` : ''}
    </summary>
    <div class="tc">${testsHtml}</div>
  </details>
</div>`;
}

// ─── Full HTML ─────────────────────────────────────────────────────────────────
const humanDate = dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
const overallBannerClass = !authOk ? 'overall-auth' : failTests === 0 ? 'overall-ok' : 'overall-fail';
const overallMsg = !authOk
  ? '🔐 Authentication failed — check credentials in your environment file'
  : failTests === 0
    ? '✅ All assertions passed'
    : `❌ ${failTests} assertion(s) failed`;

const authSection = '';

const osdmSection = osdmReqs.length > 0 ? `
<div class="section-title">🚂 OSDM Scenario Steps (${osdmReqs.length} request${osdmReqs.length > 1 ? 's' : ''})</div>
${osdmReqs.map(requestBlock).join('\n')}` : `
<div class="warn-box">⚠️ No OSDM steps were executed. Check that authentication succeeded and credentials are set in your environment file.</div>`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>OTST Report — ${esc(envName)} — ${humanDate}</title>
<style>
*{box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:20px 24px;background:#f0f2f5;color:#222;font-size:14px}
h1{color:#1a3a6b;margin:0 0 10px;font-size:22px}

/* Scenario card */
.scenario-card{background:#1a3a6b;color:#fff;padding:13px 18px;border-radius:8px;margin-bottom:13px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.mi{background:rgba(255,255,255,.15);padding:4px 11px;border-radius:4px;font-size:12px}
.ml{font-weight:700;margin-right:4px}

/* Summary */
.sum{display:flex;gap:10px;margin-bottom:11px}
.sc{flex:1;padding:11px;border-radius:8px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.1);background:#fff}
.sc .n{font-size:26px;font-weight:700}
.sc .l{font-size:11px;color:#888;margin-top:2px}
.sc-req{border-top:3px solid #1565c0}
.sc-all{border-top:3px solid #607d8b}
.sc-ok {border-top:3px solid #4caf50}
.sc-fail{border-top:3px solid #f44336}

/* Overall */
.overall{text-align:center;padding:9px;border-radius:6px;font-weight:700;font-size:13px;margin-bottom:16px}
.overall-ok  {background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7}
.overall-fail{background:#ffebee;color:#c62828;border:1px solid #ef9a9a}
.overall-auth{background:#fff3e0;color:#e65100;border:1px solid #ffcc80}

/* Sections */
.section-title{font-size:13px;font-weight:700;color:#455a64;margin:18px 0 8px;padding:7px 13px;background:#eceff1;border-radius:5px;display:flex;align-items:center;gap:10px}
.section-note{font-weight:400;font-size:12px}
.warn-box{background:#fff3e0;border:1px solid #ffcc80;color:#e65100;padding:11px 15px;border-radius:6px;margin-bottom:12px;font-size:13px}

/* Request blocks */
.rb{background:#fff;border-radius:8px;margin-bottom:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.07)}
.rb-ok {border-left:4px solid #4caf50}
.rb-err{border-left:4px solid #f44336}
.rh{padding:9px 14px;display:flex;align-items:center;gap:8px;background:#fafafa;border-bottom:1px solid #eee;flex-wrap:wrap}
.ri{background:#607d8b;color:#fff;border-radius:50%;min-width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700}
.rm{padding:2px 7px;border-radius:3px;font-weight:700;font-size:11px;flex-shrink:0}
.rm-GET   {background:#e3f2fd;color:#1565c0}
.rm-POST  {background:#e8f5e9;color:#2e7d32}
.rm-PUT   {background:#fff8e1;color:#e65100}
.rm-PATCH {background:#f3e5f5;color:#6a1b9a}
.rm-DELETE{background:#ffebee;color:#c62828}
.rname{font-weight:700;font-size:13px;color:#1a3a6b;flex-shrink:0}
.ru{flex:1;font-family:'Courier New',monospace;font-size:10px;color:#90a4ae;word-break:break-all}
.badge{padding:2px 8px;border-radius:10px;font-weight:700;font-size:12px;flex-shrink:0}
.badge-ok  {background:#e8f5e9;color:#2e7d32}
.badge-err {background:#ffebee;color:#c62828}
.badge-warn{background:#fff8e1;color:#e65100}
.req-error{padding:6px 14px;background:#ffebee;color:#c62828;font-size:12px;border-bottom:1px solid #ffcdd2}

/* Collapsible */
details{border-top:1px solid #eee}
summary{padding:8px 14px;cursor:pointer;font-weight:500;font-size:12px;user-select:none;list-style:none;display:flex;align-items:center;gap:7px;color:#546e7a}
summary::-webkit-details-marker{display:none}
summary::marker{display:none}
summary:hover{background:#f5f5f5}
details[open]>summary{background:#f9f9f9}
.assert-badge{padding:1px 7px;border-radius:9px;font-size:11px;font-weight:700;margin-left:4px}
.assert-ok  {background:#e8f5e9;color:#2e7d32}
.assert-fail{background:#ffebee;color:#c62828}

/* Panels */
.panel{padding:12px 16px;background:#fafafa}
.panel-section-title{font-size:11px;font-weight:700;color:#607d8b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
.muted{font-size:12px;color:#90a4ae;font-style:italic}

/* Header table */
.hdrtbl{border-collapse:collapse;width:100%;font-size:11px;font-family:'Courier New',monospace}
.hdrk{padding:2px 12px 2px 0;color:#607d8b;white-space:nowrap;vertical-align:top}
.hdrv{padding:2px 0;color:#37474f;word-break:break-all}

/* Code */
.code{margin:0;padding:12px 14px;background:#1e1e1e;color:#d4d4d4;font-family:'Courier New',monospace;font-size:11px;max-height:400px;overflow:auto;white-space:pre-wrap;word-break:break-word;line-height:1.5;border-radius:4px}

/* Tests */
.tc{padding:6px 14px 10px}
.no-test{padding:6px 0;font-size:12px;color:#90a4ae;font-style:italic}
.tr{padding:5px 8px;margin:2px 0;border-radius:4px;font-size:12px}
.tr-ok  {background:#f1f8e9;color:#33691e}
.tr-fail{background:#ffebee;color:#b71c1c}
.ti{margin-right:5px}
.tn{font-family:'Segoe UI',Arial,sans-serif}
.te{font-size:11px;margin-top:3px;padding:3px 8px;background:rgba(0,0,0,.06);border-radius:3px;font-family:'Courier New',monospace;word-break:break-all;white-space:pre-wrap}

.foot{text-align:center;color:#bbb;font-size:11px;margin-top:22px;padding-top:10px;border-top:1px solid #e0e0e0}
</style>
</head>
<body>

<h1>🚂 OTST Validation Report</h1>

<div class="scenario-card">
  <div class="mi"><span class="ml">Environment:</span>${esc(envName)}</div>
  <div class="mi"><span class="ml">Date:</span>${humanDate}</div>
  <div class="mi"><span class="ml">OSDM:</span>${esc(meta.osdmVersion || bruSummary.osdmVersion || 'N/A')}</div>
  ${meta.scenarioCode   ? `<div class="mi"><span class="ml">Scenario:</span>${esc(meta.scenarioCode)}</div>`   : ''}
  ${meta.scenarioType   ? `<div class="mi"><span class="ml">Type:</span>${esc(meta.scenarioType)}</div>`       : ''}
  ${meta.scenarioAction ? `<div class="mi"><span class="ml">Action:</span>${esc(meta.scenarioAction)}</div>`   : ''}
</div>

<div class="sum">
  <div class="sc sc-req"><div class="n">${osdmReqs.length}</div><div class="l">OSDM Requests</div></div>
  <div class="sc sc-all"><div class="n">${totalTests}</div><div class="l">Assertions</div></div>
  <div class="sc sc-ok"> <div class="n">${passTests}</div><div class="l">Passed</div></div>
  <div class="sc sc-fail"><div class="n">${failTests}</div><div class="l">Failed</div></div>
</div>

<div class="overall ${overallBannerClass}">${overallMsg}</div>

${authSection}
${osdmSection}

<div class="foot">Generated by OTST Bruno Collection &mdash; ${new Date().toUTCString()}</div>
</body>
</html>`;

// ─── Write ─────────────────────────────────────────────────────────────────────
if (!fs.existsSync(VAL_DIR)) fs.mkdirSync(VAL_DIR, { recursive: true });
fs.writeFileSync(htmlPath, html, 'utf8');
console.log(`[mergeReport] ✅ Report written → ${htmlPath}`);
console.log(`[mergeReport]    ${mergedRequests.length} requests | ${totalTests} assertions | ${passTests} passed | ${failTests} failed`);

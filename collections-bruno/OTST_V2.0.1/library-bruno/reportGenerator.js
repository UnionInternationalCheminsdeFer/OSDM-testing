/*
Copyright UIC, Union Internationale des Chemins de fer
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

No reproduction nor distribution shall be allowed without the following notice
"This material is copyrighted by UIC, Union Internationale des Chemins de fer © 2023 – 2024,
OSDM is a trademark belonging to UIC, and any use of this trademark is strictly prohibited
unless otherwise agreed by UIC."
*/

'use strict';

module.exports = { initReport, appendRequest };

// ─── Lazy native-module accessors ────────────────────────────────────────────
// require('fs') / require('path') are kept INSIDE functions so that this module
// can be loaded in Bruno's default (safe) sandbox without throwing.
// They will throw a clear, actionable error at call time if the sandbox does
// not allow native modules.

function _fs() {
  try {
    return require('fs');
  } catch (_e) {
    throw new Error(
      '[reportGenerator] Native module "fs" is not available. ' +
      'Bruno must be run with developer sandbox enabled:\n' +
      '  CLI  → add flag:  --sandbox=developer\n' +
      '  GUI  → Bruno menu ▸ Preferences ▸ Scripting ▸ Script Sandbox → Developer'
    );
  }
}

function _path() {
  return require('path');
}

// ─── Path helpers ────────────────────────────────────────────────────────────
// __dirname = absolute path to the library-bruno/ directory (reliable on all OS).
// This avoids depending on the library_base env var, which can be a relative
// path ("./library-bruno/") and would resolve against an unpredictable CWD.

function _collectionRoot() {
  return _path().resolve(__dirname, '..');
}

function _validationDir() {
  return _path().join(_collectionRoot(), 'Validation_Reports');
}

function _tmpFile() {
  return _path().join(_validationDir(), '.report_tmp.json');
}

function _htmlFile(envName, dateStr, scenarioCode) {
  // Sanitise scenarioCode for use in a filename (replace any non-safe chars with _)
  const sc = scenarioCode ? '_' + String(scenarioCode).replace(/[^a-zA-Z0-9_-]/g, '_') : '';
  return _path().join(_validationDir(), `${dateStr}_${envName}${sc}_Report.html`);
}

function _ensureDir(dir) {
  const fs = _fs();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Called at the start of a new collection run (when the /offers endpoint is hit).
 * Resets accumulated report data so the HTML file starts fresh.
 * libraryBase parameter kept for backward compatibility but no longer used
 * (path is derived from __dirname instead).
 */
function initReport(libraryBase) {
  try {
    const fs  = _fs();
    const dir = _validationDir();
    _ensureDir(dir);
    const tmp = _tmpFile();
    if (fs.existsSync(tmp)) {
      fs.unlinkSync(tmp);
      console.log('[reportGenerator] 🗑️  Previous run data cleared.');
    }
    console.log('[reportGenerator] ✅ Report directory: ' + dir);
  } catch (e) {
    console.log('[reportGenerator] initReport error: ' + e.message);
  }
}

/**
 * Appends one request/response entry to the accumulated report data,
 * then regenerates the HTML report file.
 *
 * @param {Object} data
 * @param {string}   data.envName          Clean environment name (e.g. "Bileto")
 * @param {string}   data.dateStr          YYYYMMDD string for today
 * @param {string}   [data.scenarioCode]   Scenario code from data file
 * @param {string}   [data.scenarioType]   Scenario type (BOOK, REFUND…)
 * @param {string}   [data.scenarioAction] Scenario action
 * @param {string}   [data.osdmVersion]    OSDM version in use
 * @param {string}   data.requestName      Display name for the request
 * @param {string}   data.requestMethod    HTTP method (GET, POST…)
 * @param {string}   data.requestUrl       Full request URL
 * @param {string}   [data.requestBody]    Serialized request body
 * @param {number}   data.responseStatus   HTTP response status code
 * @param {Object}   [data.responseHeaders]Response headers map
 * @param {string}   [data.responseBody]   Serialized response body
 * @param {Array}    [data.testResults]    [{name, passed, error}]
 * @param {Array}    [data.consoleLogs]    [{level, message}] captured console entries
 * @returns {string|null} Path to the generated HTML file, or null on error
 */
function appendRequest(data) {
  try {
    const fs = _fs();
    _ensureDir(_validationDir());
    const tmpFile = _tmpFile();

    // ── Load existing accumulated data ────────────────────────────────────
    let reportData = { meta: null, requests: [] };
    if (fs.existsSync(tmpFile)) {
      try {
        reportData = JSON.parse(fs.readFileSync(tmpFile, 'utf8'));
      } catch (_e) { /* corrupt tmp → start fresh */ }
    }

    // ── Initialize or update metadata ────────────────────────────────────
    if (!reportData.meta) {
      reportData.meta = {
        envName:        data.envName,
        dateStr:        data.dateStr,
        osdmVersion:    data.osdmVersion    || '',
        scenarioCode:   data.scenarioCode   || '',
        scenarioType:   data.scenarioType   || '',
        scenarioAction: data.scenarioAction || '',
        startedAt:      new Date().toISOString()
      };
    } else {
      // Overwrite scenario fields as they become available (set after 1st /offers call)
      if (data.scenarioCode)   reportData.meta.scenarioCode   = data.scenarioCode;
      if (data.scenarioType)   reportData.meta.scenarioType   = data.scenarioType;
      if (data.scenarioAction) reportData.meta.scenarioAction = data.scenarioAction;
      if (data.osdmVersion)    reportData.meta.osdmVersion    = data.osdmVersion;
    }

    // ── Append request entry ──────────────────────────────────────────────
    const _url = data.requestUrl || '';
    reportData.requests.push({
      requestName:     data.requestName     || '',
      requestMethod:   data.requestMethod   || '',
      requestUrl:      _url,
      requestHeaders:  data.requestHeaders  || {},
      requestBody:     data.requestBody     || '',
      responseStatus:  data.responseStatus  || 0,
      responseHeaders: data.responseHeaders || {},
      responseBody:    data.responseBody    || '',
      responseTime:    data.responseTime    || 0,
      group:           data.group           || 'osdm',
      runType:         data.group === 'auth' ? 'Authentication' : _deriveRunType(_url),
      testResults:     data.testResults     || [],
      consoleLogs:     data.consoleLogs     || [],
      timestamp:       new Date().toISOString()
    });

    // ── Persist accumulated JSON ──────────────────────────────────────────
    fs.writeFileSync(tmpFile, JSON.stringify(reportData, null, 2), 'utf8');

    // ── Generate and write HTML ───────────────────────────────────────────
    // Only generate the visible HTML once scenarioCode is known.
    // Before that (auth/system-info phase), keep accumulating in tmp JSON.
    // This prevents ambiguous files like YYYYMMDD_<Env>_Report.html.
    if (!reportData.meta.scenarioCode) {
      return null;
    }

    const htmlPath = _htmlFile(data.envName, data.dateStr, reportData.meta.scenarioCode);
    fs.writeFileSync(htmlPath, _generateHtml(reportData.meta, reportData.requests), 'utf8');

    return htmlPath;
  } catch (e) {
    console.log('[reportGenerator] appendRequest error: ' + e.message);
    return null;
  }
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function _esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _prettyJson(raw) {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'object') return JSON.stringify(raw, null, 2);
  try { return JSON.stringify(JSON.parse(raw), null, 2); }
  catch (_e) { return String(raw); }
}

function _maskHeaderValue(name, value) {
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

function _statusBadge(status) {
  const cls = (status >= 200 && status < 300) ? 'badge-ok'
            : (status >= 400)                  ? 'badge-err'
            :                                    'badge-warn';
  return `<span class="badge ${cls}">${_esc(status)}</span>`;
}

/**
 * Derives the collection run type from the request URL path.
 * Maps OSDM endpoint patterns to the Bruno folder they belong to.
 */
function _deriveRunType(url) {
  const u = (url || '').toLowerCase().split('?')[0];
  if (/\/versions$/.test(u)) return 'System Information';
  if (/\/coach-deck-layouts(\/[^/]+)?$/.test(u)) return 'System Information';
  if (/\/coach-layouts(\/[^/]+)?$/.test(u)) return 'System Information';
  if (/\/passenger-categories$/.test(u)) return 'System Information';
  if (/\/promotion-codes$/.test(u)) return 'System Information';
  if (/\/reduction-cards$/.test(u)) return 'System Information';
  if (/\/zones$/.test(u)) return 'System Information';
  if (/\/products$/.test(u)) return 'System Information';
  if (/\/products\/[^/]+$/.test(u)) return 'System Information';
  if (/\/product-tags$/.test(u)) return 'System Information';
  if (/\/(refundoffer|refunds?)/.test(u)) return 'Refund';
  if (/\/(exchangeoffer|exchanges?)/.test(u)) return 'Exchange';
  return 'Common Requests';
}

function _headerTable(hdrs) {
  if (!hdrs || !Object.keys(hdrs).length) return '<em class="muted">no headers captured</em>';
  return '<table class="hdrtbl">' +
    Object.entries(hdrs).map(([k, v]) =>
      `<tr><td class="hdrk">${_esc(k)}</td><td class="hdrv">${_esc(_maskHeaderValue(k, v))}</td></tr>`
    ).join('') + '</table>';
}

function _requestBlock(r, i) {
  const displayRequestName = r.runType === 'System Information'
    ? '01-System Infos Requests\\' + (r.requestName || '')
    : (r.requestName || '');
  const tests   = r.testResults || [];
  const logs    = r.consoleLogs || [];
  const pCount  = tests.filter(t => t.passed).length;
  const fCount  = tests.length - pCount;
  const tCount  = tests.length;
  const failRate = tCount > 0 ? fCount / tCount : 0;
  const hasWarningLogs = logs.some(l => {
    const level = l && l.level ? String(l.level).toLowerCase() : '';
    const message = l && l.message != null ? String(l.message).toLowerCase() : '';
    return level === 'warn' || level === 'warning' || message.includes('[warning]');
  });

  // Color class: green = 0 failures, orange = ≤30%, red = >30%
  const colorClass = (fCount === 0) ? 'rc-green'
    : (failRate <= 0.30)            ? 'rc-orange'
    :                                  'rc-red';

  const rspTime = (r.responseTime != null && r.responseTime !== 0) ? r.responseTime + ' ms' : 'N/A';

  // Mini assertion badges shown in the title bar
  const titleBadges = tCount > 0
    ? `<span class="abadge abadge-ok">${pCount} ✅</span>${fCount > 0 ? ` <span class="abadge abadge-fail">${fCount} ❌</span>` : ''}`
    : '';
  const rspCodeClass = (r.responseStatus >= 400 || fCount > 0)
    ? 'rcode-err'
    : (hasWarningLogs || (r.responseStatus >= 300 && r.responseStatus < 400))
      ? 'rcode-warn'
      : 'rcode-ok';
  const titleRspCode = `<span class="rcode ${rspCodeClass}">↩ Rsp-code: ${_esc(r.responseStatus)}</span>`;

  // Summary stats bar (always visible once expanded)
  const summaryHtml = `<div class="req-summary">
    <span class="rsum-ok">✅ Passed: ${pCount}</span>
    <span class="rsum-sep">|</span>
    <span class="rsum-fail">❌ Failed: ${fCount}</span>
    <span class="rsum-sep">|</span>
    <span class="rsum-code">↩ Rsp-code: ${_esc(r.responseStatus)}</span>
    <span class="rsum-sep">|</span>
    <span class="rsum-time">⏱ Response time: ${rspTime}</span>
    <span class="rsum-sep">|</span>
    ${_statusBadge(r.responseStatus)}
    <span class="ru-small">${_esc(r.requestUrl)}</span>
  </div>`;

  // Passed assertions sub-section
  const passedList = tests.filter(t => t.passed);
  const passedItemsHtml = passedList.length > 0
    ? passedList.map(t =>
        `<div class="tr tr-ok"><span class="ti">✅</span><span class="tn">${_esc(t.name)}</span></div>`
      ).join('')
    : '<div class="no-assert">No passed assertions</div>';

  // Failed assertions sub-section
  const failedList = tests.filter(t => !t.passed);
  const failedItemsHtml = failedList.length > 0
    ? failedList.map(t =>
        `<div class="tr tr-fail">
          <span class="ti">❌</span>
          <span class="tn">${_esc(t.name)}</span>
          ${t.error ? `<div class="te">${_esc(t.error)}</div>` : ''}
        </div>`
      ).join('')
    : '<div class="no-assert">No failed assertions 🎉</div>';

  const consoleLogHtml = `<details>
    <summary class="sub-summary">🧾 Console Log (${logs.length})</summary>
    <div class="panel">
      ${logs.length > 0
        ? `<pre class="code">${_esc(logs.map(l => {
            const lvl = l && l.level ? String(l.level).toUpperCase() : 'LOG';
            const msg = l && l.message != null ? String(l.message) : '';
            return `[${lvl}] ${msg}`;
          }).join('\n'))}</pre>`
        : '<p class="muted">No console logs captured for this request</p>'}
    </div>
  </details>`;

  // Request panel
  const reqPanelHtml = `<details>
    <summary class="sub-summary">📤 Request Headers &amp; Body</summary>
    <div class="panel">
      <div class="panel-lbl">Headers</div>
      ${_headerTable(r.requestHeaders || {})}
      ${r.requestBody
        ? `<div class="panel-lbl" style="margin-top:10px">Body</div>
           <pre class="code">${_esc(_prettyJson(r.requestBody))}</pre>`
        : '<p class="muted">No request body</p>'}
    </div>
  </details>`;

  // Response panel
  const resPanelHtml = `<details>
    <summary class="sub-summary">📥 Response Body</summary>
    <div class="panel">
      ${r.responseBody
        ? `<pre class="code">${_esc(_prettyJson(r.responseBody))}</pre>`
        : '<p class="muted">No response body captured</p>'}
    </div>
  </details>`;

  return `
<div class="rb ${colorClass}">
  <details class="req-details">
    <summary class="req-title">
      <span class="ri">${i + 1}</span>
      <span class="rm rm-${_esc(r.requestMethod)}">${_esc(r.requestMethod)}</span>
      <span class="rname">${_esc(displayRequestName)}</span>
      ${titleBadges}
      ${titleRspCode}
      ${rspTime !== 'N/A' ? `<span class="rtime">⏱ ${rspTime}</span>` : ''}
    </summary>
    <div class="req-body">
      ${summaryHtml}
      <details class="assert-section">
        <summary class="assert-title passed-title">✅ Passed validations (${passedList.length})</summary>
        <div class="tc">${passedItemsHtml}</div>
      </details>
      ${failedList.length > 0 ? `
      <details class="assert-section">
        <summary class="assert-title failed-title">❌ Failed validations (${failedList.length})</summary>
        <div class="tc">${failedItemsHtml}</div>
      </details>` : ''}
      ${consoleLogHtml}
      ${reqPanelHtml}
      ${resPanelHtml}
    </div>
  </details>
</div>`;
}

// ─── HTML generation ─────────────────────────────────────────────────────────

function _generateHtml(meta, requests) {
  const humanDate   = (meta.dateStr || '').replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');

  // Split into auth vs OSDM requests
  const authReqs = requests.filter(r => r.group === 'auth');
  const osdmReqs = requests.filter(r => r.group !== 'auth');

  // Count only on OSDM requests (auth failures are expected when credentials are secrets)
  const osdmTests  = osdmReqs.reduce((s, r) => s + (r.testResults || []).length, 0);
  const osdmPassed = osdmReqs.reduce((s, r) => s + (r.testResults || []).filter(t => t.passed).length, 0);
  const osdmFailed = osdmTests - osdmPassed;

  // Auth outcome: did any auth call succeed?
  // When the collection is run via OSCAR, the OAuth token is fetched
  // server-side (runner.js) before Bruno starts, so no auth request is
  // recorded in this run. Treat an empty authReqs list as "auth was
  // handled upstream and is fine" — otherwise the banner falsely reports
  // an auth failure for every successful OSCAR run.
  const authOk = authReqs.length === 0
    || authReqs.some(r => r.responseStatus >= 200 && r.responseStatus < 300);

  const overallPass = authOk && osdmFailed === 0;

  // Derive unique run types present in this run (preserving display order)
   const _runTypeOrder = ['System Information', 'Common Requests', 'Refund', 'Exchange'];
   const _runTypeIcons = { 'System Information': '⚙️', 'Common Requests': '🚂', 'Refund': '💰', 'Exchange': '🔄' };
  const byRunType = {};
  osdmReqs.forEach(r => {
    const rt = r.runType || _deriveRunType(r.requestUrl);
    if (!byRunType[rt]) byRunType[rt] = [];
    byRunType[rt].push(r);
  });
  const activeRunTypes = _runTypeOrder.filter(rt => byRunType[rt] && byRunType[rt].length > 0);

  const authSectionHtml = '';

  // Extract API version from /versions request response
  let apiVersion = 'N/A';
  try {
    const versionReq = requests.find(r => 
      r.requestUrl && r.requestUrl.includes('/versions') &&
      (r.requestName.includes('Version') || r.runType === 'System Information')
    );
    if (versionReq && versionReq.responseStatus >= 200 && versionReq.responseStatus < 300) {
      const respBody = typeof versionReq.responseBody === 'string' 
        ? JSON.parse(versionReq.responseBody) 
        : versionReq.responseBody;
      if (Array.isArray(respBody) && respBody[0] && respBody[0].version) {
        apiVersion = respBody[0].version;
      }
    }
  } catch (_ve) {
    // Keep N/A on parse error
  }

  // Scenario version comes from meta.osdmVersion or 'Null' if not defined
  const scenarioVersion = meta.osdmVersion && meta.osdmVersion !== '' ? meta.osdmVersion : 'Null';

  // Group OSDM requests under their run-type sub-headings
  const osdmSectionHtml = osdmReqs.length > 0
    ? activeRunTypes.map(rt => {
        const rqs  = byRunType[rt];
        const icon = _runTypeIcons[rt] || '🚂';
        const rtTests  = rqs.reduce((s, r) => s + (r.testResults || []).length, 0);
        const rtPassed = rqs.reduce((s, r) => s + (r.testResults || []).filter(t => t.passed).length, 0);
        const rtFailed = rtTests - rtPassed;
        const rtBadge  = rtTests > 0
          ? `<span class="abadge abadge-ok">${rtPassed} passed</span>${rtFailed > 0 ? ` <span class="abadge abadge-fail">${rtFailed} failed</span>` : ''}`
          : '';
        return `
<details class="section-details">
  <summary class="section-title">${icon} ${_esc(rt)} (${rqs.length} request${rqs.length > 1 ? 's' : ''}) ${rtBadge}</summary>
  ${rqs.map((r, i) => _requestBlock(r, i)).join('\n')}
</details>`;
      }).join('\n')
    : `<div class="warn-box">⚠️ No OSDM scenario steps were executed. Check that authentication succeeded and credentials are correctly set in your environment file.</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>OTST Report — ${_esc(meta.envName)} — ${humanDate}</title>
<style>
*{box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:20px 24px;background:#f0f2f5;color:#222;font-size:14px}
h1{color:#1a3a6b;margin:0 0 6px;font-size:22px}

/* Scenario info card */
.scenario-card{background:#1a3a6b;color:#fff;padding:14px 18px;border-radius:8px;margin-bottom:14px}
.scenario-card .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.mi{background:rgba(255,255,255,.15);padding:4px 11px;border-radius:4px;font-size:12px;line-height:1.6}
.ml{font-weight:700;margin-right:4px}

/* Summary row */
.sum{display:flex;gap:12px;margin-bottom:12px}
.sc{flex:1;padding:12px;border-radius:8px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.1)}
.sc .n{font-size:26px;font-weight:700;line-height:1.1}
.sc .l{font-size:11px;opacity:.75;margin-top:3px}
.st{background:#e3f2fd;color:#1565c0}
.sp{background:#e8f5e9;color:#2e7d32}
.sf{background:#ffebee;color:#c62828}

/* Overall banner */
.overall{text-align:center;padding:9px 14px;border-radius:6px;font-weight:700;font-size:13px;margin-bottom:18px}
.overall-ok  {background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7}
.overall-fail{background:#ffebee;color:#c62828;border:1px solid #ef9a9a}
.overall-auth{background:#fff3e0;color:#e65100;border:1px solid #ffcc80}

/* Section headings — collapsible */
.section-details{margin:18px 0 4px;border:none}
.section-details > .section-title{
  font-size:13px;font-weight:700;color:#455a64;padding:8px 12px;
  background:#eceff1;border-radius:5px;display:flex;align-items:center;gap:10px;
  cursor:pointer;user-select:none;list-style:none}
.section-details > .section-title::-webkit-details-marker{display:none}
.section-details > .section-title::marker{display:none}
.section-details > .section-title:hover{background:#e0e5e8}
.section-details[open] > .section-title{border-radius:5px 5px 0 0;background:#dde3e8}
.section-details > .section-title::before{content:'▶';font-size:10px;color:#78909c;transition:transform .15s}
.section-details[open] > .section-title::before{transform:rotate(90deg)}
.section-note{font-weight:400;font-size:12px}

/* Warning box */
.warn-box{background:#fff3e0;border:1px solid #ffcc80;color:#e65100;padding:12px 16px;
  border-radius:6px;margin-bottom:14px;font-size:13px}

/* ── Request block container ──────────────────────────────────────── */
.rb{background:#fff;border-radius:8px;margin-bottom:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.07)}
/* Color coding: left border by assertion outcome */
.rc-green {border-left:5px solid #4caf50}
.rc-orange{border-left:5px solid #ff9800}
.rc-red   {border-left:5px solid #f44336}

/* ── Clickable request title ────────────────────────────────────────── */
.req-details{border:none}
.req-title{
  padding:9px 14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;
  cursor:pointer;user-select:none;list-style:none;border-bottom:1px solid #eee;
  font-size:13px}
.req-title::-webkit-details-marker{display:none}
.req-title::marker{display:none}
.rc-green  .req-title{background:#f2faf2}
.rc-orange .req-title{background:#fffbf2}
.rc-red    .req-title{background:#fff5f5}
.rc-green  .req-title:hover{background:#e8f5e9}
.rc-orange .req-title:hover{background:#fff3e0}
.rc-red    .req-title:hover{background:#ffebee}
.req-details[open] .req-title{border-bottom:2px solid #e0e0e0}
.req-title::before{content:'▶';font-size:9px;color:#90a4ae;transition:transform .15s;flex-shrink:0}
.req-details[open] .req-title::before{transform:rotate(90deg)}

/* ── Request body (detail view) ─────────────────────────────────────── */
.req-body{}

/* Summary stats bar */
.req-summary{
  display:flex;flex-wrap:wrap;gap:12px;align-items:center;
  padding:7px 14px;background:#f9f9f9;border-bottom:1px solid #eee;
  font-size:12px;font-weight:600}
.rsum-ok  {color:#2e7d32}
.rsum-fail{color:#c62828}
.rsum-time{color:#607d8b;font-weight:400}
.rsum-sep {color:#ccc}
.ru-small{flex:1;font-family:'Courier New',monospace;font-size:10px;
  word-break:break-all;color:#90a4ae;font-weight:400}
.rtime{font-size:11px;font-weight:500;color:#607d8b;white-space:nowrap;
  background:#eceff1;padding:1px 7px;border-radius:9px;flex-shrink:0}
.rcode{font-size:11px;font-weight:700;white-space:nowrap;padding:1px 7px;border-radius:9px;flex-shrink:0}
.rcode-ok{background:#e8f5e9;color:#2e7d32}
.rcode-err{background:#ffebee;color:#c62828}
.rcode-warn{background:#fff8e1;color:#e65100}

/* ── Assert sub-sections ────────────────────────────────────────────── */
.assert-section{border-top:1px solid #f0f0f0}
.assert-title{
  padding:7px 14px;font-weight:600;font-size:12px;cursor:pointer;
  user-select:none;list-style:none;display:flex;align-items:center;gap:6px}
.assert-title::-webkit-details-marker{display:none}
.assert-title::marker{display:none}
.passed-title{color:#2e7d32;background:#f9fbf9}
.passed-title:hover{background:#f1f8e9}
.failed-title{color:#c62828;background:#fff9f9}
.failed-title:hover{background:#ffebee}

/* ── Sub-panels (req/resp headers+body) ─────────────────────────────── */
.sub-summary{
  padding:7px 14px;cursor:pointer;font-weight:500;font-size:12px;user-select:none;
  list-style:none;display:flex;align-items:center;gap:6px;color:#546e7a;flex-wrap:wrap;
  background:#fafafa}
.sub-summary::-webkit-details-marker{display:none}
.sub-summary::marker{display:none}
.sub-summary:hover{background:#f0f0f0}

/* ── Shared inner elements ──────────────────────────────────────────── */
.ri{background:#607d8b;color:#fff;border-radius:50%;width:21px;height:21px;display:flex;align-items:center;
  justify-content:center;font-size:10px;flex-shrink:0;font-weight:700}
.rm{padding:2px 7px;border-radius:3px;font-weight:700;font-size:11px;flex-shrink:0}
.rm-GET   {background:#e3f2fd;color:#1565c0}
.rm-POST  {background:#e8f5e9;color:#2e7d32}
.rm-PUT   {background:#fff8e1;color:#e65100}
.rm-PATCH {background:#f3e5f5;color:#6a1b9a}
.rm-DELETE{background:#ffebee;color:#c62828}
.rname{font-weight:700;flex-shrink:0;color:#1a3a6b}
.badge{padding:2px 8px;border-radius:10px;font-weight:700;font-size:12px;flex-shrink:0}
.badge-ok  {background:#e8f5e9;color:#2e7d32}
.badge-err {background:#ffebee;color:#c62828}
.badge-warn{background:#fff8e1;color:#e65100}
.abadge{padding:1px 7px;border-radius:9px;font-size:11px;font-weight:700;margin-left:2px}
.abadge-ok  {background:#e8f5e9;color:#2e7d32}
.abadge-fail{background:#ffebee;color:#c62828}

/* Panel content */
.panel{padding:12px 16px;background:#fafafa}
.panel-lbl{font-size:10px;font-weight:700;color:#607d8b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px}
.muted{font-size:12px;color:#90a4ae;font-style:italic;margin:4px 0}
.hdrtbl{border-collapse:collapse;width:100%;font-size:11px;font-family:'Courier New',monospace}
.hdrk{padding:2px 14px 2px 0;color:#607d8b;white-space:nowrap;vertical-align:top;font-weight:600}
.hdrv{padding:2px 0;color:#37474f;word-break:break-all}

/* Code blocks */
.code{margin:0;padding:12px 16px;background:#1e1e1e;color:#d4d4d4;font-family:'Courier New',monospace;
  font-size:11px;overflow-x:auto;max-height:400px;overflow-y:auto;white-space:pre-wrap;
  word-break:break-word;line-height:1.5}

/* Test result rows */
.tc{padding:6px 14px 8px}
.no-assert{padding:6px 14px 8px;font-size:12px;color:#90a4ae;font-style:italic}
.tr{padding:5px 9px;margin:3px 0;border-radius:4px;font-size:12px;display:flex;flex-direction:column}
.tr-ok  {background:#f1f8e9;color:#33691e}
.tr-fail{background:#ffebee;color:#b71c1c}
.ti{margin-right:6px}
.te{font-size:11px;margin-top:3px;padding:3px 8px;background:rgba(0,0,0,.06);border-radius:3px;
  font-family:'Courier New',monospace;word-break:break-all;white-space:pre-wrap}

/* Legend */
.legend{background:#fff;border-radius:7px;padding:11px 16px;margin-bottom:16px;
  font-size:12px;color:#546e7a;border:1px solid #e0e0e0}
.legend b{color:#37474f}

/* Color legend */
.color-legend{display:flex;gap:16px;flex-wrap:wrap;margin-top:6px}
.cl-item{display:flex;align-items:center;gap:6px;font-size:11px}
.cl-dot{width:12px;height:12px;border-radius:50%;flex-shrink:0}
.cl-green {background:#4caf50}
.cl-orange{background:#ff9800}
.cl-red   {background:#f44336}

/* Footer */
.foot{text-align:center;color:#bbb;font-size:11px;margin-top:20px;padding-top:10px;border-top:1px solid #e0e0e0}
</style>
</head>
<body>

<h1><img src="/oscar-icon.svg" alt="OSCAR" style="height:32px;vertical-align:middle;margin-right:10px">OTST Validation Report</h1>

<div class="scenario-card">
  <div class="row">
    <div class="mi"><span class="ml">Date:</span>${humanDate}</div>
    <div class="mi"><span class="ml">Environment:</span>${_esc(meta.envName)}</div>
    <div class="mi"><span class="ml">API Version:</span>${_esc(apiVersion)}</div>
    <div class="mi"><span class="ml">Scenario Version:</span>${_esc(scenarioVersion)}</div>
    <div class="mi"><span class="ml">Scenario:</span>${_esc(meta.scenarioCode || 'N/A')}</div>
    ${activeRunTypes.length > 0 ? `<div class="mi"><span class="ml">Collection run:</span>${activeRunTypes.map(rt => _esc(rt)).join(' + ')}</div>` : ''}
    ${meta.scenarioType ? `<div class="mi"><span class="ml">Type:</span>${_esc(meta.scenarioType)}</div>` : ''}
  </div>
</div>

<div class="sum">
  <div class="sc st"><div class="n">${osdmReqs.length}</div><div class="l">OSDM Requests</div></div>
  <div class="sc st"><div class="n">${osdmTests}</div><div class="l">OSDM Assertions</div></div>
  <div class="sc sp"><div class="n">${osdmPassed}</div><div class="l">Passed</div></div>
  <div class="sc sf"><div class="n">${osdmFailed}</div><div class="l">Failed</div></div>
</div>

<div class="overall ${overallPass ? 'overall-ok' : (!authOk ? 'overall-auth' : 'overall-fail')}">
  ${!authOk
    ? '🔐 Authentication failed — check credentials in your environment file'
    : (osdmFailed === 0
        ? '✅ All OSDM assertions passed'
        : `❌ ${osdmFailed} OSDM assertion(s) failed`)}
</div>

<div class="legend">
  <b>ℹ️ About these assertions:</b> Each request shows the full set of business assertions (offer found, booking created, refund valid…)
  plus two global OSDM compliance checks on every response:
  <b>[OSDM] Content-Type is application/json</b> — every non-empty response must be JSON &nbsp;|&nbsp;
  <b>[OSDM] Error body is a valid RFC 9457 Problem object</b> — error responses (4xx/5xx) must include a structured Problem object.
  <div class="color-legend">
    <div class="cl-item"><div class="cl-dot cl-green"></div> All assertions passed (0% failures)</div>
    <div class="cl-item"><div class="cl-dot cl-orange"></div> 1–30% of assertions failed</div>
    <div class="cl-item"><div class="cl-dot cl-red"></div> More than 30% of assertions failed</div>
  </div>
</div>

${authSectionHtml}
${osdmSectionHtml}

<div class="foot">
  Generated by OTST Bruno Collection &mdash; ${new Date().toUTCString()}
</div>

</body>
</html>`;
}

// Expose globally if needed
try { Object.assign(globalThis, module.exports); } catch (_e) { /* no-op */ }

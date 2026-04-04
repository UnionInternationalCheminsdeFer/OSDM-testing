/*
  testCapture.js — OTST shared test helper
  =========================================
  Provides bruTest(name, fn) as a drop-in replacement for test(name, fn).

  In addition to registering the assertion with Bruno's own test runner,
  it accumulates results in bru.setVar('__rptTests') so the global
  after-response can read ALL assertions and include them in the HTML report.

  bru.setVar() is shared across ALL script phases for a single request
  (before-request, local scripts, after-response) — this is how we bridge
  the per-request test results to the global after-response.

  Usage in library files:
    const { bruTest } = require('./testCapture.js');
    bruTest(`Status code is 200`, () => { expect(res.getStatus()).to.eql(200); });
*/

'use strict';

module.exports = { bruTest, resetTests };

/**
 * Drop-in replacement for Bruno's test(name, fn).
 * Registers the assertion with Bruno AND stores result in bru.setVar.
 * Also emits an [INFO] / [WARNING] log via validationLogger so the outcome
 * is visible in the Bruno console according to the loggingType env var:
 *   loggingType=INFO  → both ✅ passes and ❌ failures are printed
 *   loggingType=WARN  → only ❌ failures are printed
 *   loggingType=FULL  → everything is printed
 */
function bruTest(name, fn) {
  let passed = true;
  let errMsg = null;

  // Run assertion to determine pass/fail
  try {
    if (typeof fn === 'function') fn();
  } catch (e) {
    passed = false;
    errMsg = (e && e.message) ? e.message : String(e);
  }

  // Emit INFO / WARNING log via validationLogger (respects loggingType env var)
  try {
    const { validationLogger } = require('./displays.js');
    if (passed) {
      validationLogger(`[INFO] ✅ ${name}`);
    } else {
      validationLogger(`[WARNING] ❌ ${name}${errMsg ? ': ' + errMsg : ''}`);
    }
  } catch (_le) { /* displays.js not available — safe to ignore */ }

  // Accumulate in bru.setVar (shared across all script phases for this request)
  try {
    const existing = JSON.parse(bru.getVar('__rptTests') || '[]');
    existing.push({ name: String(name), passed, error: errMsg });
    bru.setVar('__rptTests', JSON.stringify(existing));
  } catch (_e) { /* bru not available in unit tests — safe to ignore */ }

  // Register with Bruno's own test runner (for Bruno UI / CLI output)
  // Pass a function that re-throws on failure so Bruno records it correctly
  const _err = errMsg;
  test(String(name), function () {
    if (!passed) throw new Error(_err || String(name) + ' failed');
  });
}

/**
 * Called at the start of each request (global before-request) to reset
 * the accumulator for a clean slate.
 */
function resetTests() {
  try {
    bru.setVar('__rptTests', '[]');
  } catch (_e) { /* safe to ignore */ }
}

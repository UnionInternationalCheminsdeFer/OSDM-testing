/**
 * loopback.js — Multi-scenario loopback helper
 *
 * When a request fails mid-scenario (HTTP error, JSON parse error, etc.),
 * this helper checks whether more scenarios remain in the run.
 *   - If YES  -> loops back to "01. POST Get Offer" for the next scenario.
 *   - If NO   -> calls stopExecution() to end the run.
 *
 * Usage (inside a .yml after-response script):
 *   const { loopbackOrStop } = require(bru.getEnvVar("library_base") + "loopback.js");
 *   loopbackOrStop("POST Create Booking");
 *   return;   // <-- important: exit the script cleanly after calling this
 */

function loopbackOrStop(label) {
  const _scList    = JSON.parse(bru.getEnvVar('__scenariosList') || '[]');
  const _scNextIdx = parseInt(bru.getEnvVar('scenariosToRunIndex') || '0', 10);

  if (_scList.length > 0 && _scNextIdx < _scList.length) {
    console.log(
      '\u{1F504} ' + label + ' failed \u2014 skipping to scenario [' +
      (_scNextIdx + 1) + '/' + _scList.length + ']: ' + _scList[_scNextIdx]
    );
    bru.setEnvVar('__loopback', 'true');
    bru.runner.setNextRequest('01. POST Get Offer');
  } else {
    console.log('\u2705 All scenarios attempted \u2014 run finished');
    bru.runner.stopExecution();
  }
}

module.exports = { loopbackOrStop };

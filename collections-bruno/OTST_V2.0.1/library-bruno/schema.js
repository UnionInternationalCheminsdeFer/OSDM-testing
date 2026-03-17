/*
Copyright UIC, Union Internationale des Chemins de fer
Licensed under the Apache License, Version 2.0 (the "License");
http://www.apache.org/licenses/LICENSE-2.0
*/

const schemaData = {
  OSDM_OFFER_SCHEMA: ""
};

module.exports = { schemaData };

// Also expose globally for convenience (optional)
try {
  Object.assign(globalThis, { schemaData });
} catch (e) {
  // no-op
}

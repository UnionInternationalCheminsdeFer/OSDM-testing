// Import needed library files
const validators = require('./validators.js');
const models = require('./model.js');

const uuid = require('uuid');

module.exports = {
  getScenarioData,
  parseScenarioData,
  osdmTripSearchCriteria,
  osdmTripSpecification,
  osdmOfferSearchCriteria,
  osdmFulfillmentOptions
};

// Returns null for empty / "null" strings, otherwise returns the value as-is
const nullIfEmpty = v => (v == null || v === '' || v === 'null') ? null : v;

// Zero-pad a number to 2 digits
const pad = n => String(n).padStart(2, '0');

// Returns the ISO date string for today + plusDays
function getTripDate(plusDays = 10) {
  const d = new Date();
  d.setDate(d.getDate() + plusDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Helper: GET JSON via Bruno's sendRequest
function getJson(url) {
  return new Promise((resolve, reject) => {
    bru.sendRequest({ url, method: "GET", proxy: false }, function (err, res) {
      if (err) return reject(err);
      const status = res.status || res.statusCode || 200;
      if (status < 200 || status >= 300) {
        return reject(new Error(`HTTP ${status} for ${url}`));
      }
      try {
        const body = res.data;
        const json = typeof body === "string" ? JSON.parse(body) : body;
        resolve(json);
      } catch (e) {
        reject(e);
      }
    });
  });
}

// Wrapper to validate data file JSON (uses global or validators module)
async function validateDataFileJsonWithTemplateSafe(json) {
  if (typeof validateDataFileJsonWithTemplate === "function") {
    return validateDataFileJsonWithTemplate(json);
  }
  try {
    const validators = require("./validators.js");
    if (validators && typeof validators.validateJsonWithTemplate === "function") {
      return validators.validateJsonWithTemplate(json);
    }
  } catch (e) {
    // ignore if validators not found; optional validation
  }
  // If no validator is available, just continue
}

// Function to get scenario data
async function getScenarioData() {
  validationLogger("[DEBUG] 🪲 getScenarioData");
  validationLogger("[INFO] ⏳ Getting scenario data");

  const hasDataFile = bru.getEnvVar('data_file') != null && bru.getEnvVar('data_file') !== '';

  if (!hasDataFile) {
    const dataBase = bru.getEnvVar("data_base");
    validationLogger("[INFO] 🌐 Data file was not set, grabbing data base url from environment : " + dataBase);

    if (!/^https?:\/\//i.test(String(dataBase || ""))) {
      throw new Error(`data_base must be an absolute http(s) URL. Got: ${dataBase}`);
    }

    try {
      const jsonData = await getJson(dataBase);
      bru.setEnvVar("data_base_tmp", jsonData);

      // Validate JSON with template
      validationLogger(`[INFO] 🛠️ Check data file structure schema`);
      await validateDataFileJsonWithTemplateSafe(bru.getEnvVar("data_base_tmp"));

      validationLogger("[DEBUG] 🪲 getScenarioData after fetch");
      parseScenarioData(jsonData);
    } catch (err) {
      validationLogger(`[ERROR] ${err && err.message ? err.message : err}`);
      throw err;
    }
  } else {
    const dataStr = bru.getEnvVar("data_file");
    const json = typeof dataStr === 'string' ? JSON.parse(dataStr) : dataStr;

    // Validate JSON with template
    await validateDataFileJsonWithTemplateSafe(json);

    validationLogger("[INFO] Data file was set, expecting running in postman/bruno from env");
    parseScenarioData(json);
  }
}

// Function to parse scenario data from JSON
function parseScenarioData(jsonData) {
  const nextWeekdayString = getTripDate(parseInt(bru.getEnvVar("departureDateFromToday")) || 10);
  const scenarioCode = bru.getEnvVar("scenarioCode");

  const scenario = (jsonData.scenarios || []).find(s => s.code === scenarioCode);

  if (!scenario) {
    validationLogger(`[ERROR] ⛔ Scenario code "${scenarioCode}" not found, please check`);
    throw new Error(`Scenario code "${scenarioCode}" not found`);
  }

  // Set environment variables for the scenario
  bru.setEnvVar("loggingType",            nullIfEmpty(scenario.loggingType));
  bru.setEnvVar("scenarioCode",           scenario.code);
  bru.setEnvVar("scenarioType",           nullIfEmpty(scenario.scenarioType));
  bru.setEnvVar("scenarioAction",         nullIfEmpty(scenario.scenarioAction));
  bru.setEnvVar("osdmVersion",            nullIfEmpty(scenario.osdmVersion));
  bru.setEnvVar("desiredFlexibility",     nullIfEmpty(scenario.desiredFlexibility));
  bru.setEnvVar("accommodationSelection", nullIfEmpty(scenario.accommodationSelection));
  bru.setEnvVar("requiresPlaceSelection", nullIfEmpty(scenario.requiresPlaceSelection));
  bru.setEnvVar("overruleCode",           nullIfEmpty(scenario.overruleCode));
  bru.setEnvVar("refundDate",             nullIfEmpty(scenario.refundDate));

  validationLogger("[INFO] ✅ Correct data set was found for scenario : " + scenarioCode);

  // Trip requirements
  jsonData.tripRequirements?.some(tripRequirement => {
    if (tripRequirement.id !== scenario.tripRequirementId) return false;
    bru.setEnvVar("TripType", tripRequirement.tripType);

    switch (tripRequirement.tripType) {
      case "SPECIFICATION": {
        validationLogger('[INFO] ⏳ processing a specification');
        const legDefinitions = tripRequirement.legs.map((leg, legIndex) => {
          const legPrefix = `leg${legIndex + 1}`;
          const startDatetime = leg.startDatetime.replace("%TRIP_DATE%", nextWeekdayString);
          const endDatetime   = leg.endDatetime.replace("%TRIP_DATE%", nextWeekdayString);

          bru.setEnvVar(`${legPrefix}StartStopPlaceRef`,       leg.origin);
          bru.setEnvVar(`${legPrefix}EndStopPlaceRef`,         leg.destination);
          bru.setEnvVar(`${legPrefix}StartDatetime`,           startDatetime);
          bru.setEnvVar(`${legPrefix}EndDatetime`,             endDatetime);
          bru.setEnvVar(`${legPrefix}VehicleNumber`,           leg.vehicleNumber);
          bru.setEnvVar(`${legPrefix}OperatorCode`,            leg.operatorCode);
          bru.setEnvVar(`${legPrefix}ProductCategoryRef`,      leg.productCategoryRef      || null);
          bru.setEnvVar(`${legPrefix}ProductCategoryName`,     leg.productCategoryName     || null);
          bru.setEnvVar(`${legPrefix}ProductCategoryShortName`, leg.productCategoryShortName || null);

          return new TripLegDefinition(
            leg.origin, startDatetime, leg.destination, endDatetime,
            leg.productCategoryRef, leg.productCategoryName, leg.productCategoryShortName,
            leg.vehicleNumber, leg.operatorCode
          );
        });
        osdmTripSpecification(legDefinitions);
        break;
      }
      case "SEARCH": {
        validationLogger('[INFO] ⏳ processing a search');
        const trip = tripRequirement.trip;
        bru.setEnvVar("tripStartStopPlaceRef",       trip.origin);
        bru.setEnvVar("tripEndStopPlaceRef",         trip.destination);
        bru.setEnvVar("tripStartDatetime",           trip.startDatetime.replace("%TRIP_DATE%", nextWeekdayString));
        bru.setEnvVar("tripEndDatetime",             trip.endDatetime.replace("%TRIP_DATE%", nextWeekdayString));
        bru.setEnvVar("tripVehicleNumber",           trip.vehicleNumber);
        bru.setEnvVar("tripOperatorCode",            trip.operatorCode);
        bru.setEnvVar("tripProductCategoryRef",      trip.productCategoryRef      || null);
        bru.setEnvVar("tripProductCategoryName",     trip.productCategoryName     || null);
        bru.setEnvVar("tripProductCategoryShortName", trip.productCategoryShortName || null);
        osdmTripSearchCriteria([
          new TripLegDefinition(
            trip.origin,      trip.startDatetime.replace("%TRIP_DATE%", nextWeekdayString),
            trip.destination, trip.endDatetime.replace("%TRIP_DATE%", nextWeekdayString),
            trip.productCategoryRef, trip.productCategoryName, trip.productCategoryShortName,
            trip.vehicleNumber, trip.operatorCode
          )
        ]);
        break;
      }
    }
    return true;
  });

  // Purchaser details
  const firstPurchaserList = jsonData.purchaserList?.[0];
  if (firstPurchaserList) {
    validationLogger('[INFO] Found number of purchaser: ' + firstPurchaserList.purchaser.length);
    const osdmVersion = parseFloat(bru.getEnvVar("osdmVersion"));
    const purchaserSpec = firstPurchaserList.purchaser.map(purchaser => {
      if (osdmVersion >= 3.4) {
        return new PurchaserContact(
          new DetailContact(
            purchaser.purchaserFirstName, purchaser.purchaserLastName,
            new Contact(purchaser.purchaserEmail, purchaser.purchaserPhoneNumber)
          )
        );
      }
      return new Purchaser(
        new Detail(
          purchaser.purchaserFirstName, purchaser.purchaserLastName,
          purchaser.purchaserEmail, purchaser.purchaserPhoneNumber
        )
      );
    });
    validationLogger('[INFO] Pushed purchaserSpec to environment: ' + JSON.stringify(purchaserSpec));
    bru.setEnvVar("bookingPurchaserSpecifications", JSON.stringify(purchaserSpec[0]));
  }

  // Passengers
  jsonData.passengersList?.some(passengersList => {
    if (passengersList.id !== scenario.passengersListId) return false;

    validationLogger('[INFO] Found number of passengers: ' + passengersList.passengers.length);
    bru.setEnvVar("offerPassengerNumber", passengersList.passengers.length);

    const osdmVersion = parseFloat(bru.getEnvVar("osdmVersion"));
    const offerPassengerSpecs = [];
    const passengerSpecs     = [];
    const passengerReferences = [];
    const passengerAdditionalData = [];

    passengersList.passengers.forEach(passenger => {
      offerPassengerSpecs.push(new AnonymousPassengerSpec(
        passenger.reference, passenger.type, passenger.dateOfBirth, passenger.gender || null
      ));

      const detail = osdmVersion > 3.4
        ? new DetailContact(passenger.firstName, passenger.lastName,
            new Contact(passenger.email || null, passenger.phoneNumber || null))
        : new Detail(passenger.firstName, passenger.lastName,
            passenger.email || null, passenger.phoneNumber || null);

      passengerSpecs.push(new PassengerSpec(
        passenger.reference, passenger.type, passenger.dateOfBirth,
        passenger.gender ?? "X", detail
      ));

      passengerReferences.push(passenger.reference);

      const defaults = {
        updateFirstName:   passenger.firstName,
        updateLastName:    passenger.lastName,
        updateDateOfBirth: passenger.dateOfBirth,
        updateEmail:       passenger.email,
        updatePhoneNumber: passenger.phoneNumber,
        updateGender:      passenger.gender ?? "X",
      };

      passengerAdditionalData.push({
        updateFirstName:   passenger.updateFirstName   ?? defaults.updateFirstName,
        updateLastName:    passenger.updateLastName    ?? defaults.updateLastName,
        updateDateOfBirth: passenger.updateDateOfBirth ?? defaults.updateDateOfBirth,
        updateEmail:       passenger.updateEmail       ?? defaults.updateEmail,
        updatePhoneNumber: passenger.updatePhoneNumber ?? defaults.updatePhoneNumber,
        updateGender:      passenger.updateGender      ?? defaults.updateGender,
      });

      const hasNoUpdates = [
        passenger.updateFirstName, passenger.updateLastName, passenger.updateDateOfBirth,
        passenger.updateEmail, passenger.updatePhoneNumber, passenger.updateGender
      ].every(v => v == null);
      if (hasNoUpdates) bru.setEnvVar("skipPatchPassengerRequest", "true");
    });

    validationLogger('[INFO] Pushed passengerSpec to environment: ' + JSON.stringify(passengerSpecs));
    bru.setEnvVar("offerPassengerSpecifications",  JSON.stringify(offerPassengerSpecs));
    bru.setEnvVar("bookingPassengerSpecifications", JSON.stringify(passengerSpecs));
    bru.setEnvVar("bookingPassengerReferences",     JSON.stringify(passengerReferences));
    bru.setEnvVar("passengerAdditionalData",        JSON.stringify(passengerAdditionalData));

    passengerAdditionalData.forEach((data, index) => {
      Object.entries(data).forEach(([key, value]) => bru.setEnvVar(`${key}_${index}`, value));
    });
    return true;
  });

  // Offer search criteria
  const offerSearchCriteriaList = jsonData.offerSearchCriteriaList || [];
  if (offerSearchCriteriaList.length === 0) {
    validationLogger("[ERROR] offerSearchCriteriaList is empty or not an array.");
  } else {
    offerSearchCriteriaList.some(item => {
      if (item.id !== scenario.offerSearchCriteriaListId) return false;
      const criteria = (item.offerSearchCriteria || [])[0];
      if (criteria) {
        osdmOfferSearchCriteria(
          criteria.currency          || null,
          criteria.offerMode         || null,
          criteria.requestedOfferParts,
          criteria.flexibilities     || null,
          criteria.serviceClass      || null,
          criteria.travelClass       || null,
          null
        );
      } else {
        validationLogger(`[WARN] No offerSearchCriteria found for ID '${item.id}'`);
      }
      return true;
    });
  }

  // Requested fulfillment options
  const fulfillmentOptionsList = jsonData.requestedFulfillmentOptionsList || [];
  if (fulfillmentOptionsList.length === 0) {
    validationLogger("[INFO] requestedFulfillmentOptionsList is empty");
  } else {
    fulfillmentOptionsList.some(list => {
      if (list.id !== scenario.requestedFulfillmentOptionsListId) return false;
      const options = list.requestedFulfillmentOptions
        .filter(o => o.fulfillmentType != null && o.fulfillmentMedia != null)
        .map(o => new FulfillmentOption(o.fulfillmentType, o.fulfillmentMedia));
      osdmFulfillmentOptions(options);
      return true;
    });
  }
}

// Function to set trip search criteria
function osdmTripSearchCriteria(legDefinitions) {
  test('Trip Search Criteria has at least one leg', () => {
    expect(legDefinitions).to.be.an("array");
    expect(legDefinitions.length).to.be.above(0);
  });

  if (legDefinitions.length > 1) {
    validationLogger("[WARNING] TripSearchCriteria currently doesn't generate via points when multiple legs are provided");
  }

  const legDef = legDefinitions[0];
  const startDateTime = legDef.startDateTime.substring(0, legDef.startDateTime.length - 6);
  const origin = new StopPlaceRef(legDef.startStopPlaceRef);
  const destination = new StopPlaceRef(legDef.endStopPlaceRef);

  const sandbox = bru.getEnvVar("api_base") || "";
  const carrierFilter = legDef.carrier ? new CarrierFilter([legDef.carrier], false) : null;
  const tripParameters = sandbox.includes("paxone")
    ? null
    : new TripParameters(new TripDataFilter(carrierFilter, new VehicleFilter([legDef.vehicleNumber], null, false)));

  bru.setEnvVar("offerTripSearchCriteria", JSON.stringify(
    new TripSearchCriteria(startDateTime, origin, destination, tripParameters)
  ));
}

// Function to set trip specifications
function osdmTripSpecification(legDefinitions) {
  test('Trip Specification has at least one leg', () => {
    expect(legDefinitions).to.be.an("array");
    expect(legDefinitions.length).to.be.above(0);
  });

  bru.setEnvVar(TRIP.EXTERNAL_REF, uuid.v4());

  const legSpecs = legDefinitions.map((legDef, i) => {
    const legKey = TRIP.LEG_SPECIFICATION_REF_PATTERN.replace("%LEG_COUNT%", i + 1);
    bru.setEnvVar(legKey, uuid.v4());

    const productCategory = legDef.productCategoryRef == null
      ? null
      : new ProductCategory(legDef.productCategoryRef, legDef.productCategoryName, legDef.productCategoryShortName);

    return new TripLegSpecification(
      bru.getEnvVar(legKey),
      new TimedLegSpecification(
        new BoardSpecification(new StopPlaceRef(legDef.startStopPlaceRef), new ServiceTime(legDef.startDateTime)),
        new AlignSpecification(new StopPlaceRef(legDef.endStopPlaceRef),   new ServiceTime(legDef.endDateTime)),
        new DatedJourney(productCategory, [legDef.vehicleNumber], [new NamedCompany(legDef.carrier)])
      )
    );
  });

  bru.setEnvVar("offerTripSpecifications", JSON.stringify([
    new TripSpecification(bru.getEnvVar(TRIP.EXTERNAL_REF), legSpecs)
  ]));
}

// Function to set offer search criteria
function osdmOfferSearchCriteria(
  currency,
  offerMode,
  offerParts,
  flexibilities,
  serviceClassTypes,
  travelClasses,
  productTags,
) {
  const offerSearchCriteria = {};

  if (currency != null && currency !== '') {
    offerSearchCriteria.currency = currency;
  }
  if (offerMode != null && offerMode !== '') {
    offerSearchCriteria.offerMode = offerMode;
  }
  if (Array.isArray(offerParts) && offerParts.length > 0) {
    offerSearchCriteria.requestedOfferParts = offerParts;
  }
  if (Array.isArray(flexibilities) && flexibilities.length > 0) {
    offerSearchCriteria.flexibilities = flexibilities;
  }
  if (Array.isArray(serviceClassTypes) && serviceClassTypes.length > 0) {
    offerSearchCriteria.serviceClassTypes = serviceClassTypes;
  }
  if (Array.isArray(travelClasses) && travelClasses.length > 0) {
    offerSearchCriteria.travelClasses = travelClasses;
  }

  bru.setEnvVar("offerSearchCriteria", JSON.stringify(offerSearchCriteria));
}

// Function to set fulfillment options
function osdmFulfillmentOptions(requestedFulfillmentOptions) {
  if (Array.isArray(requestedFulfillmentOptions) && requestedFulfillmentOptions.length > 0) {
    bru.setEnvVar("offerFulfillmentOptions", JSON.stringify(requestedFulfillmentOptions));
  }
}

// Expose globally for convenience
try {
  Object.assign(globalThis, module.exports);
} catch (e) {
  // no-op
}

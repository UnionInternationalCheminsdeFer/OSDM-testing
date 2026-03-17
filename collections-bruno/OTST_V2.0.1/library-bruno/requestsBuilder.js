module.exports = {
  buildOfferCollectionRequest,
  buildBookingRequest,
  accommodationAndPlaceSelection,
  requestRefundOffersBody,
  requestExchangeOffersBody,
  requestExchangeOperationsBody
};

// Function to build the offer collection request
function buildOfferCollectionRequest() {
  validationLogger("[INFO] ➤ buildOfferCollectionRequest");
  const tripType = bru.getEnvVar("TripType");
  const sandbox = bru.getEnvVar("api_base") || "";
  const isPaxone = sandbox.includes("paxone");
  validationLogger("[INFO] Build using TripType: " + tripType);

  const body = {};

  if (!isPaxone) {
    body.objectType = "OfferCollectionRequest";
  }

  if (tripType === "SPECIFICATION") {
    body.tripSpecifications = JSON.parse(bru.getEnvVar("offerTripSpecifications"));
  } else if (tripType === "SEARCH") {
    body.tripSearchCriteria = JSON.parse(bru.getEnvVar("offerTripSearchCriteria"));
  }

  body.anonymousPassengerSpecifications = JSON.parse(bru.getEnvVar("offerPassengerSpecifications"));
  body.offerSearchCriteria = JSON.parse(bru.getEnvVar("offerSearchCriteria"));

  const fulfillmentOptions = bru.getEnvVar("offerFulfillmentOptions");
  if (!isPaxone || fulfillmentOptions) {
    body.requestedFulfillmentOptions = JSON.parse(fulfillmentOptions);
  }

  bru.setEnvVar("OfferCollectionRequest", JSON.stringify(body));
}

// Function to build the booking request
function buildBookingRequest() {
  validationLogger("[INFO] ➤ buildBookingRequest");
  accommodationAndPlaceSelection();

  const bookingPassengerSpecifications = JSON.parse(bru.getEnvVar("bookingPassengerSpecifications"));
  const firstPassenger = bookingPassengerSpecifications[0];
  const passengerSpecifications = (firstPassenger?.detail?.firstName && firstPassenger?.detail?.lastName)
    ? bookingPassengerSpecifications
    : JSON.parse(bru.getEnvVar("offerPassengerSpecifications"));

  const placeSelections = JSON.parse(bru.getEnvVar("placeSelections") || "[]");

  const offer = {
    offerId: bru.getEnvVar("offerId"),
    passengerRefs: JSON.parse(bru.getEnvVar("bookingPassengerReferences"))
  };
  if (placeSelections.length > 0) {
    offer.placeSelections = placeSelections;
  }

  const body = {
    offers: [offer],
    purchaser: JSON.parse(bru.getEnvVar("bookingPurchaserSpecifications")),
    passengerSpecifications
  };

  const sandbox = bru.getEnvVar("api_base") || "";
  if (!sandbox.includes("paxone")) {
    body.externalRef = "00001";
  }

  bru.setEnvVar("BookingRequest", JSON.stringify(body));
}

// Function to handle place selections
function accommodationAndPlaceSelection() {
  validationLogger("[INFO] ➤ accommodationAndPlaceSelection");

  const requiresPlaceSelection = bru.getEnvVar("requiresPlaceSelection");
  const accommodationSelection = bru.getEnvVar("accommodationSelection");

  if (requiresPlaceSelection !== true && requiresPlaceSelection !== "true" && accommodationSelection !== "COUCHETTE") {
    bru.setEnvVar("placeSelections", JSON.stringify([]));
    return;
  }

  const tripLegCoverageArr = JSON.parse(bru.getEnvVar("tripLegCoverage") || "[]");
  const tripId = tripLegCoverageArr.length > 0 ? tripLegCoverageArr[0].tripId : "";
  const legId = tripLegCoverageArr.length > 0 ? tripLegCoverageArr[0].legId : "";
  const passengerRefs = JSON.parse(bru.getEnvVar("bookingPassengerReferences"));

  const placeSelection = {
    reservationId: bru.getEnvVar("reservationId"),
    tripLegCoverage: { tripId, legId }
  };

  if (accommodationSelection === "COUCHETTE") {
    placeSelection.accommodations = [{
      passengerRefs,
      accommodationType: accommodationSelection,
      accommodationSubType: "ANY_SEAT",
      placeProperties: ["MEN"]
    }];
  }

  if (requiresPlaceSelection === true || requiresPlaceSelection === "true") {
    placeSelection.places = [{
      passengerRefs,
      coachNumber: bru.getEnvVar("preselectedCoach"),
      placeNumber: bru.getEnvVar("preselectedPlace")
    }];
  }

  bru.setEnvVar("placeSelections", JSON.stringify([placeSelection]));
}

// Parse fulfillmentIds from env var (handles both array and JSON string)
function parseFulfillmentIds() {
  const raw = bru.getEnvVar('fulfillmentIds');
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    return raw;
  }
}

// Function to create request body for refund offers
function requestRefundOffersBody(overruleCode, refundDate = null) {
  validationLogger("[INFO] ➤ requestRefundOffersBody");

  const body = { fulfillmentIds: parseFulfillmentIds() };
  if (overruleCode != null) body.overruleCode = overruleCode;
  if (refundDate != null)   body.refundDate   = refundDate;

  bru.setEnvVar("requestRefundOffersBodyData", JSON.stringify(body));
}

// Function to create request body for exchange offers
function requestExchangeOffersBody(overruleCode) {
  validationLogger("[INFO] ➤ requestExchangeOffersBody");

  const updateGender_0 = bru.getEnvVar('updateGender_0');

  const body = {
    fulfillmentIds: parseFulfillmentIds(),
    tripSearchCriteria: JSON.parse(bru.getEnvVar('offerTripSearchCriteria')),
    offerSearchCriteria: JSON.parse(bru.getEnvVar('offerSearchCriteria')),
    anonymousPassengerSpecifications: [{
      externalRef: "00001",
      dateOfBirth: bru.getEnvVar('updateDateOfBirth_0'),
      age: 0,
      type: "PERSON",
      ...(updateGender_0 != null && { gender: updateGender_0 })
    }],
    ...(overruleCode != null && { overruleCode })
  };

  validationLogger("[INFO] Request Exchange Offers Body: " + JSON.stringify(body));
  bru.setEnvVar("requestExchangeOffersBodyData", JSON.stringify(body));
}

// Function to create request body for exchange operations
function requestExchangeOperationsBody() {
  validationLogger("[INFO] ➤ requestExchangeOperationsBody");

  const body = {
    exchangeOffers: [{
      offerId: bru.getEnvVar('exchangeOffersOfferId'),
      passengerRefs: JSON.parse(bru.getEnvVar('bookingPassengerReferences'))
    }]
  };

  validationLogger("[INFO] Request Exchange Operations Body: " + JSON.stringify(body));
  bru.setEnvVar("requestExchangeOperationsBodyData", JSON.stringify(body));
}

// Expose to global for convenience in eval/require loader flows
try {
  Object.assign(globalThis, module.exports);
} catch (e) {
  // no-op
}
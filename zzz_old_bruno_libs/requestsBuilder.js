// Import needed library files
const display = require('./displays.js');

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

  if (sandbox.includes("paxone")) {
    switch (tripType) {
      case "SPECIFICATION":
        bru.setEnvVar(
          "OfferCollectionRequest",
          "{\"tripSpecifications\" : " + bru.getEnvVar("offerTripSpecifications") + "," +
          "\"anonymousPassengerSpecifications\" : " + bru.getEnvVar("offerPassengerSpecifications") + "," +
          "\"offerSearchCriteria\" : " + bru.getEnvVar("offerSearchCriteria") +
          (bru.getEnvVar("offerFulfillmentOptions") ? ",\"requestedFulfillmentOptions\" : " + bru.getEnvVar("offerFulfillmentOptions") : "") +
          "}"
        );
        break;
      case "SEARCH":
        bru.setEnvVar(
          "OfferCollectionRequest",
          "{\"tripSearchCriteria\" : " + bru.getEnvVar("offerTripSearchCriteria") + "," +
          "\"anonymousPassengerSpecifications\" : " + bru.getEnvVar("offerPassengerSpecifications") + "," +
          "\"offerSearchCriteria\" : " + bru.getEnvVar("offerSearchCriteria") +
          (bru.getEnvVar("offerFulfillmentOptions") ? ",\"requestedFulfillmentOptions\" : " + bru.getEnvVar("offerFulfillmentOptions") : "") +
          "}"
        );
        break;
    }
  } else {
    switch (tripType) {
      case "SPECIFICATION":
        bru.setEnvVar(
          "OfferCollectionRequest",
          "{\"objectType\": \"OfferCollectionRequest\"," +
          "\"tripSpecifications\" : " + bru.getEnvVar("offerTripSpecifications") + "," +
          "\"anonymousPassengerSpecifications\" : " + bru.getEnvVar("offerPassengerSpecifications") + "," +
          "\"offerSearchCriteria\" : " + bru.getEnvVar("offerSearchCriteria") + "," +
          "\"requestedFulfillmentOptions\" : " + bru.getEnvVar("offerFulfillmentOptions") +
          "}"
        );
        break;
      case "SEARCH":
        bru.setEnvVar(
          "OfferCollectionRequest",
          "{\"objectType\": \"OfferCollectionRequest\"," +
          "\"tripSearchCriteria\" : " + bru.getEnvVar("offerTripSearchCriteria") + "," +
          "\"anonymousPassengerSpecifications\" : " + bru.getEnvVar("offerPassengerSpecifications") + "," +
          "\"offerSearchCriteria\" : " + bru.getEnvVar("offerSearchCriteria") + "," +
          "\"requestedFulfillmentOptions\" : " + bru.getEnvVar("offerFulfillmentOptions") +
          "}"
        );
        break;
    }
  }

  /*
  // Safer object-based alternative
  let requestBody = {};
  if (tripType === "SPECIFICATION") {
    requestBody.tripSpecifications = JSON.parse(bru.getEnvVar("offerTripSpecifications"));
  } else if (tripType === "SEARCH") {
    requestBody.tripSearchCriteria = JSON.parse(bru.getEnvVar("offerTripSearchCriteria"));
  }
  requestBody.anonymousPassengerSpecifications = JSON.parse(bru.getEnvVar("offerPassengerSpecifications"));
  requestBody.offerSearchCriteria = JSON.parse(bru.getEnvVar("offerSearchCriteria"));
  const fulfillmentOptions = bru.getEnvVar("offerFulfillmentOptions");
  if (fulfillmentOptions !== undefined) {
    requestBody.requestedFulfillmentOptions = JSON.parse(fulfillmentOptions);
  }
  bru.setEnvVar("OfferCollectionRequest", JSON.stringify(requestBody));
  */
}

// Function to build the booking request
function buildBookingRequest() {
  validationLogger("[INFO] ➤ buildBookingRequest");
  // Call the accommodationAndPlaceSelection function
  accommodationAndPlaceSelection();

  let bookingPassengerSpecifications = JSON.parse(bru.getEnvVar("bookingPassengerSpecifications"));
  let checkBookingPassengerSpecificationsContent = bookingPassengerSpecifications[0];

  let bookingPassengerSpecificationsContent;
  if (checkBookingPassengerSpecificationsContent?.detail?.firstName && checkBookingPassengerSpecificationsContent?.detail?.lastName) {
    bookingPassengerSpecificationsContent = JSON.stringify(bookingPassengerSpecifications);
  } else {
    bookingPassengerSpecificationsContent = bru.getEnvVar("offerPassengerSpecifications");
  }

  validationLogger("[DEBUG] 🪲 buildBookingRequest");

  const sandbox = bru.getEnvVar("api_base") || "";
  if (sandbox.includes("paxone")) {
    bru.setEnvVar(
      "BookingRequest",
      "{"
      + "\"offers\": [\n"
      + "{\n"
      + "            \"offerId\": \"" + bru.getEnvVar("offerId") + "\",\n"
      + "            " + bru.getEnvVar("placeSelections") + "\n"
      + "            \"passengerRefs\": \n"
      + "                " + bru.getEnvVar("bookingPassengerReferences") + "\n"
      + "            \n"
      + "        }\n"
      + "    ],"
      + "\"purchaser\": " + bru.getEnvVar("bookingPurchaserSpecifications") + ","
      + "\"passengerSpecifications\" : " + bookingPassengerSpecificationsContent
      + "}"
    );
  } else {
    bru.setEnvVar(
      "BookingRequest",
      "{"
      + "\"offers\": [\n"
      + "{\n"
      + "            \"offerId\": \"" + bru.getEnvVar("offerId") + "\",\n"
      + "            " + bru.getEnvVar("placeSelections") + "\n"
      + "            \"passengerRefs\": \n"
      + "                " + bru.getEnvVar("bookingPassengerReferences") + "\n"
      + "            \n"
      + "        }\n"
      + "    ],"
      + "\"purchaser\": " + bru.getEnvVar("bookingPurchaserSpecifications") + ","
      + "\"passengerSpecifications\" : " + bookingPassengerSpecificationsContent + ","
      // TODO: condition externalRef for PAXONE if needed
      + "\"externalRef\":\"00001\""
      + "}"
    );
  }
}

// Function to handle place selections
// TODO Review this function for better clarity and efficiency
function accommodationAndPlaceSelection() {
  validationLogger("[INFO] ➤ accommodationAndPlaceSelection");

  const requiresPlaceSelection = bru.getEnvVar("requiresPlaceSelection");
  const accommodationSelection = bru.getEnvVar("accommodationSelection");
  const tripLegCoverageArr = JSON.parse(bru.getEnvVar("tripLegCoverage") || "[]");
  const tripId = tripLegCoverageArr.length > 0 ? tripLegCoverageArr[0].tripId : "";
  const legId = tripLegCoverageArr.length > 0 ? tripLegCoverageArr[0].legId : "";

  if (requiresPlaceSelection !== true && accommodationSelection !== "COUCHETTE") {
    bru.setEnvVar("placeSelections", "");
    return;
  }

  let placeSelections =
    "\"placeSelections\": [\n" +
    "    {\n" +
    "        \"reservationId\": \"" + bru.getEnvVar("reservationId") + "\",\n";

  if (accommodationSelection === "COUCHETTE") {
    placeSelections += "\n" +
      "        \"accommodations\": [\n" +
      "            {\n" +
      "                \"passengerRefs\": " + bru.getEnvVar("bookingPassengerReferences") + ",\n" +
      "                \"accommodationType\": \"" + bru.getEnvVar("accommodationSelection") + "\",\n" +
      "                \"accommodationSubType\": \"ANY_SEAT\",\n" +
      "                \"placeProperties\": [\"MEN\"]\n" +
      "            }\n" +
      "        ]";
  }

  if (requiresPlaceSelection === true) {
    placeSelections += "\n" +
      "        \"places\": [\n" +
      "            {\n" +
      "                \"passengerRefs\": " + bru.getEnvVar("bookingPassengerReferences") + ",\n" +
      "                \"coachNumber\": \"" + bru.getEnvVar("preselectedCoach") + "\",\n" +
      "                \"placeNumber\": \"" + bru.getEnvVar("preselectedPlace") + "\",\n" +
      "            }\n" +
      "        ]";
  }

  placeSelections += ",\n" +
    "        \"tripLegCoverage\" : {\n" +
    "            \"tripId\": \"" + tripId + "\",\n" +
    "            \"legId\" : \"" + legId + "\"\n" +
    "        }\n" +
    "    }\n" +
    "],";

  bru.setEnvVar("placeSelections", placeSelections);
}

// Function to create request body for refund offers
function requestRefundOffersBody(overruleCode, refundDate = null) {
  validationLogger("[INFO] ➤ requestRefundOffersBody");
  validationLogger("[DEBUG] 🪲 requestRefundOffersBody");

  // fulfillmentIds may be stored as array or JSON string; try to use as-is
  let fulfillmentIdsArray = bru.getEnvVar('fulfillmentIds');
  try {
    if (typeof fulfillmentIdsArray === 'string') {
      fulfillmentIdsArray = JSON.parse(fulfillmentIdsArray);
    }
  } catch (e) {
    // keep as-is if not JSON
  }

  const body = {
    fulfillmentIds: fulfillmentIdsArray
  };
  if (overruleCode != null) {
    body.overruleCode = overruleCode;
  }
  if (refundDate != null) {
    body.refundDate = refundDate;
  }
  bru.setEnvVar("requestRefundOffersBodyData", JSON.stringify(body));
}

// Function to create request body for exchange offers
function requestExchangeOffersBody(overruleCode) {
  validationLogger("[INFO] ➤ requestExchangeOffersBody");

  let fulfillmentIdsArray = bru.getEnvVar('fulfillmentIds');
  try {
    if (typeof fulfillmentIdsArray === 'string') {
      fulfillmentIdsArray = JSON.parse(fulfillmentIdsArray);
    }
  } catch (e) {
    // leave as-is
  }

  const offerTripSearchCriteria = bru.getEnvVar('offerTripSearchCriteria');
  const offerSearchCriteria = bru.getEnvVar('offerSearchCriteria');
  const bookingExternalRef = "00001";
  const updateDateOfBirth_0 = bru.getEnvVar('updateDateOfBirth_0');
  const updateGender_0 = bru.getEnvVar('updateGender_0');

  const body = {
    fulfillmentIds: fulfillmentIdsArray,
    tripSearchCriteria: JSON.parse(offerTripSearchCriteria),
    offerSearchCriteria: JSON.parse(offerSearchCriteria),
    anonymousPassengerSpecifications: [
      {
        externalRef: bookingExternalRef,
        dateOfBirth: updateDateOfBirth_0,
        age: 0,
        type: "PERSON",
        ...(updateGender_0 !== null && { gender: updateGender_0 })
      }
    ],
    ...(overruleCode !== null && overruleCode != null && { overruleCode })
  };

  console.log("Request Exchange Offers Body Data:", body);
  bru.setEnvVar("requestExchangeOffersBodyData", JSON.stringify(body));
}

// Function to create request body for exchange operations
function requestExchangeOperationsBody() {
  validationLogger("[INFO] ➤ requestExchangeOperationsBody");

  const exchangeOffersOfferId = bru.getEnvVar('exchangeOffersOfferId');
  const bookingPassengerReferences = bru.getEnvVar('bookingPassengerReferences');
  const body = {
    exchangeOffers: [
      {
        offerId: exchangeOffersOfferId,
        passengerRefs: JSON.parse(bookingPassengerReferences)
      }
    ]
  };

  console.log("Request Exchange Operations Body Data:", body);
  bru.setEnvVar("requestExchangeOperationsBodyData", JSON.stringify(body));
}

// Expose to global for convenience in eval/require loader flows
try {
  Object.assign(globalThis, module.exports);
} catch (e) {
  // no-op
}
// Function to build the offer collection request
function buildOfferCollectionRequest() {
	var tripType = pm.globals.get("TripType");
	var sandbox = pm.environment.get("api_base");

	// Check if the sandbox includes "paxone"
	if (sandbox.includes("paxone")) {
		switch(tripType) {
			case "SPECIFICATION":
				pm.globals.set("OfferCollectionRequest", "{\"tripSpecifications\" : "+pm.globals.get("offerTripSpecifications")+"," +
					"\"anonymousPassengerSpecifications\" : "+pm.globals.get("offerPassengerSpecifications")+"," +
					"\"offerSearchCriteria\" : "+pm.globals.get("offerSearchCriteria") +
					(pm.globals.get("offerFulfillmentOptions") ? ",\"requestedFulfillmentOptions\" : "+pm.globals.get("offerFulfillmentOptions") : "") +
					"}");
				break;
			case "SEARCH":
				pm.globals.set("OfferCollectionRequest", "{\"tripSearchCriteria\" : "+pm.globals.get("offerTripSearchCriteria")+"," +
					"\"anonymousPassengerSpecifications\" : "+pm.globals.get("offerPassengerSpecifications")+"," +
					"\"offerSearchCriteria\" : "+pm.globals.get("offerSearchCriteria") +
					(pm.globals.get("offerFulfillmentOptions") ? ",\"requestedFulfillmentOptions\" : "+pm.globals.get("offerFulfillmentOptions") : "") +
					"}");
				break;
		}
	} else {
		switch(tripType) {
			case "SPECIFICATION":
				pm.globals.set("OfferCollectionRequest", "{\"objectType\": \"OfferCollectionRequest\"," +
					"\"tripSpecifications\" : "+pm.globals.get("offerTripSpecifications")+"," +
					"\"anonymousPassengerSpecifications\" : "+pm.globals.get("offerPassengerSpecifications")+"," +
					"\"offerSearchCriteria\" : "+pm.globals.get("offerSearchCriteria")+"," +
					"\"requestedFulfillmentOptions\" : "+pm.globals.get("offerFulfillmentOptions") +
					"}");
				break;
			case "SEARCH":
				pm.globals.set("OfferCollectionRequest", "{\"objectType\": \"OfferCollectionRequest\"," +
					"\"tripSearchCriteria\" : "+pm.globals.get("offerTripSearchCriteria")+"," +
					"\"anonymousPassengerSpecifications\" : "+pm.globals.get("offerPassengerSpecifications")+"," +
					"\"offerSearchCriteria\" : "+pm.globals.get("offerSearchCriteria")+"," +
					"\"requestedFulfillmentOptions\" : "+pm.globals.get("offerFulfillmentOptions") +
					"}");
				break;
		}
	}
}

// Function to build the booking request
function buildBookingRequest() {
	// Generate a unique identifier for the booking external reference
	var uuid = require('uuid');
	pm.globals.set("bookingExternalRef", uuid.v4());

	// Call the placeSelections function
	placeSelections();

	let bookingPassengerSpecifications = JSON.parse(pm.globals.get("bookingPassengerSpecifications"));
	let checkBookingPassengerSpecificationsContent = bookingPassengerSpecifications[0];
	
	let bookingPassengerSpecificationsContent;
	
	if (checkBookingPassengerSpecificationsContent.detail?.firstName && checkBookingPassengerSpecificationsContent.detail?.lastName) {
		bookingPassengerSpecificationsContent = JSON.stringify(bookingPassengerSpecifications);
	} else {
		bookingPassengerSpecificationsContent = pm.globals.get("offerPassengerSpecifications");
	}
	validationLogger("[DEBUG] 🪲 DUMMY9")
	// Check if the sandbox includes "paxone"
	var sandbox = pm.environment.get("api_base");
	if (sandbox.includes("paxone")) {
		pm.globals.set("BookingRequest", "{" +
			"\"offers\": [\n" +
			"{\n" +
			"            \"offerId\": \""+pm.globals.get("offerId")+"\",\n" +
			"            "+pm.globals.get("placeSelections")+"\n" +
			"            \"passengerRefs\": \n" +
			"                "+pm.globals.get("bookingPassengerReferences")+"\n" +
			"            \n" +
			"        }\n" +
			"    ]," +
			"\"purchaser\": "+pm.globals.get("bookingPurchaserSpecifications")+"," +
			"\"passengerSpecifications\" : "+bookingPassengerSpecificationsContent +
			"}");
	} else {
		pm.globals.set("BookingRequest", "{" +
			"\"offers\": [\n" +
			"{\n" +
			"            \"offerId\": \""+pm.globals.get("offerId")+"\",\n" +
			"            "+pm.globals.get("placeSelections")+"\n" +
			"            \"passengerRefs\": \n" +
			"                "+pm.globals.get("bookingPassengerReferences")+"\n" +
			"            \n" +
			"        }\n" +
			"    ]," +
			"\"purchaser\": "+pm.globals.get("bookingPurchaserSpecifications")+"," +
			"\"passengerSpecifications\" : "+bookingPassengerSpecificationsContent+"," +
			"\"externalRef\":\""+pm.globals.get("bookingExternalRef")+"\"" +
			"}");
	}
}

// Function to handle place selections
function placeSelections() {
	// Check if place selection is required
	var requiresPlaceSelection = pm.globals.get("requiresPlaceSelection");

	if (requiresPlaceSelection == true) {
		// Set the place selections in global variables
		pm.globals.set("placeSelections", "\"placeSelections\": [\n"
			+ "	                    {\n"
			+ "	                        \"reservationId\": \"" + pm.globals.get("reservationId") + "\",\n"
			+ "	                        \"places\": [\n"
			+ "	                            {\n"
			+ "	                                \"coachNumber\": \"" + pm.globals.get("preselectedCoach") + "\",\n"
			+ "	                                \"placeNumber\": \"" + pm.globals.get("preselectedPlace") + "\",\n"
			+ "	                                \"passengerRef\": \"" + pm.globals.get("passengerSpecification1ExternalRef") + "\"\n"
			+ "	                            }\n"
			+ "	                        ],\n"
			+ "	                        \"tripLegCoverage\" : {\n"
			+ "	                            \"tripId\": \"" + pm.globals.get("tripId") + "\",\n"
			+ "	                            \"legId\" : \"" + pm.globals.get("legId") + "\"\n"
			+ "	                        }\n"
			+ "	                    }\n"
			+ "	                ],");
	} else {
		// Set an empty string if place selection is not required
		pm.globals.set("placeSelections", "");
	}
}

// Function to create request body for refund offers
function requestRefundOffersBody(overruleCode, refundDate) {
	const fulfillmentId = pm.globals.get('fulfillmentsId');

	const body = {
		fulfillmentIds: [fulfillmentId],
		...(overruleCode && { overruleCode }),
		...(refundDate && { refundDate })
	};

	pm.globals.set("requestRefundOffersBodyData", JSON.stringify(body));
}

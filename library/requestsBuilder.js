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

	/*
	let requestBody = {};
	
	// Add the appropriate field based on the trip type
	if (tripType === "SPECIFICATION") {
		requestBody.tripSpecifications = JSON.parse(pm.globals.get("offerTripSpecifications"));
	} else if (tripType === "SEARCH") {
		requestBody.tripSearchCriteria = JSON.parse(pm.globals.get("offerTripSearchCriteria"));
	}
	
	requestBody.anonymousPassengerSpecifications = JSON.parse(pm.globals.get("offerPassengerSpecifications")),
	requestBody.offerSearchCriteria = JSON.parse(pm.globals.get("offerSearchCriteria"))

	// Conditionally add the fulfillment options if available
	const fulfillmentOptions = pm.globals.get("offerFulfillmentOptions");
	if (fulfillmentOptions !== undefined) {
		requestBody.requestedFulfillmentOptions = JSON.parse(fulfillmentOptions);
	}
	
	pm.globals.set("OfferCollectionRequest", JSON.stringify(requestBody));
	*/
}

// Function to build the booking request
function buildBookingRequest() {
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
	validationLogger("[DEBUG] 🪲 buildBookingRequest")
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
			//TODO : Condition externalRef to remove for PAXONE ?
			//TODO : bookingExternalRef or just 00001 as first passenger ?
			//"\"externalRef\":\""+pm.globals.get("bookingExternalRef")+"\"" +
			"\"externalRef\":\"00001\""+
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
		fulfillmentIds: [fulfillmentId]
	};

	if (overruleCode !== null && overruleCode !== undefined) {
		body.overruleCode = overruleCode;
	}

	if (refundDate) {
		body.refundDate = refundDate;
	}

	pm.globals.set("requestRefundOffersBodyData", JSON.stringify(body));
}

// Function to create request body for exchange offers
function requestExchangeOffersBody(overruleCode) {
	const fulfillmentIdsRaw = pm.globals.get('fulfillmentsIds'); // <-- note le 's'
	const offerTripSearchCriteria = pm.globals.get('offerTripSearchCriteria');
	const offerSearchCriteria = pm.globals.get('offerSearchCriteria');
	const bookingExternalRef = "00001";
	const updateDateOfBirth_0 = pm.globals.get('updateDateOfBirth_0');
	const updateGender_0 = pm.globals.get('updateGender_0');

	const body = {
		fulfillmentIds: JSON.parse(fulfillmentIdsRaw), // <- assure-toi que c’est un tableau JSON (ex: ["abc123"])
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
		...(overruleCode !== null && overruleCode !== undefined && { overruleCode })
	};

	console.log("Request Exchange Offers Body Data:", body);
	pm.globals.set("requestExchangeOffersBodyData", JSON.stringify(body));
}
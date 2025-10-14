// Function to build the offer collection request
function buildOfferCollectionRequest() {
	var tripType = pm.environment.get("TripType");
	
	var sandbox = pm.environment.get("api_base");

	// Check if the sandbox includes "paxone"
	if (sandbox.includes("paxone")) {
		switch(tripType) {
			case "SPECIFICATION":
				pm.environment.set("OfferCollectionRequest", "{\"tripSpecifications\" : "+pm.environment.get("offerTripSpecifications")+"," +
					"\"anonymousPassengerSpecifications\" : "+pm.environment.get("offerPassengerSpecifications")+"," +
					"\"offerSearchCriteria\" : "+pm.environment.get("offerSearchCriteria") +
					(pm.environment.get("offerFulfillmentOptions") ? ",\"requestedFulfillmentOptions\" : "+pm.environment.get("offerFulfillmentOptions") : "") +
					"}");
				break;
			case "SEARCH":
				pm.environment.set("OfferCollectionRequest", "{\"tripSearchCriteria\" : "+pm.environment.get("offerTripSearchCriteria")+"," +
					"\"anonymousPassengerSpecifications\" : "+pm.environment.get("offerPassengerSpecifications")+"," +
					"\"offerSearchCriteria\" : "+pm.environment.get("offerSearchCriteria") +
					(pm.environment.get("offerFulfillmentOptions") ? ",\"requestedFulfillmentOptions\" : "+pm.environment.get("offerFulfillmentOptions") : "") +
					"}");
				break;
		}
	} else {
		switch(tripType) {
			case "SPECIFICATION":
				pm.environment.set("OfferCollectionRequest", "{\"objectType\": \"OfferCollectionRequest\"," +
					"\"tripSpecifications\" : "+pm.environment.get("offerTripSpecifications")+"," +
					"\"anonymousPassengerSpecifications\" : "+pm.environment.get("offerPassengerSpecifications")+"," +
					"\"offerSearchCriteria\" : "+pm.environment.get("offerSearchCriteria")+"," +
					"\"requestedFulfillmentOptions\" : "+pm.environment.get("offerFulfillmentOptions") +
					"}");
				break;
			case "SEARCH":
				pm.environment.set("OfferCollectionRequest", "{\"objectType\": \"OfferCollectionRequest\"," +
					"\"tripSearchCriteria\" : "+pm.environment.get("offerTripSearchCriteria")+"," +
					"\"anonymousPassengerSpecifications\" : "+pm.environment.get("offerPassengerSpecifications")+"," +
					"\"offerSearchCriteria\" : "+pm.environment.get("offerSearchCriteria")+"," +
					"\"requestedFulfillmentOptions\" : "+pm.environment.get("offerFulfillmentOptions") +
					"}");
				break;
		}
	}

	/*
	let requestBody = {};
	
	// Add the appropriate field based on the trip type
	if (tripType === "SPECIFICATION") {
		requestBody.tripSpecifications = JSON.parse(pm.environment.get("offerTripSpecifications"));
	} else if (tripType === "SEARCH") {
		requestBody.tripSearchCriteria = JSON.parse(pm.environment.get("offerTripSearchCriteria"));
	}
	
	requestBody.anonymousPassengerSpecifications = JSON.parse(pm.environment.get("offerPassengerSpecifications")),
	requestBody.offerSearchCriteria = JSON.parse(pm.environment.get("offerSearchCriteria"))

	// Conditionally add the fulfillment options if available
	const fulfillmentOptions = pm.environment.get("offerFulfillmentOptions");
	if (fulfillmentOptions !== undefined) {
		requestBody.requestedFulfillmentOptions = JSON.parse(fulfillmentOptions);
	}
	
	pm.environment.set("OfferCollectionRequest", JSON.stringify(requestBody));
	*/
}

// Function to build the booking request
function buildBookingRequest() {
	// Call the placeSelections function
	placeSelections();

	let bookingPassengerSpecifications = JSON.parse(pm.environment.get("bookingPassengerSpecifications"));
	let checkBookingPassengerSpecificationsContent = bookingPassengerSpecifications[0];
	
	let bookingPassengerSpecificationsContent;
	
	if (checkBookingPassengerSpecificationsContent.detail?.firstName && checkBookingPassengerSpecificationsContent.detail?.lastName) {
		bookingPassengerSpecificationsContent = JSON.stringify(bookingPassengerSpecifications);
	} else {
		bookingPassengerSpecificationsContent = pm.environment.get("offerPassengerSpecifications");
	}
	validationLogger("[DEBUG] 🪲 buildBookingRequest")
	// Check if the sandbox includes "paxone"
	var sandbox = pm.environment.get("api_base");
	if (sandbox.includes("paxone")) {
		pm.environment.set("BookingRequest", "{" +
			"\"offers\": [\n" +
			"{\n" +
			"            \"offerId\": \""+pm.environment.get("offerId")+"\",\n" +
			"            "+pm.environment.get("placeSelections")+"\n" +
			"            \"passengerRefs\": \n" +
			"                "+pm.environment.get("bookingPassengerReferences")+"\n" +
			"            \n" +
			"        }\n" +
			"    ]," +
			"\"purchaser\": "+pm.environment.get("bookingPurchaserSpecifications")+"," +
			"\"passengerSpecifications\" : "+bookingPassengerSpecificationsContent +
			"}");
	} else {
		pm.environment.set("BookingRequest", "{" +
			"\"offers\": [\n" +
			"{\n" +
			"            \"offerId\": \""+pm.environment.get("offerId")+"\",\n" +
			"            "+pm.environment.get("placeSelections")+"\n" +
			"            \"passengerRefs\": \n" +
			"                "+pm.environment.get("bookingPassengerReferences")+"\n" +
			"            \n" +
			"        }\n" +
			"    ]," +
			"\"purchaser\": "+pm.environment.get("bookingPurchaserSpecifications")+"," +
			"\"passengerSpecifications\" : "+bookingPassengerSpecificationsContent+"," +
			//TODO : Condition externalRef to remove for PAXONE ?
			//TODO : bookingExternalRef or just 00001 as first passenger ?
			//"\"externalRef\":\""+pm.environment.get("bookingExternalRef")+"\"" +
			"\"externalRef\":\"00001\""+
			"}");
	}
}

// Function to handle place selections
function placeSelections() {
	// Check if place selection is required
	var requiresPlaceSelection = pm.environment.get("requiresPlaceSelection");

	if (requiresPlaceSelection == true) {
		// Set the place selections in global variables
		pm.environment.set("placeSelections", "\"placeSelections\": [\n"
			+ "	                    {\n"
			+ "	                        \"reservationId\": \"" + pm.environment.get("reservationId") + "\",\n"
			+ "	                        \"places\": [\n"
			+ "	                            {\n"
			+ "	                                \"coachNumber\": \"" + pm.environment.get("preselectedCoach") + "\",\n"
			+ "	                                \"placeNumber\": \"" + pm.environment.get("preselectedPlace") + "\",\n"
			+ "	                                \"passengerRef\": \"" + pm.environment.get("passengerSpecification1ExternalRef") + "\"\n"
			+ "	                            }\n"
			+ "	                        ],\n"
			+ "	                        \"tripLegCoverage\" : {\n"
			+ "	                            \"tripId\": \"" + pm.environment.get("tripId") + "\",\n"
			+ "	                            \"legId\" : \"" + pm.environment.get("legId") + "\"\n"
			+ "	                        }\n"
			+ "	                    }\n"
			+ "	                ],");
	} else {
		// Set an empty string if place selection is not required
		pm.environment.set("placeSelections", "");
	}
}

// Function to create request body for refund offers
function requestRefundOffersBody(overruleCode, refundDate) {
	const fulfillmentId = pm.environment.get('fulfillmentsId');

	const body = {
		fulfillmentIds: [fulfillmentId]
	};

	if (overruleCode !== null && overruleCode !== undefined) {
		body.overruleCode = overruleCode;
	}

	if (refundDate) {
		body.refundDate = refundDate;
	}

	pm.environment.set("requestRefundOffersBodyData", JSON.stringify(body));
}

// Function to create request body for exchange offers
function requestExchangeOffersBody(overruleCode) {
	const fulfillmentIdsRaw = pm.environment.get('fulfillmentsIds'); // <-- note le 's'
	const offerTripSearchCriteria = pm.environment.get('offerTripSearchCriteria');
	const offerSearchCriteria = pm.environment.get('offerSearchCriteria');
	const bookingExternalRef = "00001";
	const updateDateOfBirth_0 = pm.environment.get('updateDateOfBirth_0');
	const updateGender_0 = pm.environment.get('updateGender_0');

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
	pm.environment.set("requestExchangeOffersBodyData", JSON.stringify(body));
}

postOfferResponsePreRequest = function() {
	console.log("⏩ [STEP] Executing request : " + pm.info.requestName);
	// If the scenario is not found throw an error
	const scenarioCode = pm.environment.get("scenarioCode");
	const data_base_tmp = pm.environment.get("data_base_tmp");
	const found = data_base_tmp.scenarios.some(s => s.code === scenarioCode);
	if (!found) {
		throw new Error(`⛔ The scenario "${scenarioCode}" does not exist in data file scenarios list`);
	}

	buildOfferCollectionRequest();

	//captureSwaggerSchemaValidator();

	//TODO Implement logging of request and response headers and body later
	let reqHeaders = {};
	if (pm.request?.headers) {
		pm.request.headers.each(header => {
			reqHeaders[header.key] = header.value;
		});
	}
	pm.environment.set("requestHeaders", JSON.stringify(reqHeaders));
	pm.environment.set("method", pm.request?.method || '');
	pm.environment.set("url", pm.request?.url?.toString() || '');

	let resHeaders = {};
	if (pm.response?.headers) {
		pm.response.headers.each(header => {
			resHeaders[header.key] = header.value;
		});
	}
	pm.environment.set("responseHeaders", JSON.stringify(resHeaders));

	pm.environment.set("responseBody", pm.response?.text() || '');

	//swaggerSchemaValidatorContent();
}

// Function to validate offer response
function postOfferResponse(jsonData) {
	// Validate HTTP response status
	pm.test("Status code is 200", () => {
		pm.expect(pm.response.code, "[ERROR] Wrong response status").to.eql(200);
	});

	// Stop flow if status != 200
	if (pm.response.code !== 200) {
		validationLogger(`[ERROR] Wrong status: ${pm.response.code}`);
		pm.execution.setNextRequest(null);
		return;
	}

	// Check offers exist
	pm.test("Offers array exists and is not empty", () => {
		pm.expect(jsonData.offers, "[ERROR] 'offers' is missing or empty").to.be.an("array").that.is.not.empty;
	});

	// Stop flow if offers invalid
	if (!Array.isArray(jsonData.offers) || jsonData.offers.length === 0) {
		validationLogger("[ERROR] No offers found or 'offers' is not an array.");
		pm.execution.setNextRequest(null);
		return;
	}

	validationLogger(`[INFO] 🔍 ${jsonData.offers.length} offer(s) received`);

	let selectedOffer = selectAndSetOffer(jsonData);

    validateOfferSummary(selectedOffer);
    validatePassengers(jsonData);
    validateTripsAndLegs(jsonData);
    validateOfferParts(selectedOffer);
    validateAdmissions(selectedOffer);

	handleAccommodationAndPlaceSelection(selectedOffer);
};

// select and set offer based on criteria
function selectAndSetOffer(jsonData) {
	validationLogger("[INFO] ➤ selectAndSetOffer");

	const desiredFlexibility = pm.environment.get("desiredFlexibility");
	const accommodationSelection = pm.environment.get("accommodationSelection");
	const scenarioType = pm.environment.get("scenarioType");

	// match accommodation type in reservationOfferParts
	function matchesAccommodation(offer, expectedType, requireAll = false) {
		return offer.reservationOfferParts.some(part => {
			if (!Array.isArray(part.availablePlaces)) return true;

			return requireAll
				? part.availablePlaces.every(place => place.accommodationType === expectedType)
				: part.availablePlaces.some(place => place.accommodationType === expectedType);
		});
	}

	let filteredOffers = jsonData.offers;

	if (accommodationSelection === "SEAT") {
		validationLogger("[INFO] Filter: only SEAT (all places must be SEAT)");
		filteredOffers = filteredOffers.filter(o => matchesAccommodation(o, "SEAT", true));
	}
	else if (accommodationSelection === "COUCHETTE") {
		validationLogger("[INFO] Filter: COUCHETTE (at least 1 place)");
		filteredOffers = filteredOffers.filter(o => matchesAccommodation(o, "COUCHETTE"));
	}
	else if (accommodationSelection === "BERTH") {
		validationLogger("[INFO] Filter: BERTH (at least 1 place)");
		filteredOffers = filteredOffers.filter(o => matchesAccommodation(o, "BERTH"));
	}
	else {
		validationLogger("[INFO] No accommodation filter applied");
	}

	if (desiredFlexibility) {
		validationLogger("[INFO] Applying flexibility filter: " + desiredFlexibility);
		filteredOffers = filteredOffers.filter(o =>
			o.offerSummary?.overallFlexibility === desiredFlexibility
		);
	}

	const selectedOffer = filteredOffers[0] || jsonData.offers[0];

	validationLogger(`[INFO] ✅ Selected Offer ID: ${selectedOffer.offerId}`);
	console.log("[INFO] 🔍 Selected Offer:", selectedOffer);

	pm.environment.set("offer", JSON.stringify(selectedOffer));
	pm.environment.set("offerId", selectedOffer.offerId);
	pm.environment.set("offers", jsonData.offers);

	if (desiredFlexibility) {
		pm.test("Selected offer has expected flexibility", () => {
			const actual = selectedOffer.offerSummary?.overallFlexibility;
			const success = actual === desiredFlexibility;

			validationLogger(`[INFO] Flexibility match: expected=${desiredFlexibility}, actual=${actual}, result=${success}`);

			pm.expect(actual).to.eql(desiredFlexibility);
		});

		const matchingProducts = (selectedOffer.products || []).filter(
			p => p.flexibility === desiredFlexibility
		);

		pm.test("At least one matching product has the expected flexibility", () => {
			const success = matchingProducts.length > 0;

			validationLogger(`[INFO] Matching product count = ${matchingProducts.length}, result=${success}`);

			pm.expect(matchingProducts.length).to.be.above(0);
		});
	}

	function validateSelectedOfferAdmission(selectedOffer, scenarioType, overallFlexibility) {
		if (!selectedOffer?.admissionOfferParts) return;

		// Do nothing if not FULL_FLEXIBLE
		if (overallFlexibility !== "FULL_FLEXIBLE") {
			validationLogger(`[INFO] overallFlexibility is '${overallFlexibility}' - skipping admissionOfferParts validation`);
			return;
		}

		function validateField(field, type) {
			const parts = selectedOffer.admissionOfferParts;

			pm.test(`All admissionOfferParts of selected offer are ${type}`, () => {
				const allYes = parts.every(p => p[field] === "YES");

				validationLogger(`[INFO] Scenario ${type}: all admissionOfferParts YES? ${allYes}`);

				pm.expect(allYes, `Expected all admissionOfferParts to be ${type}`).to.be.true;

				if (!allYes) {
					validationLogger(`[ERROR] Some admissionOfferParts are not ${type}`);
					pm.execution.setNextRequest(null);
					throw new Error(`⛔ Stop: selected offer admissionOfferParts are not all ${type}`);
				}
			});
		}

		if (scenarioType?.includes("EXCHANGE")) validateField("exchangeable", "exchangeable");
		if (scenarioType?.includes("REFUND"))   validateField("refundable", "refundable");
	}

	validateSelectedOfferAdmission(selectedOffer, scenarioType, selectedOffer.offerSummary?.overallFlexibility);


	return selectedOffer;
}

// Offer summary validation
function validateOfferSummary(selectedOffer) {
	validationLogger("[INFO] ➤ validateOfferSummary");
    const offerSummary = selectedOffer.offerSummary || {};
    const minimalPrice = offerSummary.minimalPrice?.amount;
    const overallFlexibility = offerSummary.overallFlexibility;
    const overallServiceClass = offerSummary.overallServiceClass?.name;
    const overallTravelClass = offerSummary.overallTravelClass;

    pm.test("Offer summary - minimalPrice is defined", function() {
        validationLogger(`[INFO] minimalPrice: ${minimalPrice}`);
        pm.expect(minimalPrice).to.be.a("number");
    });

    pm.test("Offer summary - overallFlexibility is defined", function() {
        validationLogger(`[INFO] overallFlexibility: ${overallFlexibility}`);
        pm.expect(overallFlexibility).to.be.a("string");
    });

    pm.test("Offer summary - overallServiceClass is defined", function() {
        validationLogger(`[INFO] overallServiceClass: ${overallServiceClass}`);
        pm.expect(overallServiceClass).to.be.a("string");
    });

    pm.test("Offer summary - overallTravelClass is defined", function() {
        validationLogger(`[INFO] overallTravelClass: ${overallTravelClass}`);
        pm.expect(overallTravelClass).to.be.a("string");
    });

    pm.environment.set("overallFlexibility", overallFlexibility);
}

// Passengers validation
function validatePassengers(jsonData) {
	validationLogger("[INFO] ➤ validatePassengers");
    const passengers = jsonData.anonymousPassengerSpecifications || [];
    pm.environment.set("passengerCount", passengers.length);

    pm.test("Passengers are defined", function() {
        validationLogger(`[INFO] Number of passengers: ${passengers.length}`);
        pm.expect(passengers.length).to.be.above(0);
    });

    passengers.forEach((p, i) => {
        pm.test(`Passenger ${i + 1} type is defined`, function() {
            validationLogger(`[INFO] Passenger ${i + 1} type: ${p.type}`);
            pm.expect(p.type).to.not.be.undefined;
        });

        const reductionCards = p.appliedReductionCardTypes || [];
        pm.test(`Passenger ${i + 1} reduction cards`, function() {
            validationLogger(`[INFO] Passenger ${i + 1} reductionCards: ${JSON.stringify(reductionCards)}`);
        });
    });
}

// Trips & Legs validation
function validateTripsAndLegs(jsonData) {
	validationLogger("[INFO] ➤ validateTripsAndLegs");
    const trips = jsonData.trips || [];
    pm.environment.set("tripCount", trips.length);

    pm.test("Trips are defined", function() {
        validationLogger(`[INFO] Number of trips: ${trips.length}`);
        pm.expect(trips.length).to.be.above(0);
    });

    trips.forEach((trip, tripIndex) => {
        const legs = trip.legs || [];
        pm.test(`Trip ${tripIndex + 1} has legs`, function() {
            validationLogger(`[INFO] Trip ${tripIndex + 1} has ${legs.length} leg(s)`);
            pm.expect(legs.length).to.be.above(0);
        });

        legs.forEach((leg, legIndex) => {
            const trainId = leg.timedLeg?.service?.vehicleNumbers?.[0];
            const origin = leg.timedLeg?.start?.stopPlaceName;
            const destination = leg.timedLeg?.end?.stopPlaceName;

            pm.test(`Trip ${tripIndex + 1} Leg ${legIndex + 1} has TrainID, Origin & Destination`, function() {
                validationLogger(`[INFO] Leg ${legIndex + 1} TrainID: ${trainId}, Origin: ${origin}, Destination: ${destination}`);
                pm.expect(trainId).to.not.be.undefined;
                pm.expect(origin).to.not.be.undefined;
                pm.expect(destination).to.not.be.undefined;
            });
        });
    });
}

// Offer Parts validation
function validateOfferParts(selectedOffer) {
	validationLogger("[INFO] ➤ validateOfferParts");
    const offerParts = [
        ...(selectedOffer.reservationOfferParts || []),
        ...(selectedOffer.ancillaryOfferParts || []),
        ...(selectedOffer.admissionOfferParts || [])
    ];
    const overallPrice = selectedOffer.offerSummary?.minimalPrice?.amount || 0;
    const overallFlex = selectedOffer.offerSummary?.overallFlexibility;

    // Price sum of parts
    const sumPartsPrice = offerParts.reduce((sum, p) => sum + (p.price?.amount || 0), 0);
    pm.test("Offer overallPrice >= sum of offerParts price", function() {
        validationLogger(`[INFO] overallPrice: ${overallPrice}, sumPartsPrice: ${sumPartsPrice}`);
        pm.expect(overallPrice).to.be.at.least(sumPartsPrice);
    });

    // Flexibility calculation
	//TODO Check if all products should be checked instead of only the first one
    // const flexParts = offerParts.map(p => p.products?.[0]?.flexibility || "NON_FLEXIBLE");
    // let calculatedFlex = "NON_FLEXIBLE";
    // if (flexParts.every(f => f === "FULL_FLEXIBLE")) calculatedFlex = "FULL_FLEXIBLE";
    // else if (new Set(flexParts).size === 1 && flexParts[0] === "NON_FLEXIBLE") calculatedFlex = "NON_FLEXIBLE";
    // else calculatedFlex = "SEMI_FLEXIBLE";

    // pm.test("Offer overallFlexibility consistency", function() {
    //     validationLogger(`[INFO] overallFlexibility: ${overallFlex}, calculatedFlex: ${calculatedFlex}`);
    //     pm.expect(overallFlex).to.eql(calculatedFlex);
    // });

    // Travel class
    const travelClasses = offerParts.map(p => p.products?.[0]?.travelClass || "UNKNOWN");
    const uniqueClasses = [...new Set(travelClasses)];
    const travelClassResult = uniqueClasses.length > 1 ? "MIXED" : uniqueClasses[0];

    pm.test("Offer travel class consistency", function() {
        validationLogger(`[INFO] travelClasses: ${travelClasses.join(", ")}, Result: ${travelClassResult}`);
        pm.expect(travelClassResult).to.not.eql("UNKNOWN");
    });

    // Products info
    const productIds = offerParts.flatMap(p => p.products?.map(pr => pr.productId)).filter(Boolean);
    pm.environment.set("productIds", JSON.stringify(productIds));
}

// Admission validation
function validateAdmissions(selectedOffer) {
	validationLogger("[INFO] ➤ validateAdmissions");
    const overallFlex = selectedOffer.offerSummary?.overallFlexibility;
    const admissionParts = selectedOffer.admissionOfferParts || [];

    admissionParts.forEach((part, i) => {
        let type = "NRT"; // default Non Reserved Ticket
        if (part.isTrainBound && part.includedReservation) type = "IRT";
        else if (part.isTrainBound && !part.includedReservation) type = "TLT";

        pm.test(`Admission part ${i + 1} business type`, function() {
            validationLogger(`[INFO] AdmissionOfferPart ${i + 1} type: ${type}`);
            pm.expect(["NRT", "TLT", "IRT"]).to.include(type);
        });

        // Pre-booking check
        const preBookDate = new Date(part.validUntil || part.validFrom);
        pm.test(`Admission part ${i + 1} preBookableUntil is in the future`, function() {
            validationLogger(`[INFO] preBookableUntil: ${preBookDate}`);
            pm.expect(preBookDate.getTime()).to.be.above(Date.now());
        });

        // Ancillaries & Fees presence check
        const ancillaries = part.products || [];
        pm.test(`Admission part ${i + 1} ancillaries present`, function() {
            validationLogger(`[INFO] Ancillaries: ${JSON.stringify(ancillaries.map(a => a.productId))}`);
        });

		// Refundable & Exchangeable check only if FULL_FLEXIBLE
		if (overallFlex === "FULL_FLEXIBLE") {
			pm.test(`Admission part ${i + 1} refundable/exchangeable`, function() {
				validationLogger(`[INFO] refundable: ${part.refundable}, exchangeable: ${part.exchangeable}`);
				pm.expect(part.refundable, "Refundable should be YES").to.eql("YES");
				pm.expect(part.exchangeable, "Exchangeable should be YES").to.eql("YES");
			});
		}
    });
}

// Function to extract all tripId and legId from tripLegCoverage for a given accommodationType
function getTripLegCoverage(offer, accommodationSelection) {
	const tripLegs = [];

	offer.reservationOfferParts.forEach(part => {
		if (Array.isArray(part.availablePlaces)) {
			part.availablePlaces.forEach(place => {
				if (place.accommodationType === accommodationSelection && place.tripLegCoverage) {
					tripLegs.push({
						tripId: place.tripLegCoverage.tripId,
						legId: place.tripLegCoverage.legId
					});
				}
			});
		}
	});

	return tripLegs;
}

// Helper function to handle place and accommodation selection
function handleAccommodationAndPlaceSelection(offer) {
    validationLogger("[INFO] ➤ handleAccommodationAndPlaceSelection");

    const accommodationSelection = pm.environment.get("accommodationSelection");

    if (accommodationSelection !== "COUCHETTE" && accommodationSelection !== "BERTH") {
        validationLogger(`[INFO] accommodationSelection is '${accommodationSelection}', skipping place selection`);
        pm.execution.setNextRequest("03. POST Create Booking");
        return;
    }

    const reservationParts = offer.reservationOfferParts || [];
    validationLogger(`[INFO] Reservation Offer Parts count: ${reservationParts.length}`);

    const matchingParts = reservationParts.filter(part => 
        Array.isArray(part.availablePlaces) &&
        part.availablePlaces.some(place => place.accommodationType === accommodationSelection)
    );

    if (matchingParts.length === 0) {
        validationLogger(`[WARN] No reservationOfferParts found for accommodationType: '${accommodationSelection}'`);
        pm.test(`At least one reservationOfferPart has accommodationType: ${accommodationSelection}`, function() {
            pm.expect(false, `No reservationOfferParts with accommodationType ${accommodationSelection}`).to.be.true;
        });
        return;
    }

    matchingParts.forEach(part => validationLogger(`[INFO] ${accommodationSelection} reservationOfferPart.id: ${part.id}`));
    pm.environment.set("reservationId", matchingParts[0].id);

    pm.test(`At least one reservationOfferPart has accommodationType: ${accommodationSelection}`, function() {
        pm.expect(matchingParts.length, "No matching reservationOfferParts found").to.be.above(0);
    });

    const tripLegCoverage = getTripLegCoverage(offer, accommodationSelection);
    pm.environment.set("tripLegCoverage", JSON.stringify(tripLegCoverage));
    validationLogger(`[INFO] tripLegCoverage stored in environment: ${JSON.stringify(tripLegCoverage)}`);
}


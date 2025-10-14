// Function to validate offer response
postGetOfferResponse = function (jsonData) {
	// Check if offers exist and is a non-empty array
	if (!Array.isArray(jsonData.offers) || jsonData.offers.length === 0) {
		validationLogger("[ERROR] No offers found or 'offers' is not an array.");
		pm.test("Offers array validation", function () {
			pm.expect(Array.isArray(jsonData.offers) && jsonData.offers.length > 0).to.be.true;
		});
		return;
	}

	validationLogger("[INFO] 🔍 There are " + jsonData.offers.length + " offer(s) available");
	let offer = selectAndSetOffer(jsonData);

	validateOfferSummary(offer.offerSummary);
	validatePassengers(jsonData, offer);
	validateOfferPartsAndReservationRefs(offer);
	
	// Validate overall price, flexibility, travel class, product IDs, linked legs, refundable/exchangeable flags
	validateOverallContent(offer, jsonData);
	validateTripsAndLegs(jsonData);
	validatePreBookableUntilIsInFuture(offer);
	validateAncillaryLink(offer);
	validateReservationOfferPartsDetails(offer);

	//TODO Implement if needed :https://github.com/UnionInternationalCheminsdeFer/OSDM-testing/wiki/OTST_TS_OB_OFER_01
	// ANCILLARY
	// Category
	// Type
	// feeRefs: is present the referenced fee should also be there
	handlePlaceSelection(offer);
};


// --- Below are the helper validation functions ---

// Select and set the offer based on desired flexibility; set environment
function selectAndSetOffer(data) {
    validationLogger("[INFO] ➤ selectAndSetOffer");
    const desiredFlexibility = pm.environment.get("desiredFlexibility");
	//TODO Implement accommodationTypeSelected handling
	const accommodationTypeSelected = pm.environment.get("accommodationTypeSelected");

	if (!desiredFlexibility) {
		validationLogger("[INFO] DesiredFlexibility is not set, taking the 1st offer in the list");
	} else {
		validationLogger("[INFO] DesiredFlexibility for current scenario: " + desiredFlexibility);
	}

	// Function to check if ALL availablePlaces have accommodationType equal to accommodationTypeSelected
	function allAccommodationType(offer, type) {
		return offer.reservationOfferParts.every(part => {
			if (!Array.isArray(part.availablePlaces)) {
				return true;
			}
			return part.availablePlaces.every(place => place.accommodationType === type);
		});
	}

	// Function to check if there is at least one availablePlace with accommodationType equal to accommodationTypeSelected
	function hasAccommodationType(offer, type) {
		return offer.reservationOfferParts.some(part => {
			if (!Array.isArray(part.availablePlaces)) {
				return true;
			}
			return part.availablePlaces.some(place => place.accommodationType === type);
		});
	}

	let accommodationFilter;

	if (accommodationTypeSelected === "SEAT") {
		validationLogger("[INFO] Accommodation type selected: SEAT - filtering offers with all places as SEAT");
		accommodationFilter = (offer) => allAccommodationType(offer, "SEAT");
	} else if (accommodationTypeSelected === "COUCHETTE") {
		validationLogger("[INFO] Accommodation type selected: COUCHETTE - filtering offers with at least one COUCHETTE place");
		accommodationFilter = (offer) => hasAccommodationType(offer, "COUCHETTE");
	} else if (accommodationTypeSelected === "BERTH") {
		validationLogger("[INFO] Accommodation type selected: BERTH - filtering offers with at least one BERTH place");
		accommodationFilter = (offer) => hasAccommodationType(offer, "BERTH");
	} else {
		validationLogger("[INFO] Accommodation type selected is unknown or not set - no filtering on accommodation type, only on desiredFlexibility");
		accommodationFilter = (offer) => allAccommodationType(offer, "SEAT");
	}

	// Filter offers based on desired flexibility and accommodation type
	let filteredOffers = [];
	if (desiredFlexibility) {
		filteredOffers = data.offers.filter(offer =>
			offer.offerSummary?.overallFlexibility === desiredFlexibility && accommodationFilter(offer)
		);
	} else {
		// If no desired flexibility set, filter using accommodation filter only
		filteredOffers = data.offers.filter(offer => accommodationFilter(offer));
	}


    // Select the first filtered offer, or fallback to the first offer if none match
    const selectedOffer = filteredOffers.length > 0 ? filteredOffers[0] : data.offers[0];

	console.log("[INFO] 🔍 Selected Offer:", selectedOffer);

	// Store only the selected offer, not all offers
	pm.environment.set("offers", data.offers);
	pm.environment.set("offer", JSON.stringify(selectedOffer));
	pm.environment.set("offerId", selectedOffer.offerId);


	if (desiredFlexibility) {
		// Test that the selected offer has the expected overallFlexibility
		pm.test(`Selected offer has the expected overallFlexibility (expected: ${desiredFlexibility}, actual: ${selectedOffer.offerSummary?.overallFlexibility})`, function () {
			pm.expect(selectedOffer.offerSummary?.overallFlexibility).to.eql(desiredFlexibility);
		});

		const products = selectedOffer.products || [];
		const matchingProducts = products.filter(p => p.flexibility === desiredFlexibility);

		if (matchingProducts.length === 0) {
			validationLogger(`[WARNING] No matching products found for selected offer with flexibility: ${desiredFlexibility}`);
		}

		matchingProducts.forEach((product, productIndex) => {
			validationLogger(`[INFO] Selected offer - Product ${productIndex}: flexibility: ${product.flexibility}, id: ${product.id}`);
		});

		// Test that at least one product with desired flexibility was found in selectedOffer
		pm.test(`Number of matching products in selected offer with flexibility = ${desiredFlexibility} (found: ${matchingProducts.length})`, function () {
			pm.expect(matchingProducts.length, `Expected at least 1, but found ${matchingProducts.length}`).to.be.above(0);
		});
	}

	// In EXCHANGE scenarios, verify that all admissionOfferParts are refundable
	if (pm.environment.get("scenarioType")?.includes("EXCHANGE")) {
		const admissionOfferParts = selectedOffer.admissionOfferParts || [];

		let allExchangeable = true;

		admissionOfferParts.forEach((part, index) => {
			if (part.exchangeable === "NO") {
				validationLogger(`[INFO] admissionOfferPart[${index}].exchangeable = NO`);
				allExchangeable = false;
				pm.execution.setNextRequest(null);
				throw new Error(`⛔ Exiting script: admissionOfferPart[${index}] is not exchangeable`);
			}
		});

		pm.test(`All admissionOfferParts are exchangeable in EXCHANGE scenario`, () => {
			pm.expect(allExchangeable, "All parts should be exchangeable").to.be.true;
		});
	}

	// In REFUND scenarios, verify that all admissionOfferParts are refundable
	if (pm.environment.get("scenarioType")?.includes("REFUND")) {
		const admissionOfferParts = selectedOffer.admissionOfferParts || [];

		let allRefundable = true;

		admissionOfferParts.forEach((part, index) => {
			if (part.refundable === "NO") {
				validationLogger(`[INFO] admissionOfferPart[${index}].refundable = NO`);
				allRefundable = false;
				pm.execution.setNextRequest(null);
				throw new Error(`⛔ Exiting script: admissionOfferPart[${index}] is not refundable`);
			}
		});

		pm.test(`All admissionOfferParts are refundable in REFUND scenario`, () => {
			pm.expect(allRefundable, "All parts should be refundable").to.be.true;
		});
	}

	// TODO: Implement handling for Reservation if necessary

	return selectedOffer;
}

// Validate required fields in offer summary and set environment
function validateOfferSummary(summary) {
	validationLogger("[INFO] ➤ validateOfferSummary");
    const requiredFields = ["minimalPrice", "overallFlexibility", "overallServiceClass", "overallTravelClass"]; //TODO implement overallTravellClass when implemented

    requiredFields.forEach(field => {
        const actual = summary?.[field];

        // Test presence
        pm.test(`offerSummary contains '${field}'`, function () {
            pm.expect(actual, `Expected '${field}' to be present`).to.not.be.undefined;
        });

        // Set global for reuse
        pm.environment.set(`offerSummary_${field}`, JSON.stringify(actual));

        // Log detailed info using validationLogger
        if (field === "minimalPrice") {
            validationLogger(`[INFO] minimalPrice - amount: ${actual.amount}, currency: ${actual.currency}`);
        } else if (field === "overallFlexibility") {
            validationLogger(`[INFO] overallFlexibility: ${actual}`);
        } else if (field === "overallServiceClass") {
            const type = actual.type || "N/A";
            const name = actual.name || "N/A";
            validationLogger(`[INFO] overallServiceClass - type: ${type}, name: ${name}`);
        } else if (field === "overallTravelClass") {
            validationLogger(`[INFO] overallTravelClass: ${actual}`);
        }
    });
}

// Validate passengers count, types, and reduction cards; set environment
function validatePassengers(data, offer) {
	validationLogger("[INFO] ➤ validatePassengers");
	const passengers = data.anonymousPassengerSpecifications || [];
	const expectedCount = pm.environment.get("offerPassengerNumber");

	validationLogger(`[INFO] Validating passengers (expected count: ${expectedCount}) found in data file`);
	validationLogger(`[INFO] Found ${passengers.length} anonymous passenger(s)`);

	pm.test("Number of passengers is correct", function () {
		const actual = passengers.length;
		pm.expect(actual, `Expected ${expectedCount} passenger(s), got ${actual}`).to.equal(expectedCount);
	});
	pm.environment.set("passengerCount", passengers.length);

	passengers.forEach((p, index) => {
		validationLogger(`[INFO] Passenger ${index + 1} type: ${p.type}`);
		pm.test(`Passenger ${index + 1} has a defined type`, function () {
			pm.expect(p.type, `Expected type for passenger ${index + 1}`).to.not.be.undefined;
		});
		pm.environment.set(`passenger_${index + 1}_type`, p.type);
	});

	const admissionParts = offer.admissionOfferParts || [];
	validationLogger(`[INFO] Checking appliedPassengerTypes in ${admissionParts.length} admissionOfferPart(s)`);

	let allHaveCoveredTripId = true;
	let allHavePassengerRefs = true;

	// Loop through each part and validate properties
	admissionParts.forEach((part, i) => {
		const coveredTripId = part.tripCoverage?.coveredTripId;
		const passengerRefs = part.passengerRefs || [];

		// Log the values
		validationLogger(`[INFO] AdmissionOfferPart ${i + 1} - coveredTripId: ${coveredTripId}`);
		validationLogger(`[FULL] AdmissionOfferPart ${i + 1} - passengerRefs: ${JSON.stringify(passengerRefs)}`);

		// Check for missing coveredTripId
		if (!coveredTripId) {
			allHaveCoveredTripId = false;
			validationLogger(`[ERROR] AdmissionOfferPart ${i + 1} is missing coveredTripId`);
		} else {
			pm.environment.set(`admissionPart_coveredTripId`, coveredTripId);
		}

		// Check for missing passengerRefs
		if (!Array.isArray(passengerRefs) || passengerRefs.length === 0) {
			allHavePassengerRefs = false;
			validationLogger(`[ERROR] AdmissionOfferPart ${i + 1} is missing or has empty passengerRefs`);
		} else {
			pm.environment.set(`admissionPart_${i + 1}_passengerRefs`, JSON.stringify(passengerRefs));
		}

		// Optional: Reduction cards test (if present)
		part.appliedPassengerTypes?.forEach((passenger, j) => {
			const reductionTypes = passenger.appliedReductionCardTypes;
			const hasReductions = Array.isArray(reductionTypes) && reductionTypes.length > 0;

			validationLogger(`[FULL] AdmissionOfferPart ${i + 1} - Passenger reductions: ${hasReductions ? JSON.stringify(reductionTypes) : "[] (empty or not provided)"}`);

			if (hasReductions) {
				pm.test(`Passenger in admissionOfferPart ${i + 1} has reduction cards (array)`, function () {
					pm.expect(reductionTypes, "Expected reduction card array").to.be.an("array");
				});
			} else {
				validationLogger(`[FULL] Skipping reduction card test for Passenger in admissionOfferPart ${i + 1} - no reductions provided`);
			}
		});
	});

	// Global test for coveredTripId
	pm.test("All admissionOfferParts have a coveredTripId", () => {
		pm.expect(allHaveCoveredTripId, "Some admissionOfferParts are missing coveredTripId").to.be.true;
	});

	// Global test for passengerRefs
	pm.test("All admissionOfferParts have non-empty passengerRefs", () => {
		pm.expect(allHavePassengerRefs, "Some admissionOfferParts have no passengerRefs").to.be.true;
	});
}


// Validate presence of offer part types and set environment
function validateOfferPartsAndReservationRefs(offer) {
	validationLogger("[INFO] ➤ validateOfferPartsAndReservationRefs");

	const parts = ["admissionOfferParts", "reservationOfferParts", "ancillaryOfferParts"];

	// offerParts presence test
	parts.forEach(part => {
		const isPresent = offer.hasOwnProperty(part);
		validationLogger(`[INFO] Offer has '${part}': ${isPresent}`);

		pm.test(`Offer contains '${part}'`, function () {
			pm.expect(isPresent, `Expected '${part}' to be present`).to.be.true;
		});
		pm.environment.set(`offer_has_${part}`, isPresent);
	});

	// Compare reservationRefs in admissionOfferParts with reservationOfferParts IDs
	const admissionParts = offer.admissionOfferParts || [];
	const reservationParts = offer.reservationOfferParts || [];

	admissionParts.forEach((admissionPart, partIndex) => {
		const reservations = admissionPart.reservations || [];

		reservations.forEach((res, resIndex) => {
			const reservationRefs = res.reservationGroup?.reservationRefs || [];

			reservationRefs.forEach((ref, refIndex) => {
				const refId = ref.id;

				validationLogger(`[INFO] AdmissionOfferPart ${partIndex + 1} - ReservationRef ${refIndex + 1} ID: ${refId}`);

				const match = reservationParts.some(rp => rp.id === refId);

				pm.test(`ReservationRef ID '${refId}' should exist in reservationOfferParts`, function () {
					pm.expect(match, `ReservationRef '${refId}' not found in reservationOfferParts`).to.be.true;
				});
			});
		});
	});

	let allConditionsHaveFees = true;

	// Loop through all admission parts
	admissionParts.forEach((part, partIndex) => {
		const conditions = part.afterSalesConditions || [];

		validationLogger(`[FULL] ➤ AdmissionOfferPart[${partIndex}] has ${conditions.length} afterSalesConditions`);

		// Loop through each condition and check for afterSaleFee
		conditions.forEach((condition, condIndex) => {
			const hasFee = condition.hasOwnProperty("afterSaleFee");

			validationLogger(`[FULL] afterSalesCondition[${condIndex}] for AdmissionOfferPart[${partIndex}] has afterSaleFee: ${hasFee}`);

			if (!hasFee) {
				allConditionsHaveFees = false;
				validationLogger(`[ERROR] Missing afterSaleFee in condition[${condIndex}] of AdmissionOfferPart[${partIndex}]`);
			}
		});
	});

	pm.test("All afterSalesConditions in all admissionOfferParts contain afterSaleFee", function () {
		pm.expect(allConditionsHaveFees, "One or more afterSalesConditions are missing afterSaleFee").to.be.true;
	});
}

// Validate overall price, flexibility, travel class, product IDs, linked legs, refundable/exchangeable flags
function validateOverallContent(offer, data) {
	validationLogger("[INFO] ➤ validateOverallContent");
    // Helper to extract amount safely
    function extractAmount(priceObj) {
        return priceObj && typeof priceObj.amount === "number" ? priceObj.amount : 0;
    }

    const overallPrice = extractAmount(offer.offerSummary?.minimalPrice);
    const admissionParts = offer.admissionOfferParts || [];
    const reservationParts = offer.reservationOfferParts || [];
    const ancillaryParts = offer.ancillaryOfferParts || [];

    const sumPartsPrice = parts => parts.reduce((sum, p) => sum + extractAmount(p.price), 0);
    const totalPartsPrice = sumPartsPrice(admissionParts) + sumPartsPrice(reservationParts) + sumPartsPrice(ancillaryParts);

    // Log prices
    validationLogger(`[INFO] Overall price: ${overallPrice}`);
    validationLogger(`[INFO] Total price of offer parts: ${totalPartsPrice}`);

    pm.test(`Overall price (${overallPrice}) should be greater or equal to sum of offer parts (${totalPartsPrice})`, () => {
        pm.expect(overallPrice, `Overall price (${overallPrice}) is less than sum of offer parts (${totalPartsPrice})`).to.be.at.least(totalPartsPrice);
    });
    pm.environment.set("overallPrice", overallPrice);
    pm.environment.set("totalPartsPrice", totalPartsPrice);

	//TODO Business type for Admission
	// NRT (Non Reserved Ticket) : Open ticket that can be used on any trains at any dates/hour for the trip. We can consider that an ADMISSION is an NRT if the parameter isTrainBound and the parameter includedReservation are not used.
	// TLT (Train Link Ticket) : The travel must take a dedicated train at a dedicated date and hour, but it is not mandatory to reserve a physical seat on the train. ADMISSION is an TLT if the parameter isTrainBound is set and the parameter includedReservation are not used.
	// IRT (Integrated Reservation Ticket) : The travel must take a dedicated train at a dedicated date and hour and must have a physical seat reserved. ADMISSION is an IRT if the parameter isTrainBound is set and the parameter includedReservation are set.
	// To be checked : During summer period, DB force the travel to book a seat on international destination but still selling NRT ticket. Meaning you can travel whenever you want, but you need to reserve a seat. An open point on how it is modeled (useing ReservationRequired parameter ?)

	//TODO Implement this part ?
    // // Product IDs used in offer
    // const productIDs = new Set();
    // [admissionParts, reservationParts, ancillaryParts].flat().forEach(part => {
    //     if (part.productId) productIDs.add(part.productId);
    // });

    // validationLogger(`[INFO] Product IDs used in offer: ${Array.from(productIDs).join(", ")}`);

    // pm.test(`Product IDs used in offer`, () => {
    //     pm.expect(productIDs.size, "Expected at least one product ID").to.be.greaterThan(0);
    // });
    // pm.environment.set("productIDs", JSON.stringify(Array.from(productIDs)));

    // // Trip legs linked to admission parts (at least one)
    // admissionParts.forEach((part, i) => {
    //     const linkedLegs = part.linkedTripLegs || [];
    //     validationLogger(`[FULL] Admission part ${i + 1} linked to ${linkedLegs.length} trip leg(s)`);
    //     pm.test(`Admission part ${i + 1} should have linked trip legs`, () => {
    //         pm.expect(linkedLegs.length).to.be.greaterThan(0);
    //     });
    // });

    // Refundable & exchangeable YES NO following offer
    [admissionParts, reservationParts, ancillaryParts].flat().forEach((part, i) => {
        validationLogger(`[FULL] Offer part ${i + 1} - refundable: ${part.refundable}, exchangeable: ${part.exchangeable}`);
    });
}

// Validate trips and legs and set environment
function validateTripsAndLegs(data) {
	validationLogger("[INFO] ➤ validateTripsAndLegs");
	const trips = data.trips || [];

	validationLogger(`[INFO] Validating trips and legs`);
	validationLogger(`[INFO] Found ${trips.length} trip(s)`);

	pm.test("Trips are defined", function () {
		const actual = trips.length;
		pm.expect(actual, `Expected at least 1 trip, got ${actual}`).to.be.greaterThan(0);
	});
	pm.environment.set("tripCount", trips.length);

	let totalLegs = 0;
	let allLegsHaveTrainId = true;
	let allLegsHaveOrigin = true;
	let allLegsHaveDestination = true;

	const coveredTripId = pm.environment.get("admissionPart_coveredTripId");
	const targetTrip = (data.trips || []).find(trip => trip.id === coveredTripId);

	if (!targetTrip) {
		validationLogger(`[WARN] No trip found matching coveredTripId: ${coveredTripId}`);
	} else {
		const legs = targetTrip.legs || [];
		validationLogger(`[INFO] Matching Trip ID: ${coveredTripId} contains ${legs.length} leg(s)`);
		totalLegs += legs.length;

		legs.forEach((leg, legIndex) => {
			const trainId = leg.timedLeg?.service?.vehicleNumbers?.[0];
			const origin = leg.timedLeg?.start?.stopPlaceName;
			const destination = leg.timedLeg?.end?.stopPlaceName;

			validationLogger(`[INFO] Leg ${legIndex + 1} - Train ID: ${trainId}, Origin: ${origin}, Destination: ${destination}`);

			if (trainId === undefined) allLegsHaveTrainId = false;
			if (origin === undefined) allLegsHaveOrigin = false;
			if (destination === undefined) allLegsHaveDestination = false;
		});
	}


	validationLogger(`[INFO] Total number of legs: ${totalLegs}`);

	pm.test("Total number of legs is greater than 0", function () {
		pm.expect(totalLegs, `Expected at least 1 leg, got ${totalLegs}`).to.be.greaterThan(0);
	});
	pm.environment.set("totalLegs", totalLegs);

	pm.test("All legs have defined train IDs, origins, and destinations", function () {
		pm.expect(allLegsHaveTrainId, "Not all legs have a train ID").to.be.true;
		pm.expect(allLegsHaveOrigin, "Not all legs have an origin").to.be.true;
		pm.expect(allLegsHaveDestination, "Not all legs have a destination").to.be.true;
	});
}


function validatePreBookableUntilIsInFuture(offer) {
	const preBookableUntilStr = offer.preBookableUntil;
	const now = new Date();
	const preBookableUntil = new Date(preBookableUntilStr);

	const isFuture = preBookableUntil > now;

	validationLogger(`[INFO] preBookableUntil: ${preBookableUntil.toISOString()} (now: ${now.toISOString()})`);
	validationLogger(`[INFO] preBookableUntil is in the future: ${isFuture}`);

	pm.test("preBookableUntil is in the future", function () {
		pm.expect(isFuture, `Expected preBookableUntil (${preBookableUntil.toISOString()}) to be in the future`).to.be.true;
	});
}

function validateAncillaryLink(offer) {
	validationLogger("[INFO] ➤ validateAncillaryLink admissionOfferPart.ancillaryGroup.id and ancillaryOfferParts.id");

	const admissionParts = offer.admissionOfferParts || [];
	const ancillaryParts = offer.ancillaryOfferParts || [];

	let allAncillaryGroupsMatch = true;

	// Loop through admission parts to check ancillaries
	admissionParts.forEach((admission, i) => {
		const ancillaries = admission.ancillaries || [];

		ancillaries.forEach((ancillary, j) => {
			let groupId = ancillary.ancillaryGroup?.id;

			if (!groupId) {
				validationLogger(`[WARN] No ancillaryGroup.id found in admissionOfferPart ${i + 1}, ancillary ${j + 1}`);
				return;
			}

			// Remove 'ancillariesGroup:' prefix if present
			const cleanedGroupId = groupId.replace(/^ancillariesGroup:/, "");
			const match = ancillaryParts.find(p => p.id === cleanedGroupId);
			const found = !!match;

			validationLogger(`[FULL] AdmissionOfferPart ${i + 1} - Ancillary ${j + 1}: Searching for ID '${cleanedGroupId}' ➤ Found: ${found}`);

			if (!found) {
				allAncillaryGroupsMatch = false;
				validationLogger(`[ERROR] Ancillary group ID '${cleanedGroupId}' not found in ancillaryOfferParts`);
			}
		});
	});

	// Single test to validate all ancillary group ID matches
	pm.test("All ancillaryGroup.id in admissionOfferParts match an id in ancillaryOfferParts", function () {
		pm.expect(allAncillaryGroupsMatch, "Some ancillaryGroup.id values did not match any ancillaryOfferPart.id").to.be.true;
	});

}

// Validate reservationOfferParts details and references
function validateReservationOfferPartsDetails(offer) {
    validationLogger("[INFO] ➤ validateReservationOfferPartsDetails");

    const reservationParts = offer.reservationOfferParts || [];

	let allAvailablePlacesValid = true;
	let allNumericAvailabilityValid = true;
	let allAvailablePlacePreferencesValid = true;
	let allFeeRefsValid = true;
	let allAncillariesValid = true;

	reservationParts.forEach((part, index) => {
		const prefix = `reservationOfferParts[${index}]`;

		// Check numericAvailability ONLY IF present
		if (Object.prototype.hasOwnProperty.call(part, "numericAvailability")) {
			validationLogger(`[FULL] ${prefix}.numericAvailability: ${part.numericAvailability}`);
			const valid = typeof part.numericAvailability === "number";
			if (!valid) {
				allNumericAvailabilityValid = false;
				validationLogger(`[ERROR] ${prefix}.numericAvailability is not a number`);
			}
		}

		// Check availablePlaces ONLY IF present
		if (Array.isArray(part.availablePlaces)) {
			const count = part.availablePlaces.length;
			validationLogger(`[FULL] ${prefix}.availablePlaces count: ${count}`);

			if (count === 0) {
				allAvailablePlacesValid = false;
				validationLogger(`[ERROR] ${prefix}.availablePlaces is empty`);
			}

			part.availablePlaces.forEach((place, pIndex) => {
				const hasAccommodationType = typeof place.accommodationType === "string";
				const hasNumericAvailability = typeof place.numericAvailability === "number";

				if (!hasAccommodationType || !hasNumericAvailability) {
					allAvailablePlacesValid = false;
					validationLogger(`[ERROR] ${prefix}.availablePlaces[${pIndex}] missing required fields`);
				}
			});
		}

		// Check availablePlacePreferences ONLY IF present
		if (Object.prototype.hasOwnProperty.call(part, "availablePlacePreferences")) {
			const prefs = part.availablePlacePreferences;
			validationLogger(`[FULL] ${prefix}.availablePlacePreferences: ${JSON.stringify(prefs)}`);

			const valid = Array.isArray(prefs) && prefs.length > 0;
			if (!valid) {
				allAvailablePlacePreferencesValid = false;
				validationLogger(`[ERROR] ${prefix}.availablePlacePreferences is not a non-empty array`);
			}
		}

		// Check feeRefs ONLY IF present
		if (Array.isArray(part.feeRefs)) {
			validationLogger(`[FULL] ${prefix}.feeRefs: ${JSON.stringify(part.feeRefs)}`);

			part.feeRefs.forEach((feeRef, i) => {
				const feeFound = offer.fees?.some(fee => fee.id === feeRef.id);
				if (!feeFound) {
					allFeeRefsValid = false;
					validationLogger(`[ERROR] ${prefix}.feeRefs[${i}].id '${feeRef.id}' not found in offer.fees`);
				}
			});
		}

		// Check ancillaries ONLY IF present
		if (Array.isArray(part.ancillaries)) {
			validationLogger(`[FULL] ${prefix}.ancillaries: ${JSON.stringify(part.ancillaries)}`);

			part.ancillaries.forEach((ancillaryItem, aIndex) => {
				const refs = ancillaryItem.ancillaryGroup?.ancillaryRefs || [];

				refs.forEach((ref, rIndex) => {
					const cleanId = ref.id.replace(/^ancillariesGroup:/, "");
					const found = (offer.ancillaryOfferParts || []).some(a => a.id === cleanId);

					if (!found) {
						allAncillariesValid = false;
						validationLogger(`[ERROR] ${prefix}.ancillaryRefs[${rIndex}]: '${cleanId}' not found in ancillaryOfferParts`);
					}
				});
			});
		}
	});

	// Final assertions (only run if at least one field was present and checked)

	if (reservationParts.some(p => "numericAvailability" in p)) {
		pm.test("numericAvailability (if present) is valid", function () {
			pm.expect(allNumericAvailabilityValid, "Some numericAvailability values are invalid").to.be.true;
		});
	}

	if (reservationParts.some(p => Array.isArray(p.availablePlaces))) {
		pm.test("availablePlaces (if present) are valid", function () {
			pm.expect(allAvailablePlacesValid, "Some availablePlaces are invalid").to.be.true;
		});
	}

	if (reservationParts.some(p => "availablePlacePreferences" in p)) {
		pm.test("availablePlacePreferences (if present) are valid", function () {
			pm.expect(allAvailablePlacePreferencesValid, "Some availablePlacePreferences are invalid").to.be.true;
		});
	}

	if (reservationParts.some(p => Array.isArray(p.feeRefs))) {
		pm.test("feeRefs (if present) reference valid fees", function () {
			pm.expect(allFeeRefsValid, "Some feeRefs reference unknown fees").to.be.true;
		});
	}

	if (reservationParts.some(p => Array.isArray(p.ancillaries))) {
		pm.test("ancillaries (if present) reference valid ancillaryOfferParts", function () {
			pm.expect(allAncillariesValid, "Some ancillaries reference unknown ancillaryOfferParts").to.be.true;
		});
	}

}



// Helper function to handle place selection
function handlePlaceSelection(offer) {
	validationLogger("[INFO] ➤ handlePlaceSelection");
	if (pm.environment.get("requiresPlaceSelection") === true) {
		const reservationParts = offer.reservationOfferParts || [];
		validationLogger("[INFO] Reservation Offer Parts:", reservationParts);
		//TODO Implement for "SEAT","COUCHETTE","BERTH","VEHICLE","STORAGE"
		const partIds = reservationParts
			.filter(part =>
				Array.isArray(part.availablePlaces) &&
				part.availablePlaces.some(place => place.accommodationType === "COUCHETTE")
			)
			.map(part => part.id);

		// Logging the result
		validationLogger(`[INFO] Found ${partIds.length} reservationOfferParts with accommodationType: 'COUCHETTE'`);
		partIds.forEach((id) => {
			validationLogger(`[INFO] COUCHETTE reservationOfferPart.id: ${id}`);
		});

		// Set global for further use if needed
		pm.environment.set("reservationId", partIds[0]);

		// Optional test
		pm.test("At least one reservationOfferPart has accommodationType: COUCHETTE/ (if present)", function () {
			if (reservationParts.length > 0) {
				pm.expect(partIds.length, "No COUCHETTE accommodationType found").to.be.above(0);
			} else {
				pm.expect(true).to.be.true; // Skip if no reservation parts
			}
		});
	} else {
		validationLogger("skipping Get Place Maps for Reservation of Offer");
		pm.execution.setNextRequest("03. POST Create Booking");
	}
}
// Function to check warnings and problems in the response
checkWarningsAndProblems = function (jsonData) {
	try {
		jsonData.warnings
			? validationLogger(`[WARNING] ⚠️ Warning: ${jsonData.warnings}`)
			: validationLogger("[WARNING] ⚠️ No warnings found.");

		if (jsonData.problems?.length > 0) {
			validationLogger(`Problems found (${jsonData.problems.length}):`);
			jsonData.problems.forEach((problem, index) => {
				validationLogger(`[WARNING] ⚠️ Problem ${index + 1}:`);
				["code", "type", "title", "status", "detail"].forEach(key => {
					validationLogger(`[WARNING] ⚠️ ${key.charAt(0).toUpperCase() + key.slice(1)}: ${problem[key] || 'Not available'}`);
				});

				if (problem.pointers?.length > 0) {
					problem.pointers.forEach((pointer, pointerIndex) => {
						validationLogger(`[WARNING] ⚠️ Pointer ${pointerIndex + 1}:`);
						["code", "requestPointer"].forEach(key => {
							validationLogger(`[WARNING] ⚠️ ${key.charAt(0).toUpperCase() + key.slice(1)}: ${pointer[key] || 'Not available'}`);
						});
					});
				} else {
					validationLogger("[WARNING] ⚠️ No pointers found.");
				}
			});
		} else {
			validationLogger("[WARNING] ⚠️ No problems found.");
		}
	} catch (error) {
		validationLogger(`[WARNING] ⚠️ Error processing the response: ${error.message}`);
	}
}

postOfferResponsePreRequest = function () {
	validationLogger("[INFO] ➤ postOfferResponsePreRequest");
	console.log("⏩ [STEP] Executing request : " + pm.info.requestName);
	
	buildOfferCollectionRequest();
	
	console.log("[INFO] OfferCollectionRequest: "+pm.environment.get("OfferCollectionRequest"));
	
	ensureAuthorizationOr403();

	//captureSwaggerSchemaValidator();

	//TODO Implement logging of request and response headers and body later
	// let reqHeaders = {};
	// if (pm.request?.headers) {
	// 	pm.request.headers.each(header => {
	// 		reqHeaders[header.key] = header.value;
	// 	});
	// }
	// pm.environment.set("requestHeaders", JSON.stringify(reqHeaders));
	// pm.environment.set("method", pm.request?.method || '');
	// pm.environment.set("url", pm.request?.url?.toString() || '');

	// let resHeaders = {};
	// if (pm.response?.headers) {
	// 	pm.response.headers.each(header => {
	// 		resHeaders[header.key] = header.value;
	// 	});
	// }
	// pm.environment.set("responseHeaders", JSON.stringify(resHeaders));

	// pm.environment.set("responseBody", pm.response?.text() || '');

	//swaggerSchemaValidatorContent();
}

function ensureAuthorizationOr403() {
	validationLogger("[INFO] ➤ ensureAuthorizationOr403");
	validationLogger("[INFO] Run a preoffer authorization check to avoid 403 errors ...");
	function resolveVars(str) {
		if (!str) return str;
		return str.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
			return pm.environment.get(varName);
		});
	}
	let resolvedUrl = resolveVars(pm.request.url.toString());
	let rawHeaders = pm.request.headers.toObject();
	let resolvedHeaders = {};

	Object.keys(rawHeaders).forEach(key => {
		resolvedHeaders[key] = resolveVars(rawHeaders[key]);
	});

	let rawBody = pm.request.body?.toString();
	let resolvedBody = rawBody ? resolveVars(rawBody) : null;

	if (resolvedBody) {
		try {
			resolvedBody = JSON.parse(resolvedBody);
		} catch (e) {
		}
	}

	pm.sendRequest({
		url: resolvedUrl,
		method: pm.request.method,
		header: resolvedHeaders,
		body: JSON.stringify(resolvedBody)
	}, function (err, res) {
		if (res && (res.code === 403 || res.code === 401)) {
			console.log("⛔ Stop: Access forbidden (403)  or Unauthorized (401). Check permissions. Access token could be expired.")
			pm.execution.setNextRequest(null);
		} else if (res && res.code == 400) {
			var jsonData = JSON.parse(res.text());
			console.log(jsonData)
			console.log("⛔ Stop: Bad Request (400). Check request parameters and body. Issue probably due to authorization. Check above logs for details.");
			pm.execution.setNextRequest(null);
		} else {
			validationLogger("[INFO] ✅ Authorization check passed.");
		}
	});
}

// Function to validate offer response
function postOfferResponse(jsonData) {
	validationLogger("[INFO] ➤ postOfferResponse");
	// Stop flow if offers invalid
	if (!Array.isArray(jsonData.offers) || jsonData.offers.length === 0) {
		validationLogger("[ERROR] No offers found or 'offers' is not an array.");
		pm.execution.setNextRequest(null);
		return;
	}

	// Check offers exist
	pm.test(`'offers' array exists with ${jsonData.offers.length} offer(s)`, () => {
		pm.expect(jsonData.offers, "[ERROR] 'offers' is missing or empty").to.be.an("array").that.is.not.empty;
		validationLogger(`[INFO] 'offers' array exists with ${jsonData.offers.length} offer(s)`);
	});

	let selectedOffer = selectAndSetOffer(jsonData);

	validateOfferSummary(selectedOffer);
	validatePassengers(jsonData);
	validateOfferParts(selectedOffer);
	validateTripsAndLegs(jsonData);
	validateAdmissions(selectedOffer);
	validateReservations(selectedOffer);
	validateAncillaries(selectedOffer);

	handleAccommodationAndPlaceSelection(selectedOffer);
	ensureYesWhenRefundOrExchangeSelected(selectedOffer);

	pm.environment.set("admissionReservationAncillaryOfferPartsIds", pm.environment.get("admissionReservationAncillaryOfferPartsIds"));
};

// select and set offer based on criteria
function selectAndSetOffer(jsonData) {
	validationLogger("[INFO] ➤ selectAndSetOffer");

	const desiredFlexibility = pm.environment.get("desiredFlexibility");
	const accommodationSelection = pm.environment.get("accommodationSelection");
	const scenarioType = pm.environment.get("scenarioType");

	// match accommodation type in reservationOfferParts
	function matchesAccommodation(offer, expectedType, requireAll = false) {
		return (offer.reservationOfferParts || []).some(part => {
			if (!Array.isArray(part.availablePlaces)) return true;

			return requireAll
				? part.availablePlaces.every(place => place.accommodationType === expectedType)
				: part.availablePlaces.some(place => place.accommodationType === expectedType);
		});
	}

	let filteredOffers = jsonData.offers;

	// Different accommodation selection handling
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

	// Apply flexibility filter if specified
	if (desiredFlexibility) {
		validationLogger(`[INFO] Applying flexibility filter: ${desiredFlexibility}`);
		filteredOffers = filteredOffers.filter(o =>
			o.offerSummary?.overallFlexibility === desiredFlexibility
		);
	}

	// Select the first matching offer or default to the first offer
	const selectedOffer = filteredOffers[0] || jsonData.offers[0];

	validationLogger(`[INFO] Selected Offer ID: ${selectedOffer.offerId}`);
	console.log("[INFO] 🔍 Selected Offer:", selectedOffer);

	// Store selected offer and related info in environment
	pm.environment.set("offer", selectedOffer);
	pm.environment.set("offerId", selectedOffer.offerId);
	pm.environment.set("offers", jsonData.offers);

	if (desiredFlexibility) {
		const actual = selectedOffer.offerSummary?.overallFlexibility;
		pm.test(`Selected offer has expected flexibility - expected: ${desiredFlexibility}, actual: ${actual}`, () => {
			validationLogger(`[INFO] Selected offer has expected flexibility - expected: ${desiredFlexibility}, actual: ${actual}`);
			pm.expect(actual).to.eql(desiredFlexibility);
		});

		const matchingProducts = (selectedOffer.products || []).filter(p => p.flexibility === desiredFlexibility);
		pm.test(`At least one matching product has the expected flexibility - count : ${matchingProducts.length}`, () => {
			validationLogger(`[INFO] At least one matching product has the expected flexibility - count : ${matchingProducts.length}`);
			pm.expect(matchingProducts.length).to.be.above(0);
		});
	}

	function validateSelectedOfferAdmission(selectedOffer, scenarioType, overallFlexibility) {
		if (!selectedOffer?.admissionOfferParts) return;

		// Do nothing if not FULL_FLEXIBLE
		//TODO review this part, FULL_FLEXIBLE should be checked only if scenario requires it ?
		if (overallFlexibility !== "FULL_FLEXIBLE") {
			validationLogger(`[INFO] overallFlexibility is '${overallFlexibility}' - skipping admissionOfferParts validation`);
			return;
		}

		function validateField(field, type) {
			const parts = selectedOffer.admissionOfferParts;
			const allYes = parts.every(p => p[field] === "YES");
			pm.test(`All admissionOfferParts of selected offer are ${type} - expected: YES, actual: ${parts.map(p => p[field]).join(", ")}`, () => {
				validationLogger(`[INFO] All admissionOfferParts of selected offer are ${type} - expected: YES, actual: ${parts.map(p => p[field]).join(", ")}`);
				pm.expect(allYes, `Expected all admissionOfferParts to be ${type}`).to.be.true;
				if (!allYes) {
					validationLogger(`[ERROR] Some admissionOfferParts are not ${type}`);
					pm.execution.setNextRequest(null);
					throw new Error(`⛔ Stop: selected offer admissionOfferParts are not all ${type}`);
				}
			});
		}

		if (scenarioType?.includes("EXCHANGE")) validateField("exchangeable", "exchangeable");
		if (scenarioType?.includes("REFUND")) validateField("refundable", "refundable");
	}
	validateSelectedOfferAdmission(selectedOffer, scenarioType, selectedOffer.offerSummary?.overallFlexibility);

	return selectedOffer;
}

// Offer summary validation
function validateOfferSummary(selectedOffer) {
	validationLogger("[INFO] ➤ validateOfferSummary");
	const offerSummary = selectedOffer.offerSummary || {};
	const mini = offerSummary.minimalPrice;
	const minimalPrice = offerSummary.minimalPrice?.amount;
	const overallFlexibility = offerSummary.overallFlexibility;
	const overallServiceClass = offerSummary.overallServiceClass?.name;
	const overallTravelClass = offerSummary.overallTravelClass;

	// Minimal price validation
	pm.test(`Offer summary - minimalPrice structure exists and is a number : ${minimalPrice}`, function () {
		validationLogger(`[INFO] Offer summary - minimalPrice structure exists and is a number : ${minimalPrice}`);
		pm.expect(minimalPrice).to.exist.and.is.a("number");
	});

	// Check all price fields (amount, currency, scale) exist in minimalPrice
	pm.test(`Price fields exist (currency, scale) exist in minimalPrice`, () => {
		pm.expect(mini, 'minimalPrice is missing').to.exist;
		validationLogger(`[INFO] Price fields (currency, scale) are present in minimalPrice`);
		['currency', 'scale'].forEach(field => {
			pm.expect(mini[field], `minimalPrice.${field} missing`).to.exist;
		});
	});

	// Overall flexibility validation
	pm.test(`Offer summary - overallFlexibility is defined - overallFlexibility: ${overallFlexibility}`, function () {
		validationLogger(`[INFO] Offer summary - overallFlexibility is defined - overallFlexibility: ${overallFlexibility}`);
		pm.expect(overallFlexibility).to.be.a("string");
		pm.environment.set("overallFlexibility", overallFlexibility);
	});

	// Overall service class validation
	pm.test(`Offer summary - overallServiceClass is defined - overallServiceClass: ${overallServiceClass}`, function () {
		validationLogger(`[INFO] Offer summary - overallServiceClass is defined - overallServiceClass: ${overallServiceClass}`);
		pm.expect(overallServiceClass).to.be.a("string");
	});

	// Overall travel class validation
	if (overallTravelClass) {
		pm.test(`Offer summary - overallTravelClass is defined - overallTravelClass: ${overallTravelClass}`, function () {
			validationLogger(`[INFO] Offer summary - overallTravelClass is defined - overallTravelClass: ${overallTravelClass}`);
			pm.expect(overallTravelClass).to.be.a("string");
		});
	} else {
		validationLogger(`[INFO] overallTravelClass is not present in offer summary → test skipped`);
	}

}

// Passengers validation
function validatePassengers(jsonData) {
	validationLogger("[INFO] ➤ validatePassengers");
	const passengers = jsonData.anonymousPassengerSpecifications || [];
	pm.environment.set("passengerCount", passengers.length);

	pm.test(`Passengers are defined - length: ${passengers.length}`, function () {
		validationLogger(`[INFO] Passengers are defined - length: ${passengers.length}`);
		pm.expect(passengers.length).to.be.above(0);
	});

	passengers.forEach((p, i) => {
		pm.test(`Passenger ${i + 1} type is defined - type: ${p.type}`, function () {
			validationLogger(`[INFO] Passenger ${i + 1} type is defined - type: ${p.type}`);
			pm.expect(p.type).to.not.be.undefined;
		});

		const reductionCards = p.appliedReductionCardTypes || [];
		pm.test(`Passenger ${i + 1} reduction cards - reductionCards: ${JSON.stringify(reductionCards)}`, function () {
			validationLogger(`[INFO] Passenger ${i + 1} reduction cards - reductionCards: ${JSON.stringify(reductionCards)}`);
		});
	});
}

// Trips & Legs validation
function validateTripsAndLegs(jsonData) {
	validationLogger("[INFO] ➤ validateTripsAndLegs");
	const trips = jsonData.trips || [];
	
	pm.test(`Trips are defined - length: ${trips.length}`, function () {
		validationLogger(`[INFO] Trips are defined - length: ${trips.length}`);
		pm.expect(trips.length).to.be.above(0);
	});
	
	// Capture trip ids and compare to coveredTripId
	const tripIds = (jsonData.trips || []).map(trip => trip.id).filter(id => id !== undefined && id !== null);
	validationLogger(`[INFO] tripIds found: ${JSON.stringify(tripIds)}`);
	const coveredTripId = pm.environment.get("coveredTripId");
	pm.test(`selectedOffer.tripCoverage.coverageTripId if part of Trip ids - coveredTripId: ${coveredTripId}`, function () {
		validationLogger(`[INFO] selectedOffer.tripCoverage.coverageTripId if part of Trip ids - coveredTripId: ${coveredTripId}`);
		pm.expect(tripIds).to.include(coveredTripId);
	});

	trips.forEach((trip, tripIndex) => {
		const legs = trip.legs || [];
		if (legs.length > 0) {
			pm.test(`Trip ${tripIndex + 1} has legs - length: ${legs.length}`, function () {
				validationLogger(`[INFO] Trip ${tripIndex + 1} has legs - length: ${legs.length}`);
				pm.expect(legs.length).to.be.above(0);
			});
		} else {
			validationLogger(`[INFO] Trip ${tripIndex + 1} has no legs (provider may not return legs) → test skipped`);
		}

		// Display TrainID, Origin & Destination
		legs.forEach((leg, legIndex) => {
			const trainId = leg.timedLeg?.service?.vehicleNumbers?.[0];
			const origin = leg.timedLeg?.start?.stopPlaceName;
			const destination = leg.timedLeg?.end?.stopPlaceName;

			pm.test(`Trip ${tripIndex + 1} Leg ${legIndex + 1} has TrainID, Origin & Destination - TrainID: ${trainId}, Origin: ${origin}, Destination: ${destination}`, function () {
				validationLogger(`[INFO] Trip ${tripIndex + 1} Leg ${legIndex + 1} has TrainID, Origin & Destination - TrainID: ${trainId}, Origin: ${origin}, Destination: ${destination}`);
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

	const admissionParts = selectedOffer.admissionOfferParts || [];
	const reservationParts = selectedOffer.reservationOfferParts || [];
	const ancillaryParts = selectedOffer.ancillaryOfferParts || [];

	const sumPrice = parts => parts.reduce((sum, p) => sum + (p.price?.amount || 0), 0);

	// Collect all referenced ancillary IDs from admissionOfferParts
	const referencedAncillaryIds = new Set();
	admissionParts.forEach(admissionPart => {
		const ancillaries = admissionPart.ancillaries || [];
		ancillaries.forEach(ancillary => {
			const ancillaryRefs = ancillary.ancillaryGroup?.ancillaryRefs || [];
			ancillaryRefs.forEach(ref => {
				if (ref.id) {
					referencedAncillaryIds.add(ref.id);
				}
			});
		});
	});

	// Filter ancillaryParts to only those that are referenced
	const referencedAncillaryParts = ancillaryParts.filter(part => referencedAncillaryIds.has(part.id));

	// Stock referenced ancillary IDs in environment
	pm.environment.set("referencedAncillaryIds", JSON.stringify([...referencedAncillaryIds]));

	const admissionPrice = sumPrice(admissionParts);
	const reservationPrice = sumPrice(reservationParts);
	const ancillaryPrice = sumPrice(referencedAncillaryParts);

	validationLogger(`[INFO] Admission parts price: ${admissionPrice}`);
	validationLogger(`[INFO] Reservation parts price: ${reservationPrice}`);
	validationLogger(`[INFO] Ancillary parts price: ${ancillaryPrice}`);

	const offerParts = [...admissionParts, ...reservationParts, ...referencedAncillaryParts];

	const minimalPrice = selectedOffer.offerSummary?.minimalPrice?.amount || 0;
	pm.environment.set("minimalPrice", minimalPrice);
	pm.environment.set("admissionPartsPrice", admissionPrice);
	pm.environment.set("reservationPartsPrice", reservationPrice);
	pm.environment.set("ancillaryPartsPrice", ancillaryPrice);

	const overallFlex = selectedOffer.offerSummary?.overallFlexibility;

	const sumPartsPrice = sumPrice(offerParts);

	pm.test(`Offer minimalPrice >= sum of offerParts price - minimalPrice: ${minimalPrice}, sumPartsPrice: ${sumPartsPrice}`, function () {
		validationLogger(`[INFO] Offer minimalPrice >= sum of offerParts price - minimalPrice: ${minimalPrice}, sumPartsPrice: ${sumPartsPrice}`);
		pm.expect(minimalPrice).to.be.at.least(sumPartsPrice);
	});


	// Flexibility calculation
	//TODO Check if all products should be checked instead of only the first one
	//Is this check in jsonData.products[] ?
	const productFlex = Array.from(new Set(selectedOffer?.products?.map(p => p.flexibility).filter(Boolean)));

	// If at least one product is FULL_FLEXIBLE, the result is FULL_FLEXIBLE
	const flexibilityResult = productFlex.includes("FULL_FLEXIBLE") ? "FULL_FLEXIBLE" : (productFlex.length === 1 ? productFlex[0] : "SEMI_FLEXIBLE");

	pm.test(`Offer overallFlexibility consistency - overallFlex: ${overallFlex}, flexibilityResult: ${flexibilityResult}`, () => {
		validationLogger(`[INFO] productFlex: ${productFlex.join(", ")}, Result: ${flexibilityResult}`);
		pm.expect(overallFlex).to.eql(flexibilityResult);
	});

	// capture coveredTripId if value exists
	const coveredTripId = selectedOffer.tripCoverage && selectedOffer.tripCoverage.coveredTripId;
	if (coveredTripId !== undefined && coveredTripId !== null) {
		validationLogger(`[INFO] Covered Trip ID: ${coveredTripId}`);
		pm.environment.set("coveredTripId", coveredTripId);
	}

	// Travel class
	//TODO Travel Class : In some cases the travel class of a short leg is lower than the longer one.
	// The Railway could decide to use the Travel class of the longest leg
	// (need to check if travel class can be flagged as mixed for exemple if trip is based on
	// 2 segments equivalent in duration one in 1st, one in second)
	// const travelClasses = Array.from(new Set(selectedOffer?.products?.map(p => p.travelClass).filter(Boolean)));

	// Return MIXED if multiple travel classes found ?
	// const travelClassResult = travelClasses.length === 1 ? travelClasses[0] : "MIXED";
	// pm.test(`Offer travel class consistency - travelClasses: ${travelClasses.join(", ")}, Result: ${travelClassResult}`, () => {
	// 	validationLogger(`[INFO] travelClasses: ${travelClasses.join(", ")}, Result: ${travelClassResult}`);
	// 	pm.expect(travelClassResult).to.not.eql("UNKNOWN");
	// });

}

// Admission validation
function validateAdmissions(selectedOffer) {
	validationLogger("[INFO] ➤ validateAdmissions");

	const overallFlex = selectedOffer.offerSummary?.overallFlexibility;
	const admissionParts = selectedOffer.admissionOfferParts || [];
	const reservationParts = selectedOffer.reservationOfferParts || [];
	const ancillaryParts = selectedOffer.ancillaryOfferParts || [];
	const admissionReservationAncillaryOfferPartsIds = pm.environment.get("admissionReservationAncillaryOfferPartsIds") || [];
	let admissionReservationAncillaryOfferPartsAftersalesConditions = pm.environment.get("admissionReservationAncillaryOfferPartsAftersalesConditions") || 0;

	if (admissionParts.length > 0) {
		admissionParts.forEach((admission, i) => {
			validationLogger(`[INFO] Validating admissionOfferParts ${i + 1} id=${admission.id}`);
			admissionReservationAncillaryOfferPartsIds.push(admission.id);
			pm.environment.set("admissionReservationAncillaryOfferPartsIds", admissionReservationAncillaryOfferPartsIds);

			// Determine business type of admission (NRT / IRT)
			let type = "NRT"; // Default: Non Reserved Ticket
			if (admission.isReservationRequired && Array.isArray(admission.reservations) && admission.reservations.length > 0) type = "IRT";

			pm.test(`AdmissionOfferPart ${i + 1} type: ${type}`, function () {
				validationLogger(`[INFO] AdmissionOfferPart ${i + 1} type: ${type}`);
				pm.expect(["NRT", "TLT", "IRT"]).to.include(type);
			});

			// validUntil must be in the future
			const validUntil = new Date(admission.validUntil);
			pm.test(`AdmissionOfferPart ${i + 1} validUntil is in the future - validUntil: ${validUntil}`, function () {
				validationLogger(`[INFO] AdmissionOfferPart ${i + 1} validUntil is in the future - validUntil: ${validUntil}`);
				pm.expect(validUntil.getTime()).to.be.above(Date.now());
			});

			// Validate linkage to reservationOfferParts (handles both Paxone: reservationsGroup.reservationsRefs and Turnit: reservationGroup.reservationRefs)
			const reservationsRefs = admission?.reservations?.flatMap(r =>
				r.reservationGroup?.reservationRefs || r.reservationsGroup?.reservationsRefs || []
			) || [];
			if (reservationsRefs.length > 0) {
				pm.test(`Reservation linkage in admission with id ${admission.id}, reservationsRef ids should match reservationOfferParts ids`, () => {
					reservationsRefs.forEach(ref => {
						const found = reservationParts.some(r => r.id === ref.id);
						validationLogger(`[INFO] reservationsRef.id : ${ref.id} → match in reservationOfferParts : ${found}`);
						pm.expect(found, `reservationOfferParts should contain id ${ref.id}`).to.eql(true);
					});
				});

			} else {
				validationLogger(`[INFO] No reservationsRefs found for admission id=${admission.id} → test skipped`);
			}

			// Validate linkage to ancillaryOfferParts
			const ancillaryRefs = admission?.ancillaries?.flatMap(r => r.ancillaryGroup?.ancillaryRefs || []) || [];
			if (ancillaryRefs.length > 0) {
				pm.test(`Ancillary linkage in admission with id ${admission.id}, ancillaryRef ids should match ancillaryOfferParts ids`, () => {
					ancillaryRefs.forEach(ref => {
						const found = ancillaryParts.some(a => a.id === ref.id);
						validationLogger(`[INFO] ancillaryRef.id : ${ref.id} → match in ancillaryOfferParts : ${found}`);
						pm.expect(found, `ancillaryOfferParts should contain id ${ref.id}`).to.eql(true);
					});
				});
			} else {
				validationLogger(`[INFO] No ancillaryRefs found for admission id=${admission.id} → test skipped`);
			}

			//TODO : SFR => feeRefs: is present the referenced fee should also be there

			//TODO Implement further checks on products if needed ?
			// Ancillary products must exist
			// const ancillaries = admission.products || [];
			// pm.test(
			// 	`Admission part ${i + 1} ancillaries present - ancillaries: ${JSON.stringify(ancillaries.map(a => a.productId))}`,
			// 	function () {
			// 		validationLogger(`[INFO] Ancillaries: ${JSON.stringify(ancillaries.map(a => a.productId))}`);
			// 	}
			// );

			//TODO is this needed here or only in offerParts validation ?
			// Validate afterSalesConditions structure
			if (Array.isArray(admission.afterSalesConditions) && admission.afterSalesConditions.length > 0) {
				pm.test(`Admission part ${i + 1} afterSalesConditions validity`, () => {
					validationLogger(`[INFO] AdmissionOfferPart ${i + 1} has ${admission.afterSalesConditions.length} afterSalesCondition(s)`);

					admission.afterSalesConditions.forEach((condition, condIndex) => {
						validationLogger(`[INFO] Validating afterSalesCondition[${condIndex}] for admission ${admission.id}`);

						// Validate condition type
						pm.expect(condition.condition, `afterSalesCondition[${condIndex}].condition should exist`).to.exist;
						pm.expect(condition.condition, `afterSalesCondition[${condIndex}].condition should be REFUND or EXCHANGE`).to.be.oneOf(['REFUND', 'EXCHANGE']);
						validationLogger(`[INFO] afterSalesCondition[${condIndex}].condition: ${condition.condition}`);

						// Validate validFrom
						if (condition.validFrom) {
							const validFromDate = new Date(condition.validFrom);
							if (!isNaN(validFromDate.getTime())) {
								pm.expect(condition.validFrom, `afterSalesCondition[${condIndex}].validFrom should be a valid date`).to.be.a('string');
								validationLogger(`[INFO] afterSalesCondition[${condIndex}].validFrom: ${condition.validFrom}`);
							} else {
								validationLogger(`[WARNING] afterSalesCondition[${condIndex}].validFrom has invalid date format: ${condition.validFrom}`);
							}
						}

						// Validate validUntil
						if (condition.validUntil) {
							const validUntilDate = new Date(condition.validUntil);
							if (!isNaN(validUntilDate.getTime())) {
								pm.expect(condition.validUntil, `afterSalesCondition[${condIndex}].validUntil should be a valid date`).to.be.a('string');
								validationLogger(`[INFO] afterSalesCondition[${condIndex}].validUntil: ${condition.validUntil}`);
							} else {
								validationLogger(`[WARNING] afterSalesCondition[${condIndex}].validUntil has invalid date format: ${condition.validUntil}`);
							}
						}

						// Validate afterSaleFee structure
						if (condition.afterSaleFee) {
							pm.expect(condition.afterSaleFee, `afterSalesCondition[${condIndex}].afterSaleFee should exist`).to.be.an('object');
							pm.expect(condition.afterSaleFee.currency, `afterSalesCondition[${condIndex}].afterSaleFee.currency should exist`).to.exist;
							pm.expect(condition.afterSaleFee.amount, `afterSalesCondition[${condIndex}].afterSaleFee.amount should be a number`).to.be.a('number');
							pm.expect(condition.afterSaleFee.scale, `afterSalesCondition[${condIndex}].afterSaleFee.scale should be a number`).to.be.a('number');
							validationLogger(`[INFO] afterSalesCondition[${condIndex}].afterSaleFee: ${condition.afterSaleFee.amount} ${condition.afterSaleFee.currency}`);

							// Push only if scenarioType matches the condition type
							if (pm.environment.get("scenarioType").includes("REFUND") && condition.condition === "REFUND") {
								admissionReservationAncillaryOfferPartsAftersalesConditions += condition.afterSaleFee.amount;
								pm.environment.set("admissionReservationAncillaryOfferPartsAftersalesConditions", admissionReservationAncillaryOfferPartsAftersalesConditions);
							} else if (pm.environment.get("scenarioType").includes("EXCHANGE") && condition.condition === "EXCHANGE") {
								admissionReservationAncillaryOfferPartsAftersalesConditions += condition.afterSaleFee.amount;
								pm.environment.set("admissionReservationAncillaryOfferPartsAftersalesConditions", admissionReservationAncillaryOfferPartsAftersalesConditions);
							}
						} else {
							validationLogger(`[WARNING] afterSalesCondition[${condIndex}].afterSaleFee is missing`);
						}
					});
				});
			} else {
				validationLogger(`[INFO] No afterSalesConditions found for admission id=${admission.id} → test skipped`);
			}

			// If FULL FLEXIBLE ticket, refundable and/or exchangeable must be YES
			if (overallFlex === "FULL_FLEXIBLE" || overallFlex === "SEMI_FLEXIBLE") {
				if (pm.environment.get("scenarioType").includes("REFUND")) {
					pm.test(
						`Admission part ${i + 1} refundable : ${admission.refundable}`,
						function () {
							validationLogger(`[INFO] Admission part ${i + 1} refundable : ${admission.refundable}`);
							pm.expect(admission.refundable, "Refundable should be YES").to.eql("YES");
						}
					);
				} else if (pm.environment.get("scenarioType").includes("EXCHANGE")) {
					pm.test(
						`Admission part ${i + 1} exchangeable : ${admission.exchangeable}`,
						function () {
							validationLogger(`[INFO] Admission part ${i + 1} exchangeable : ${admission.exchangeable}`);
							pm.expect(admission.exchangeable, "Exchangeable should be YES").to.eql("YES");
						}
					);
				}
			}
		});
	} else {
		validationLogger(`[INFO] No admissionOfferParts found for offer.id : ${selectedOffer.offerId} → test skipped`);
	}
}

// Reservation validation
function validateReservations(selectedOffer) {
	validationLogger("[INFO] ➤ validateReservations");

	const reservationParts = selectedOffer.reservationOfferParts || [];
	const ancillaryParts = selectedOffer.ancillaryOfferParts || [];
	const admissionReservationAncillaryOfferPartsIds = pm.environment.get("admissionReservationAncillaryOfferPartsIds") || [];
	let admissionReservationAncillaryOfferPartsAftersalesConditions = pm.environment.get("admissionReservationAncillaryOfferPartsAftersalesConditions") || 0;

	if (reservationParts.length > 0) {
		reservationParts.forEach((reservation, i) => {
			validationLogger(`[INFO] Validating reservationOfferParts ${i + 1} id : ${reservation.id}`);
			admissionReservationAncillaryOfferPartsIds.push(reservation.id);
			pm.environment.set("admissionReservationAncillaryOfferPartsIds", admissionReservationAncillaryOfferPartsIds);

			// Available Places, Numeric Availability per accommodation type
			const availablePlaces = reservation.availablePlaces || [];
			if (availablePlaces.length > 0) {
				pm.test(`Reservation part ${i + 1} availablePlaces is an array and contains accommodationType and numericAvailability`, () => {
					validationLogger(`[INFO] availablePlaces count : ${availablePlaces.length}`);
					pm.expect(Array.isArray(availablePlaces)).to.eql(true);
					availablePlaces.forEach((place, pIndex) => {
						validationLogger(`[INFO] availablePlaces[${pIndex}] accommodationType : ${place.accommodationType}, numericAvailability : ${place.numericAvailability}`);
						pm.expect(typeof place.accommodationType).to.eql("string");
						pm.expect(typeof place.numericAvailability).to.eql("number");
					});
				});
			} else {
				validationLogger(`[INFO] No availablePlaces for reservation id=${reservation.id} → test skipped`);
			}

			// Numeric Availability
			if ("numericAvailability" in reservation) {
				pm.test(`Reservation part ${i + 1} numericAvailability is a number - total: ${reservation.numericAvailability}`, () => {
					validationLogger(`[INFO] numericAvailability : ${reservation.numericAvailability}`);
					pm.expect(typeof reservation.numericAvailability).to.eql("number");
				});
			} else {
				validationLogger(`[INFO] No numericAvailability for reservation id : ${reservation.id} → test skipped`);
			}

			// Number of Private Compartments
			if ("numberOfPrivateCompartments" in reservation) {
				pm.test(`Reservation part ${i + 1} numberOfPrivateCompartments is a number - total: ${reservation.numberOfPrivateCompartments}`, () => {
					validationLogger(`[INFO] numberOfPrivateCompartments : ${reservation.numberOfPrivateCompartments}`);
					pm.expect(typeof reservation.numberOfPrivateCompartments).to.eql("number");
				});
			} else {
				validationLogger(`[INFO] No numberOfPrivateCompartments for reservation id=${reservation.id} → test skipped`);
			}

			// Available Place Preferences
			const placePrefs = reservation.availablePlacePreferences || [];
			if (placePrefs.length > 0) {
				pm.test(`Reservation part ${i + 1} availablePlacePreferences present`, () => {
					validationLogger(`[INFO] availablePlacePreferences : ${JSON.stringify(placePrefs)}`);
					pm.expect(Array.isArray(placePrefs)).to.eql(true);
					pm.expect(placePrefs.length).to.be.above(0);
				});
			} else {
				validationLogger(`[INFO] No availablePlacePreferences for reservation id=${reservation.id} → test skipped`);
			}

			// Validate linkage to ancillaryOfferParts
			// TODO see if valid
			// ancillaries: if referenced in reservation the ancillary should be present
			const ancillaryRefs = reservation?.ancillaries?.flatMap(r => r.ancillaryGroup?.ancillaryRefs || []) || [];
			if (ancillaryRefs.length > 0) {
				pm.test(`Ancillary linkage — reservation id ${reservation.id}`, () => {
					ancillaryRefs.forEach(ref => {
						const found = ancillaryParts.some(a => a.id === ref.id);
						validationLogger(`[INFO] ancillaryRef.id : ${ref.id} → match in ancillaryOfferParts : ${found}`);
						pm.expect(found, `ancillaryOfferParts should contain id ${ref.id}`).to.eql(true);
					});
				});
			} else {
				validationLogger(`[INFO] No ancillaryRefs found for reservation id : ${reservation.id} → test skipped`);
			}

			// Validate afterSalesConditions structure
			if (Array.isArray(reservation.afterSalesConditions) && reservation.afterSalesConditions.length > 0) {
				pm.test(`Reservation part ${i + 1} afterSalesConditions validity`, () => {
					validationLogger(`[INFO] Reservation part ${i + 1} has ${reservation.afterSalesConditions.length} afterSalesCondition(s)`);

					reservation.afterSalesConditions.forEach((condition, condIndex) => {
						validationLogger(`[INFO] Validating afterSalesCondition[${condIndex}] for reservation ${reservation.id}`);
						// Validate condition type
						pm.expect(condition.condition, `afterSalesCondition[${condIndex}].condition should exist`).to.exist;
						pm.expect(condition.condition, `afterSalesCondition[${condIndex}].condition should be REFUND or EXCHANGE`).to.be.oneOf(['REFUND', 'EXCHANGE']);
						validationLogger(`[INFO] afterSalesCondition[${condIndex}].condition: ${condition.condition}`);

						// Validate validFrom
						if (condition.validFrom) {
							const validFromDate = new Date(condition.validFrom);
							if (!isNaN(validFromDate.getTime())) {
								pm.expect(condition.validFrom, `afterSalesCondition[${condIndex}].validFrom should be a valid date`).to.be.a('string');
								validationLogger(`[INFO] afterSalesCondition[${condIndex}].validFrom: ${condition.validFrom}`);
							} else {
								validationLogger(`[WARNING] afterSalesCondition[${condIndex}].validFrom has invalid date format: ${condition.validFrom}`);
							}
						}

						// Validate validUntil
						if (condition.validUntil) {
							const validUntilDate = new Date(condition.validUntil);
							if (!isNaN(validUntilDate.getTime())) {
								pm.expect(condition.validUntil, `afterSalesCondition[${condIndex}].validUntil should be a valid date`).to.be.a('string');
								validationLogger(`[INFO] afterSalesCondition[${condIndex}].validUntil: ${condition.validUntil}`);
							} else {
								validationLogger(`[WARNING] afterSalesCondition[${condIndex}].validUntil has invalid date format: ${condition.validUntil}`);
							}
						}

						// Validate afterSaleFee structure
						if (condition.afterSaleFee) {
							pm.expect(condition.afterSaleFee, `afterSalesCondition[${condIndex}].afterSaleFee should exist`).to.be.an('object');
							pm.expect(condition.afterSaleFee.currency, `afterSalesCondition[${condIndex}].afterSaleFee.currency should exist`).to.exist;
							pm.expect(condition.afterSaleFee.amount, `afterSalesCondition[${condIndex}].afterSaleFee.amount should be a number`).to.be.a('number');
							pm.expect(condition.afterSaleFee.scale, `afterSalesCondition[${condIndex}].afterSaleFee.scale should be a number`).to.be.a('number');
							validationLogger(`[INFO] afterSalesCondition[${condIndex}].afterSaleFee: ${condition.afterSaleFee.amount} ${condition.afterSaleFee.currency}`);

							// Push only if scenarioType matches the condition type
							if (pm.environment.get("scenarioType").includes("REFUND") && condition.condition === "REFUND") {
								admissionReservationAncillaryOfferPartsAftersalesConditions += condition.afterSaleFee.amount;
								pm.environment.set("admissionReservationAncillaryOfferPartsAftersalesConditions", admissionReservationAncillaryOfferPartsAftersalesConditions);
							} else if (pm.environment.get("scenarioType").includes("EXCHANGE") && condition.condition === "EXCHANGE") {
								admissionReservationAncillaryOfferPartsAftersalesConditions += condition.afterSaleFee.amount;
								pm.environment.set("admissionReservationAncillaryOfferPartsAftersalesConditions", admissionReservationAncillaryOfferPartsAftersalesConditions);
							}
						} else {
							validationLogger(`[WARNING] afterSalesCondition[${condIndex}].afterSaleFee is missing`);
						}
					});
				});
			} else {
				validationLogger(`[INFO] No afterSalesConditions found for reservation id : ${reservation.id} → test skipped`);
			}
		});
	} else {
		validationLogger(`[INFO] No reservationOfferParts found for offer.id : ${selectedOffer.offerId} → test skipped`);
	}
}

function validateAncillaries(selectedOffer) {
	validationLogger("[INFO] ➤ validateAncillaries");
	const ancillaryParts = selectedOffer.ancillaryOfferParts || [];
	const admissionReservationAncillaryOfferPartsIds = pm.environment.get("admissionReservationAncillaryOfferPartsIds") || [];
	let admissionReservationAncillaryOfferPartsAftersalesConditions = pm.environment.get("admissionReservationAncillaryOfferPartsAftersalesConditions") || 0;

	// Capture referenced ancillary IDs from environment
	const referencedAncillaryIdsArray = JSON.parse(pm.environment.get("referencedAncillaryIds") || "[]");
	const referencedAncillaryIds = new Set(referencedAncillaryIdsArray);

	if (ancillaryParts.length > 0) {
		ancillaryParts.forEach((ancillary, i) => {
			validationLogger(`[INFO] Validating ancillaryOfferParts ${i + 1} id=${ancillary.id}`);
			
			// Add ids only if referenced in admissionOfferParts
			if (referencedAncillaryIds.has(ancillary.id)) {
				admissionReservationAncillaryOfferPartsIds.push(ancillary.id);
				pm.environment.set("admissionReservationAncillaryOfferPartsIds", admissionReservationAncillaryOfferPartsIds);
			}

			//TODO Check needed ?
			// pm.test(`Ancillary part ${i + 1} category is defined - category: ${ancillary.category}`, function () {
			// 	validationLogger(`[INFO] ancillaryOfferParts ${i + 1} category: ${ancillary.category}`);
			// 	pm.expect(ancillary.category).to.be.a("string");
			// });

			pm.test(`Ancillary type is defined - type: ${ancillary.type}`, function () {
				validationLogger(`[INFO] ancillaryOfferParts ${i + 1} type: ${ancillary.type}`);
				pm.expect(ancillary.type).to.be.a("string");
			});

			// Validate afterSalesConditions structure
			if (Array.isArray(ancillary.afterSalesConditions) && ancillary.afterSalesConditions.length > 0) {
				pm.test(`Ancillary part ${i + 1} afterSalesConditions validity`, () => {
					validationLogger(`[INFO] Ancillary part ${i + 1} has ${ancillary.afterSalesConditions.length} afterSalesCondition(s)`);

					ancillary.afterSalesConditions.forEach((condition, condIndex) => {
						validationLogger(`[INFO] Validating afterSalesCondition[${condIndex}] for ancillary ${ancillary.id}`);
						// Validate condition type
						pm.expect(condition.condition, `afterSalesCondition[${condIndex}].condition should exist`).to.exist;
						pm.expect(condition.condition, `afterSalesCondition[${condIndex}].condition should be REFUND or EXCHANGE`).to.be.oneOf(['REFUND', 'EXCHANGE']);
						validationLogger(`[INFO] afterSalesCondition[${condIndex}].condition: ${condition.condition}`);

						// Validate validFrom
						if (condition.validFrom) {
							const validFromDate = new Date(condition.validFrom);
							if (!isNaN(validFromDate.getTime())) {
								pm.expect(condition.validFrom, `afterSalesCondition[${condIndex}].validFrom should be a valid date`).to.be.a('string');
								validationLogger(`[INFO] afterSalesCondition[${condIndex}].validFrom: ${condition.validFrom}`);
							} else {
								validationLogger(`[WARNING] afterSalesCondition[${condIndex}].validFrom has invalid date format: ${condition.validFrom}`);
							}
						}

						// Validate validUntil
						if (condition.validUntil) {
							const validUntilDate = new Date(condition.validUntil);
							if (!isNaN(validUntilDate.getTime())) {
								pm.expect(condition.validUntil, `afterSalesCondition[${condIndex}].validUntil should be a valid date`).to.be.a('string');
								validationLogger(`[INFO] afterSalesCondition[${condIndex}].validUntil: ${condition.validUntil}`);
							} else {
								validationLogger(`[WARNING] afterSalesCondition[${condIndex}].validUntil has invalid date format: ${condition.validUntil}`);
							}
						}

						// Validate afterSaleFee structure
						if (condition.afterSaleFee) {
							pm.expect(condition.afterSaleFee, `afterSalesCondition[${condIndex}].afterSaleFee should exist`).to.be.an('object');
							pm.expect(condition.afterSaleFee.currency, `afterSalesCondition[${condIndex}].afterSaleFee.currency should exist`).to.exist;
							pm.expect(condition.afterSaleFee.amount, `afterSalesCondition[${condIndex}].afterSaleFee.amount should be a number`).to.be.a('number');
							pm.expect(condition.afterSaleFee.scale, `afterSalesCondition[${condIndex}].afterSaleFee.scale should be a number`).to.be.a('number');
							validationLogger(`[INFO] afterSalesCondition[${condIndex}].afterSaleFee: ${condition.afterSaleFee.amount} ${condition.afterSaleFee.currency}`);

							// Push only if scenarioType matches the condition type
							if (pm.environment.get("scenarioType").includes("REFUND") && condition.condition === "REFUND") {
								admissionReservationAncillaryOfferPartsAftersalesConditions += condition.afterSaleFee.amount;
								pm.environment.set("admissionReservationAncillaryOfferPartsAftersalesConditions", admissionReservationAncillaryOfferPartsAftersalesConditions);
							} else if (pm.environment.get("scenarioType").includes("EXCHANGE") && condition.condition === "EXCHANGE") {
								admissionReservationAncillaryOfferPartsAftersalesConditions += condition.afterSaleFee.amount;
								pm.environment.set("admissionReservationAncillaryOfferPartsAftersalesConditions", admissionReservationAncillaryOfferPartsAftersalesConditions);
							}
						} else {
							validationLogger(`[WARNING] afterSalesCondition[${condIndex}].afterSaleFee is missing`);
						}
					});
				});
			} else {
				validationLogger(`[INFO] No afterSalesConditions found for ancillary id : ${ancillary.id} → test skipped`);
			}
		});
	} else {
		validationLogger(`[INFO] No ancillaryOfferParts found for offer.id : ${selectedOffer.id} → test skipped`);
	}

}

// Function to extract all tripId and legId from tripLegCoverage for a given accommodationType
function getTripLegCoverage(selectedOffer, accommodationSelection) {
	const tripLegs = [];

	(selectedOffer.reservationOfferParts || []).forEach(part => {
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
function handleAccommodationAndPlaceSelection(selectedOffer) {
	validationLogger("[INFO] ➤ handleAccommodationAndPlaceSelection");

	const accommodationSelection = pm.environment.get("accommodationSelection");
	const requiresPlaceSelection = pm.environment.get("requiresPlaceSelection");

	if (accommodationSelection !== "COUCHETTE" && accommodationSelection !== "BERTH") {
		validationLogger(`[INFO] accommodationSelection is ${accommodationSelection}, skipping place selection`);
		return;
	}
	if (requiresPlaceSelection !== true) {
		pm.execution.setNextRequest("03. POST Create Booking");
	}
	const reservationParts = selectedOffer.reservationOfferParts || [];
	validationLogger(`[INFO] Reservation Offer Parts count: ${reservationParts.length}`);

	const matchingParts = reservationParts.filter(part =>
		Array.isArray(part.availablePlaces) &&
		part.availablePlaces.some(place => place.accommodationType === accommodationSelection)
	);

	if (matchingParts.length === 0) {
		validationLogger(`[WARN] No reservationOfferParts found for accommodationType: '${accommodationSelection}'`);
		pm.test(`At least one reservationOfferPart has accommodationType: ${accommodationSelection}`, function () {
			pm.expect(false, `No reservationOfferParts with accommodationType ${accommodationSelection}`).to.be.true;
		});
		return;
	}

	matchingParts.forEach(part => validationLogger(`[INFO] ${accommodationSelection} reservationOfferPart.id: ${part.id}`));
	pm.environment.set("reservationIds", JSON.stringify(matchingParts.map(part => part.id)));
	pm.environment.set("reservationId", matchingParts[0].id);

	pm.test(`At least one reservationOfferPart has accommodationType: ${accommodationSelection}`, function () {
		pm.expect(matchingParts.length, "No matching reservationOfferParts found").to.be.above(0);
	});

	const tripLegCoverage = getTripLegCoverage(selectedOffer, accommodationSelection);
	pm.environment.set("tripLegCoverage", JSON.stringify(tripLegCoverage));
	validationLogger(`[INFO] tripLegCoverage stored in environment: ${JSON.stringify(tripLegCoverage)}`);
}

function ensureYesWhenRefundOrExchangeSelected(selectedOffer) {
	validationLogger("[INFO] ➤ ensureYesWhenRefundOrExchangeSelected");

	const admissionParts = selectedOffer.admissionOfferParts || [];

	const scenarioTypeStr = pm.environment.get("scenarioType") || "";
	if (admissionParts.length > 0) {
		admissionParts.forEach((admission, i) => {
			if (scenarioTypeStr.includes("REFUND")) {
				if (admission.refundable !== "YES") {
					validationLogger(`[ERROR] ⛔ scenarioType is REFUND but Admission part ${i + 1} is not refundable, exiting script ...`);
					pm.execution.setNextRequest(null);
					return;
				} else {
					validationLogger(`[INFO] Admission part ${i + 1} is refundable as expected, continuing.`);
				}
			} else if (pm.environment.get("scenarioType").includes("EXCHANGE")) {
				if (admission.exchangeable !== "YES") {
					validationLogger(`[ERROR] ⛔ scenarioType is EXCHANGE but Admission part ${i + 1} is not exchangeable, exiting script ...`);
					pm.execution.setNextRequest(null);
					return;
				} else {
					validationLogger(`[INFO] Admission part ${i + 1} is exchangeable as expected, continuing.`);
				}
			}
		});
	}
}
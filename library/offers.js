
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
	pm.test(`Status code is 200`, () => {
		pm.expect(pm.response.code, "[ERROR] Wrong response status").to.eql(200);
	});

	// Stop flow if status != 200
	if (pm.response.code !== 200) {
		validationLogger(`[ERROR] Wrong status: ${pm.response.code}`);
		pm.execution.setNextRequest(null);
		return;
	}

	// Check offers exist
	pm.test(`Offers array exists and is not empty`, () => {
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
	validateReservations(selectedOffer);
	validateAncillaries(selectedOffer);

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
		validationLogger("[INFO] Applying flexibility filter: " + desiredFlexibility);
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
			const success = actual === desiredFlexibility;

			validationLogger(`[INFO] Flexibility match: expected=${desiredFlexibility}, actual=${actual}, result=${success}`);

			pm.expect(actual).to.eql(desiredFlexibility);
		});

		const matchingProducts = (selectedOffer.products || []).filter(
			p => p.flexibility === desiredFlexibility
		);

		pm.test(`At least one matching product has the expected flexibility`, () => {
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

			pm.test(`All admissionOfferParts of selected offer are ${type} - expected: YES, actual: ${parts.map(p => p[field]).join(", ")}`, () => {
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

    pm.test(`Offer summary - minimalPrice is defined - minimalPrice: ${minimalPrice}`, function() {
        validationLogger(`[INFO] minimalPrice: ${minimalPrice}`);
        pm.expect(minimalPrice).to.be.a("number");
    });

    pm.test(`Offer summary - overallFlexibility is defined - overallFlexibility: ${overallFlexibility}`, function() {
        validationLogger(`[INFO] overallFlexibility: ${overallFlexibility}`);
        pm.expect(overallFlexibility).to.be.a("string");
    });

    pm.test(`Offer summary - overallServiceClass is defined - overallServiceClass: ${overallServiceClass}`, function() {
        validationLogger(`[INFO] overallServiceClass: ${overallServiceClass}`);
        pm.expect(overallServiceClass).to.be.a("string");
    });

    pm.test(`Offer summary - overallTravelClass is defined - overallTravelClass: ${overallTravelClass}`, function() {
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

    pm.test(`Passengers are defined - length: ${passengers.length}`, function() {
        validationLogger(`[INFO] Number of passengers: ${passengers.length}`);
        pm.expect(passengers.length).to.be.above(0);
    });

    passengers.forEach((p, i) => {
        pm.test(`Passenger ${i + 1} type is defined - type: ${p.type}`, function() {
            validationLogger(`[INFO] Passenger ${i + 1} type: ${p.type}`);
            pm.expect(p.type).to.not.be.undefined;
        });

        const reductionCards = p.appliedReductionCardTypes || [];
        pm.test(`Passenger ${i + 1} reduction cards - reductionCards: ${JSON.stringify(reductionCards)}`, function() {
            validationLogger(`[INFO] Passenger ${i + 1} reductionCards: ${JSON.stringify(reductionCards)}`);
        });
    });
}

// Trips & Legs validation
function validateTripsAndLegs(jsonData) {
	validationLogger("[INFO] ➤ validateTripsAndLegs");
    const trips = jsonData.trips || [];

    pm.test(`Trips are defined - length: ${trips.length}`, function() {
        validationLogger(`[INFO] Number of trips: ${trips.length}`);
        pm.expect(trips.length).to.be.above(0);
    });

    trips.forEach((trip, tripIndex) => {
        const legs = trip.legs || [];
        pm.test(`Trip ${tripIndex + 1} has legs - length: ${legs.length}`, function() {
            validationLogger(`[INFO] Trip ${tripIndex + 1} has ${legs.length} leg(s)`);
            pm.expect(legs.length).to.be.above(0);
        });

        legs.forEach((leg, legIndex) => {
            const trainId = leg.timedLeg?.service?.vehicleNumbers?.[0];
            const origin = leg.timedLeg?.start?.stopPlaceName;
            const destination = leg.timedLeg?.end?.stopPlaceName;

            pm.test(`Trip ${tripIndex + 1} Leg ${legIndex + 1} has TrainID, Origin & Destination - TrainID: ${trainId}, Origin: ${origin}, Destination: ${destination}`, function() {
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

	const admissionParts = selectedOffer.admissionOfferParts || [];
	const reservationParts = selectedOffer.reservationOfferParts || [];
	const ancillaryParts = selectedOffer.ancillaryOfferParts || [];

	const sumPrice = parts => parts.reduce((sum, p) => sum + (p.price?.amount || 0), 0);

	const admissionPrice = sumPrice(admissionParts);
	const reservationPrice = sumPrice(reservationParts);
	const ancillaryPrice = sumPrice(ancillaryParts);

	validationLogger(`[INFO] Admission parts price: ${admissionPrice}`);
	validationLogger(`[INFO] Reservation parts price: ${reservationPrice}`);
	validationLogger(`[INFO] Ancillary parts price: ${ancillaryPrice}`);

	const offerParts = [...admissionParts, ...reservationParts, ...ancillaryParts];

	const overallPrice = selectedOffer.offerSummary?.minimalPrice?.amount || 0;
	const overallFlex = selectedOffer.offerSummary?.overallFlexibility;

	const sumPartsPrice = sumPrice(offerParts);

	pm.test(`Offer overallPrice >= sum of offerParts price - overallPrice: ${overallPrice}, sumPartsPrice: ${sumPartsPrice}`, function() {
		validationLogger(`[INFO] overallPrice: ${overallPrice}, sumPartsPrice: ${sumPartsPrice}`);
		pm.expect(overallPrice).to.be.at.least(sumPartsPrice);
	});


    // Flexibility calculation
	//TODO Check if all products should be checked instead of only the first one
	//Is this check in jsonData.products[] ?
	const productFlex = Array.from(new Set(selectedOffer?.products?.map(p => p.flexibility).filter(Boolean)));
	const flexibilityResult = productFlex.length === 1 ? productFlex[0] : "SEMI_FLEXIBLE";

	pm.test(`Offer overallFlexibility consistency - overallFlex: ${overallFlex}, flexibilityResult: ${flexibilityResult}`, () => {
		validationLogger(`[INFO] productFlex: ${productFlex.join(", ")}, Result: ${flexibilityResult}`);
		pm.expect(overallFlex).to.eql(flexibilityResult);
	});

    // Travel class
	//TODO Travel Class : In some cases the travel class of a short leg is lower than the longer one.
	// The Railway could decide to use the Travel class of the longest leg
	// (need to check if travel class can be flagged as mixed for exemple if trip is based on
	// 2 segments equivalent in duration one in 1st, one in second)
	const travelClasses = Array.from(new Set(selectedOffer?.products?.map(p => p.travelClass).filter(Boolean)));

	// Si une seule classe → on la garde, sinon → "MIXED"
	const travelClassResult = travelClasses.length === 1 ? travelClasses[0] : "MIXED";

	pm.test(`Offer travel class consistency - travelClasses: ${travelClasses.join(", ")}, Result: ${travelClassResult}`, () => {
		validationLogger(`[INFO] travelClasses: ${travelClasses.join(", ")}, Result: ${travelClassResult}`);
		pm.expect(travelClassResult).to.not.eql("UNKNOWN");
	});

}

// Admission validation
function validateAdmissions(selectedOffer) {
	validationLogger("[INFO] ➤ validateAdmissions");

	const overallFlex = selectedOffer.offerSummary?.overallFlexibility;
	const admissionParts = selectedOffer.admissionOfferParts || [];
	const reservationParts = selectedOffer.reservationOfferParts || [];
	const ancillaryParts = selectedOffer.ancillaryOfferParts || [];

	if (admissionParts.length > 0) {
		admissionParts.forEach((admission, i) => {
			validationLogger(`[INFO] Validating admissionOfferParts ${i + 1} (id=${admission.id})`);

			// Determine business type of admission (NRT / TLT / IRT)
			let type = "NRT"; // Default: Non Reserved Ticket
			if (admission.isTrainBound && admission.includedReservation) type = "IRT";
			else if (admission.isTrainBound && !admission.includedReservation) type = "TLT";

			pm.test(`Admission part ${i + 1} business type - type: ${type}`, function () {
				validationLogger(`[INFO] AdmissionOfferPart ${i + 1} type: ${type}`);
				pm.expect(["NRT", "TLT", "IRT"]).to.include(type);
			});

			// Pre-booking date must be in the future
			const preBookDate = new Date(admission.validUntil || admission.validFrom);
			pm.test(`Admission part ${i + 1} preBookableUntil is in the future - preBookableUntil: ${preBookDate}`, function () {
				validationLogger(`[INFO] preBookableUntil: ${preBookDate}`);
				pm.expect(preBookDate.getTime()).to.be.above(Date.now());
			});

			// Validate linkage to reservationOfferParts
			const reservationsRefs = admission?.reservations?.flatMap(r => r.reservationsGroup?.reservationsRefs || []) || [];
			if (reservationsRefs.length > 0) {
				pm.test(`Reservation linkage — admission id ${admission.id}`, () => {
					reservationsRefs.forEach(ref => {
						const found = reservationParts.some(r => r.id === ref.id);
						validationLogger(`[INFO] reservationsRef.id=${ref.id} → match in reservationOfferParts: ${found}`);
						pm.expect(found, `reservationOfferParts should contain id ${ref.id}`).to.eql(true);
					});
				});

			} else {
				validationLogger(`[INFO] No reservationsRefs found for admission id=${admission.id} → test skipped`);
			}

			// Validate linkage to ancillaryOfferParts
			const ancillaryRefs = admission?.ancillaries?.flatMap(r => r.ancillaryGroup?.ancillaryRefs || []) || [];
			if (ancillaryRefs.length > 0) {
				pm.test(`Ancillary linkage — admission id ${admission.id}`, () => {
					ancillaryRefs.forEach(ref => {
						const found = ancillaryParts.some(a => a.id === ref.id);
						validationLogger(`[INFO] ancillaryRef.id=${ref.id} → match in ancillaryOfferParts: ${found}`);
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

			//TODO implement feeRefs check if needed
			// Check feeRefs ONLY IF present
			// if (Array.isArray(part.feeRefs)) {
			// 	validationLogger(`[FULL] ${prefix}.feeRefs: ${JSON.stringify(part.feeRefs)}`);

			// 	part.feeRefs.forEach((feeRef, i) => {
			// 		const feeFound = offer.fees?.some(fee => fee.id === feeRef.id);
			// 		if (!feeFound) {
			// 			allFeeRefsValid = false;
			// 			validationLogger(`[ERROR] ${prefix}.feeRefs[${i}].id '${feeRef.id}' not found in offer.fees`);
			// 		}
			// 	});
			// }

			// If FULL FLEXIBLE -> ticket must be refundable AND exchangeable
			if (overallFlex === "FULL_FLEXIBLE") {
				pm.test(
					`Admission part ${i + 1} refundable/exchangeable - refundable: ${admission.refundable}, exchangeable: ${admission.exchangeable}`,
					function () {
						validationLogger(`[INFO] refundable: ${admission.refundable}, exchangeable: ${admission.exchangeable}`);
						pm.expect(admission.refundable, "Refundable should be YES").to.eql("YES");
						pm.expect(admission.exchangeable, "Exchangeable should be YES").to.eql("YES");
					}
				);
			}
		});
	} else {
		validationLogger(`[INFO] No admissionOfferParts found for offer.id=${offer.id} → test skipped`);
	}
}

// Reservation validation
function validateReservations(selectedOffer) {
    validationLogger("[INFO] ➤ validateReservations");

    const reservationParts = selectedOffer.reservationOfferParts || [];
    const ancillaryParts = selectedOffer.ancillaryOfferParts || [];

    if (reservationParts.length > 0) {
		reservationParts.forEach((reservation, i) => {
			validationLogger(`[INFO] Validating reservationOfferParts ${i + 1} (id=${reservation.id})`);

			// Available Places
			const availablePlaces = reservation.availablePlaces || [];
			if (availablePlaces.length > 0) {
				pm.test(`Reservation part ${i + 1} availablePlaces validity`, () => {
					validationLogger(`[INFO] availablePlaces count: ${availablePlaces.length}`);
					pm.expect(Array.isArray(availablePlaces)).to.eql(true);
					availablePlaces.forEach((place, pIndex) => {
						validationLogger(`[INFO] availablePlaces[${pIndex}] accommodationType=${place.accommodationType}, numericAvailability=${place.numericAvailability}`);
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
					validationLogger(`[INFO] numericAvailability: ${reservation.numericAvailability}`);
					pm.expect(typeof reservation.numericAvailability).to.eql("number");
				});
			} else {
				validationLogger(`[INFO] No numericAvailability for reservation id=${reservation.id} → test skipped`);
			}

			// Number of Private Compartments
			if ("numberOfPrivateCompartments" in reservation) {
				pm.test(`Reservation part ${i + 1} numberOfPrivateCompartments is a number - total: ${reservation.numberOfPrivateCompartments}`, () => {
					validationLogger(`[INFO] numberOfPrivateCompartments: ${reservation.numberOfPrivateCompartments}`);
					pm.expect(typeof reservation.numberOfPrivateCompartments).to.eql("number");
				});
			} else {
				validationLogger(`[INFO] No numberOfPrivateCompartments for reservation id=${reservation.id} → test skipped`);
			}

			// Available Place Preferences
			const placePrefs = reservation.availablePlacePreferences || [];
			if (placePrefs.length > 0) {
				pm.test(`Reservation part ${i + 1} availablePlacePreferences present`, () => {
					validationLogger(`[INFO] availablePlacePreferences: ${JSON.stringify(placePrefs)}`);
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
						validationLogger(`[INFO] ancillaryRef.id=${ref.id} → match in ancillaryOfferParts: ${found}`);
						pm.expect(found, `ancillaryOfferParts should contain id ${ref.id}`).to.eql(true);
					});
				});
			} else {
				validationLogger(`[INFO] No ancillaryRefs found for reservation id=${reservation.id} → test skipped`);
			}

			//TODO implement feeRefs check if needed
			// Check feeRefs ONLY IF present
			// if (Array.isArray(part.feeRefs)) {
			// 	validationLogger(`[FULL] ${prefix}.feeRefs: ${JSON.stringify(part.feeRefs)}`);

			// 	part.feeRefs.forEach((feeRef, i) => {
			// 		const feeFound = offer.fees?.some(fee => fee.id === feeRef.id);
			// 		if (!feeFound) {
			// 			allFeeRefsValid = false;
			// 			validationLogger(`[ERROR] ${prefix}.feeRefs[${i}].id '${feeRef.id}' not found in offer.fees`);
			// 		}
			// 	});
			// }
		});
	} else {
		validationLogger(`[INFO] No reservationOfferParts found for offer.id=${offer.id} → test skipped`);
	}
}

function validateAncillaries(selectedOffer) {
	validationLogger("[INFO] ➤ validateAncillaries");
	const ancillaryParts = selectedOffer.ancillaryOfferParts || [];

	if (ancillaryParts.length > 0) {
		ancillaryParts.forEach((ancillary, i) => {
			validationLogger(`[INFO] Validating ancillaryOfferParts ${i + 1} (id=${ancillary.id})`);

			//TODO Check needed ?
			// pm.test(`Ancillary part ${i + 1} category is defined - category: ${ancillary.category}`, function () {
			// 	validationLogger(`[INFO] ancillaryOfferParts ${i + 1} category: ${ancillary.category}`);
			// 	pm.expect(ancillary.category).to.be.a("string");
			// });

			pm.test(`Ancillary type is defined - type: ${ancillary.type}`, function () {
				validationLogger(`[INFO] ancillaryOfferParts ${i + 1} type: ${ancillary.type}`);
				pm.expect(ancillary.type).to.be.a("string");
			});

			//TODO implement feeRefs check if needed
			// Check feeRefs ONLY IF present
			// if (Array.isArray(part.feeRefs)) {
			// 	validationLogger(`[FULL] ${prefix}.feeRefs: ${JSON.stringify(part.feeRefs)}`);

			// 	part.feeRefs.forEach((feeRef, i) => {
			// 		const feeFound = offer.fees?.some(fee => fee.id === feeRef.id);
			// 		if (!feeFound) {
			// 			allFeeRefsValid = false;
			// 			validationLogger(`[ERROR] ${prefix}.feeRefs[${i}].id '${feeRef.id}' not found in offer.fees`);
			// 		}
			// 	});
			// }
		});
  	} else {
		validationLogger(`[INFO] No ancillaryOfferParts found for offer.id=${selectedOffer.id} → test skipped`);
	}

}

// Function to extract all tripId and legId from tripLegCoverage for a given accommodationType
function getTripLegCoverage(selectedOffer, accommodationSelection) {
	const tripLegs = [];

	selectedOffer.reservationOfferParts.forEach(part => {
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

    if (accommodationSelection !== "COUCHETTE" && accommodationSelection !== "BERTH") {
        validationLogger(`[INFO] accommodationSelection is ${accommodationSelection}, skipping place selection`);
        pm.execution.setNextRequest("03. POST Create Booking");
        return;
    }

    const reservationParts = selectedOffer.reservationOfferParts || [];
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
	pm.environment.set("reservationIds", JSON.stringify(matchingParts.map(part => part.id)));
    pm.environment.set("reservationId", matchingParts[0].id);

    pm.test(`At least one reservationOfferPart has accommodationType: ${accommodationSelection}`, function() {
        pm.expect(matchingParts.length, "No matching reservationOfferParts found").to.be.above(0);
    });

    const tripLegCoverage = getTripLegCoverage(selectedOffer, accommodationSelection);
    pm.environment.set("tripLegCoverage", JSON.stringify(tripLegCoverage));
    validationLogger(`[INFO] tripLegCoverage stored in environment: ${JSON.stringify(tripLegCoverage)}`);
}


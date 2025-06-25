// Function to validate offer response
validateOfferResponse = function (passengerSpecifications, searchCriteria, fulfillmentOptions, offers, trips) {
	// Test if offers are returned
	validationLogger("[INFO] 🔍 There are " + offers.length + " offer(s) available");

	let found = false;
	for (let offerIndex = 0; offerIndex < offers.length && !found; offerIndex++) {
		validationLogger("[INFO] Checking offer index : " + offerIndex);
		const offer = offers[offerIndex];

		const { foundAdmissions, foundAncillaries, foundReservations } = validateOfferParts(
			offer,
			passengerSpecifications,
			fulfillmentOptions,
			searchCriteria
		);

		found = validateScenario(foundAdmissions, foundAncillaries, foundReservations, trips, passengerSpecifications, offer);
	}

	validateOfferSearchCriteria(trips);
	validateTripSpecifications(trips);
	validateAnonymousPassengerSpecifications();
	selectAndSetOffer(offers);
	handlePlaceSelection();
};

// Helper function to validate offer parts
function validateOfferParts(offer, passengerSpecifications, fulfillmentOptions, searchCriteria) {
	let foundAdmissions = 0;
	let foundAncillaries = 0;
	let foundReservations = 0;

	foundAdmissions = validateAdmissions(offer.admissionOfferParts, passengerSpecifications, searchCriteria, fulfillmentOptions);
	foundAncillaries = validateAncillaries(offer.ancillaryOfferParts, passengerSpecifications, searchCriteria, fulfillmentOptions);
	foundReservations = validateReservations(offer.reservationOfferParts, passengerSpecifications, searchCriteria, fulfillmentOptions);

	validationLogger("[INFO] Admissions : " + foundAdmissions);
	validationLogger("[INFO] Ancillaries : " + foundAncillaries);
	validationLogger("[INFO] Reservations : " + foundReservations);

	return { foundAdmissions, foundAncillaries, foundReservations };
}

// Helper function to validate admissions
function validateAdmissions(admissionOfferParts, passengerSpecifications, searchCriteria, fulfillmentOptions) {
    let foundAdmissions = 0;

    if (admissionOfferParts && Array.isArray(admissionOfferParts)) {
        for (const part of admissionOfferParts) {
			for (const passengerRef of part.passengerRefs) {
				const hasMatchingPassenger = passengerSpecifications.some(passenger => passenger.externalRef === passengerRef);

				if (hasMatchingPassenger) {
					pm.test(`AdmissionOfferParts currency matches searchCriteria currency (expected: ${searchCriteria.currency}, actual: ${part.price.currency})`, function () {
						pm.expect(part.price.currency).to.eql(searchCriteria.currency);
					});
					if (fulfillmentOptions) {
						const fulfillmentOptionRequested = JSON.parse(fulfillmentOptions);
						const actualOptions = part.availableFulfillmentOptions || [];
						const correctFulfillmentOption = actualOptions.some(
							option => option.type === fulfillmentOptionRequested[0].type && option.media === fulfillmentOptionRequested[0].media
						);
						pm.test(`AdmissionOfferParts fulfillments matches fulfillmentOptions fulfillments (expected: ${fulfillmentOptionRequested[0].type}/${fulfillmentOptionRequested[0].media}, actual: ${actualOptions.map(opt => `${opt.type}/${opt.media}`).join(', ')})`, function () {
							pm.expect(correctFulfillmentOption).to.eql(true);
						});
						
					}
					foundAdmissions++;
				}
			}
        }
    }
    return foundAdmissions;
}

// Helper function to validate ancillaries
function validateAncillaries(ancillaryOfferParts, passengerSpecifications, searchCriteria, fulfillmentOptions) {
	let foundAncillaries = 0;

	if (ancillaryOfferParts && Array.isArray(ancillaryOfferParts)) {
		for (const part of ancillaryOfferParts) {
			for (const passengerRef of part.passengerRefs) {
				const hasMatchingPassenger = passengerSpecifications.some(passenger => passenger.externalRef === passengerRef);
				if (hasMatchingPassenger) {
					pm.test(`AncillaryOfferParts currency matches searchCriteria currency (expected: ${searchCriteria.currency}, actual: ${part.price.currency})`, function () {
						pm.expect(part.price.currency).to.eql(searchCriteria.currency);
					});
					if (fulfillmentOptions) {
						const fulfillmentOptionRequested = JSON.parse(fulfillmentOptions);
						const actualOptions = part.availableFulfillmentOptions || [];
						const correctFulfillmentOption = actualOptions.some(
							option => option.type === fulfillmentOptionRequested[0].type && option.media === fulfillmentOptionRequested[0].media
						);
						pm.test(`AncillaryOfferParts fulfillments matches fulfillmentOptions fulfillments (expected: ${fulfillmentOptionRequested[0].type}/${fulfillmentOptionRequested[0].media}, actual: ${actualOptions.map(opt => `${opt.type}/${opt.media}`).join(', ')})`, function () {
							pm.expect(correctFulfillmentOption).to.eql(true);
						});
						
					}
					foundAncillaries++;
				}
			}
		}
	}
	return foundAncillaries;
}

function validateReservations(reservationOfferParts, passengerSpecifications, searchCriteria, fulfillmentOptions) {
	let foundReservations = 0;

	if (reservationOfferParts && Array.isArray(reservationOfferParts)) {
		for (const part of reservationOfferParts) {
			for (const passengerRef of part.passengerRefs) {
				const hasMatchingPassenger = passengerSpecifications.some(passenger => passenger.externalRef === passengerRef);
				if (hasMatchingPassenger) {
					pm.test(`ReservationOfferParts currency matches searchCriteria currency (expected: ${searchCriteria.currency}, actual: ${part.price.currency})`, function () {
						pm.expect(part.price.currency).to.eql(searchCriteria.currency);
					});
					if (fulfillmentOptions) {
						const fulfillmentOptionRequested = JSON.parse(fulfillmentOptions);
						const actualOptions = part.availableFulfillmentOptions || [];
						const correctFulfillmentOption = actualOptions.some(
							option => option.type === fulfillmentOptionRequested[0].type && option.media === fulfillmentOptionRequested[0].media
						);
						pm.test(`ReservationOfferParts fulfillments matches fulfillmentOptions fulfillments (expected: ${fulfillmentOptionRequested[0].type}/${fulfillmentOptionRequested[0].media}, actual: ${actualOptions.map(opt => `${opt.type}/${opt.media}`).join(', ')})`, function () {
							pm.expect(correctFulfillmentOption).to.eql(true);
						});
						
					}
					foundReservations++;
				}
			}
		}
	}
	return foundReservations;
}

function validateScenario(foundAdmissions, foundAncillaries, foundReservations, trips, passengerSpecifications, offer) {
	const legCount = trips[0].legs.length;
	const passengerCount = passengerSpecifications.length;
	const expectedCount = legCount * passengerCount;

	let allValid = true;

	if (foundAdmissions !== 0) {
		pm.test(`Correct admissions returned (expected: ${expectedCount}, actual: ${foundAdmissions})`, () => {
			pm.expect(foundAdmissions).to.equal(expectedCount);
		});
		allValid = allValid && (foundAdmissions === expectedCount);
	}

	if (foundReservations !== 0) {
		pm.test(`Correct reservations returned (expected: ${expectedCount}, actual: ${foundReservations})`, () => {
			pm.expect(foundReservations).to.equal(expectedCount);
		});
		allValid = allValid && (foundReservations === expectedCount);
	}

	const hasAdmissions = offer.admissionOfferParts && offer.admissionOfferParts.length > 0;
	const hasReservations = offer.reservationOfferParts && offer.reservationOfferParts.length > 0;
	const expectedAncillaries = (hasAdmissions && hasReservations) ? expectedCount * 2 : expectedCount;

	if (foundAncillaries !== 0) {
		pm.test(`Correct ancillaries returned (expected: ${expectedAncillaries}, actual: ${foundAncillaries})`, () => {
			pm.expect(foundAncillaries).to.equal(expectedAncillaries);
		});

		allValid = allValid && (foundAncillaries === expectedAncillaries);
	}

	return allValid;
}



function validateTripSpecifications(trips) {
    if (pm.globals.get("offerTripSpecifications")) {
        const requiredTrip = JSON.parse(pm.globals.get("offerTripSpecifications"));
        pm.test("validateTripSpecifications : Trips are returned", function () {
            pm.expect(trips).not.to.be.empty;
            const found = trips.some((trip, tripIndex) => {  // Ajout de l'index du trip
                const legsFound = trip.legs.filter((leg, legIndex) => {  // Ajout de l'index du leg
                    return requiredTrip[0].legs.some((requiredLeg) => {
                        const startMatch = requiredLeg.timedLeg.start.stopPlaceRef.stopPlaceRef === leg.timedLeg.start.stopPlaceRef.stopPlaceRef;
                        const endMatch = requiredLeg.timedLeg.end.stopPlaceRef.stopPlaceRef === leg.timedLeg.end.stopPlaceRef.stopPlaceRef;
                        const vehicleMatch = requiredLeg.timedLeg.service.vehicleNumbers[0] === leg.timedLeg.service.vehicleNumbers[0];
                        const carrierMatch = requiredLeg.timedLeg.service.carriers[0].ref === leg.timedLeg.service.carriers[0].ref;

                        // Log differences if not matching with indices for trip and leg
                        if (!startMatch) {
                            validationLogger(`[WARNING] ⚠️ Trip #${tripIndex}, Leg #${legIndex} - Start StopPlaceRef mismatch: expected ${requiredLeg.timedLeg.start.stopPlaceRef.stopPlaceRef}, found ${leg.timedLeg.start.stopPlaceRef.stopPlaceRef}`);
                        }
                        if (!endMatch) {
                            validationLogger(`[WARNING] ⚠️ Trip #${tripIndex}, Leg #${legIndex} - End StopPlaceRef mismatch: expected ${requiredLeg.timedLeg.end.stopPlaceRef.stopPlaceRef}, found ${leg.timedLeg.end.stopPlaceRef.stopPlaceRef}`);
                        }
                        if (!vehicleMatch) {
                            validationLogger(`[WARNING] ⚠️ Trip #${tripIndex}, Leg #${legIndex} - Vehicle Number mismatch: expected ${requiredLeg.timedLeg.service.vehicleNumbers[0]}, found ${leg.timedLeg.service.vehicleNumbers[0]}`);
                        }
                        if (!carrierMatch) {
                            validationLogger(`[WARNING] ⚠️ Trip #${tripIndex}, Leg #${legIndex} - Carrier Ref mismatch: expected ${requiredLeg.timedLeg.service.carriers[0].ref}, found ${leg.timedLeg.service.carriers[0].ref}`);
                        }

                        return startMatch && endMatch && vehicleMatch && carrierMatch;
                    });
                }).length;
                //return legsFound === requiredTrip[0].legs.length;
            });
            pm.test("Correct legs are returned", function () {
                pm.expect(found).to.equal(true);
            });
        });
    }
}


// Helper function to validate offer search criteria
function validateOfferSearchCriteria(trips) {
	if (pm.globals.get("offerTripSearchCriteria")) {
		pm.test("validateOfferSearchCriteria : Trips are returned", function () {
			pm.expect(trips).not.to.be.empty;
			//TODO : Correct validation of the trip search criteria ?
		});
	}
}

// Helper function to validate anonymous passenger specifications
function validateAnonymousPassengerSpecifications() {
	pm.test("validateAnonymousPassengerSpecifications : AnonymousPassengerSpecifications contain valid externalRef", function () {
		const response = pm.response.json();
		const specs = response.anonymousPassengerSpecifications;

		pm.expect(specs).to.be.an('array').that.is.not.empty;

		specs.forEach((spec, index) => {
			pm.expect(spec.externalRef, `Missing externalRef at index ${index}`).to.be.a('string').that.is.not.empty;
		});
	});
}


// Helper function to select and set the desired offer
function selectAndSetOffer(offers) {
	const desiredFlexibility = pm.globals.get("desiredFlexibility");
	const selectedOffers = offers.filter(offer => offer.offerSummary?.overallFlexibility === desiredFlexibility);
	const selectedOffer = selectedOffers.length > 0 ? selectedOffers[0] : offers[0];

	let allMatchingProducts = [];

	if (desiredFlexibility === null) {
		validationLogger("[INFO] DesiredFlexibility is not set, taking the 1st offer in the list");
	} else {
		validationLogger("[INFO] DesiredFlexibility for current scenario : " + desiredFlexibility);
		pm.test(`Selected offer has the expected overallFlexibility (expected: ${desiredFlexibility}, actual: ${selectedOffer.offerSummary?.overallFlexibility})`, function () {
			pm.expect(selectedOffer.offerSummary?.overallFlexibility).to.eql(desiredFlexibility);
		});
		offers.forEach((offer, offerIndex) => {
			const products = offer.products || [];
			const matchingProducts = products.filter(p => p.flexibility === desiredFlexibility);
			if (matchingProducts.length === 0) {
				console.warn(`[WARNING] No matching products found for offer ${offerIndex} with flexibility: ${desiredFlexibility}`);
			}
			matchingProducts.forEach((product, productIndex) => {
				console.log(`[INFO] Offer ${offerIndex} - Product ${productIndex}: flexibility: ${product.flexibility}, id: ${product.id}`);
			});
			allMatchingProducts = allMatchingProducts.concat(matchingProducts);
		});
		
		pm.test(`Total number of matching products with flexibility = ${desiredFlexibility} (found: ${allMatchingProducts.length})`, function () {
			pm.expect(allMatchingProducts.length, `Expected at least 1, but found ${allMatchingProducts.length}`).to.be.above(0);
		});
	}
	console.log("[INFO] 🔍 Selected offer : ", selectedOffer);
	pm.globals.set("offers", offers);
	pm.globals.set("offerId", selectedOffer.offerId);
	pm.globals.set("offer", selectedOffer);

	if(pm.environment.get("scenarioCode").includes("EXCH")) {
		const admissionOfferParts = selectedOffer.admissionOfferParts || [];
		admissionOfferParts.forEach((part, index) => {
			pm.test(`In case of EXCH scenario : Exchangeable status in admissionOfferParts is different from NO`, () => {
				pm.expect(part.exchangeable, `admissionOfferPart[${index}].exchangeable is 'NO'`).to.not.eql("NO");
			});
			if(part.exchangeable === "NO") {
				pm.execution.setNextRequest(null);
				throw new Error(`⛔ Exiting script, Exchangeable status is 'NO' for admissionOfferPart[${index}]`);
			}
		});
	}

	if(pm.environment.get("scenarioCode").includes("RFND")) {
		const admissionOfferParts = selectedOffer.admissionOfferParts || [];
		admissionOfferParts.forEach((part, index) => {
			pm.test(`In case of RFND scenario : Refundable status in admissionOfferParts is different from NO`, () => {
				pm.expect(part.refundable, `admissionOfferPart[${index}].refundable is 'NO'`).to.not.eql("NO");
			});
			if(part.refundable === "NO") {
				pm.execution.setNextRequest(null);
				throw new Error(`⛔ Exiting script, Refundable status is 'NO' for admissionOfferPart[${index}]`);
			}
		});
	}

	//TODO : Need to implement for Reservation ?
	
}

// Helper function to handle place selection
function handlePlaceSelection() {
	if (pm.globals.get("requiresPlaceSelection") === true) {
		const reservationOfferPart = offer.reservationOfferParts[0];
		pm.globals.set("reservationId", reservationOfferPart.id);
	} else {
		validationLogger("skipping Get Place Maps for Reservation of Offer");
		pm.execution.setNextRequest("03. POST Create a Booking");
	}
}
// Function to validate offer response
validateOfferResponse = function (passengerSpecifications, searchCriteria, fulfillmentOptions, offers, trips, scenarioType) {
	// Test if offers are returned
	pm.test("Offers are returned", function () {
		validationLogger("[INFO] DesiredType : " + scenarioType);

		const { requireAdmission, requireAncillary, requireReservation } = determineRequiredOfferParts(scenarioType);

		if (offers && offers.length > 0) {
			validationLogger("[INFO] 🔍 There are " + offers.length + " offers available");

			let found = false;
			for (let offerIndex = 0; offerIndex < offers.length && !found; offerIndex++) {
				validationLogger("[INFO] Checking offer index : " + offerIndex);
				const offer = offers[offerIndex];

				const { foundAdmissions, foundAncillaries, foundReservations } = validateOfferParts(
					offer,
					passengerSpecifications,
					fulfillmentOptions,
					searchCriteria,
					requireAdmission,
					requireAncillary,
					requireReservation
				);

				found = validateScenario(foundAdmissions, foundReservations, trips, passengerSpecifications, scenarioType);
			}
		} else {
			validationLogger("[INFO] No offer(s) available");
		}
	});

	validateOfferSearchCriteria(trips);
	validateTripSpecifications(trips);
	validateAnonymousPassengerSpecifications();
	selectAndSetOffer(offers);
	handlePlaceSelection();
};

// Helper function to determine required offer parts
function determineRequiredOfferParts(scenarioType) {
	let requireAdmission = false;
	let requireAncillary = false;
	let requireReservation = false;

	switch (scenarioType) {
		case "BOTH":
			requireAdmission = true;
			requireReservation = true;
			break;
		case "RESERVATION":
			requireReservation = true;
			break;
		default:
			requireAdmission = true;
	}

	return { requireAdmission, requireAncillary, requireReservation };
}

// Helper function to validate offer parts
function validateOfferParts(offer, passengerSpecifications, fulfillmentOptions, searchCriteria, requireAdmission, requireAncillary, requireReservation) {
	let foundAdmissions = 0;
	let foundAncillaries = 0;
	let foundReservations = 0;

	/*
	if (requireAdmission) {
		foundAdmissions = validateAdmissions(offer.admissionOfferParts, passengerSpecifications, fulfillmentOptions);
	}

	if (requireAncillary) {
		foundAncillaries = validateAncillaries(offer.ancillaryOfferParts, passengerSpecifications);
	}

	if (requireReservation) {
		foundReservations = validateReservations(offer.reservationOfferParts, passengerSpecifications, searchCriteria, fulfillmentOptions);
	}
	*/

	foundAdmissions = validateAdmissions(offer.admissionOfferParts, passengerSpecifications, fulfillmentOptions);
	foundAncillaries = validateAncillaries(offer.ancillaryOfferParts, passengerSpecifications);
	foundReservations = validateReservations(offer.reservationOfferParts, passengerSpecifications, searchCriteria, fulfillmentOptions);

	validationLogger("[INFO] Admissions : " + foundAdmissions);
	validationLogger("[INFO] Ancillaries : " + foundAncillaries);
	validationLogger("[INFO] Reservations : " + foundReservations);

	return { foundAdmissions, foundAncillaries, foundReservations };
}

// Helper function to validate admissions
function validateAdmissions(admissionOfferParts, passengerSpecifications, fulfillmentOptions) {
	let foundAdmissions = 0;

	if (admissionOfferParts) {
		for (const part of admissionOfferParts) {
			for (const passengerRef of part.passengerRefs) {
				const passengerFound = passengerSpecifications.some(passenger => passenger.externalRef === passengerRef);

				if (passengerFound) {
					if (fulfillmentOptions) {
						const fulfillmentOptionRequested = JSON.parse(fulfillmentOptions);
						const correctFulfillmentOption = part.availableFulfillmentOptions.some(
							option => option.type === fulfillmentOptionRequested[0].type && option.media === fulfillmentOptionRequested[0].media
						);

						pm.test("Correct requested fulfillments are returned", function () {
							pm.expect(correctFulfillmentOption).to.equal(true);
						});

						if (correctFulfillmentOption) foundAdmissions++;
					} else {
						foundAdmissions++;
					}
				} else {
					console.log("Passenger ref not found:", passengerRef);
				}
			}
		}
	}

	return foundAdmissions;
}

// Helper function to validate ancillaries
function validateAncillaries(ancillaryOfferParts, passengerSpecifications) {
	let foundAncillaries = 0;

	if (ancillaryOfferParts) {
		for (const part of ancillaryOfferParts) {
			for (const passengerRef of part.passengerRefs) {
				if (passengerSpecifications.some(passenger => passenger.externalRef === passengerRef)) {
					foundAncillaries++;
				}
			}
		}
	}

	return foundAncillaries;
}

// Helper function to validate reservations
function validateReservations(reservationOfferParts, passengerSpecifications, searchCriteria, fulfillmentOptions) {
	let foundReservations = 0;

	if (reservationOfferParts) {
		for (const part of reservationOfferParts) {
			for (const passengerRef of part.passengerRefs) {
				if (passengerSpecifications.some(passenger => passenger.externalRef === passengerRef)) {
					if (searchCriteria?.currency) {
						if (part.price.currency === searchCriteria.currency) {
							foundReservations++;
						}
					} else {
						foundReservations++;
					}

					if (fulfillmentOptions) {
						const fulfillmentOptionRequested = JSON.parse(fulfillmentOptions);
						const correctFulfillmentOption = part.availableFulfillmentOptions.some(
							option => option.type === fulfillmentOptionRequested[0].type && option.media === fulfillmentOptionRequested[0].media
						);

						pm.test("Correct requested fulfillments for reservations are returned", function () {
							pm.expect(correctFulfillmentOption).to.equal(true);
						});
					}
				}
			}
		}
	}

	return foundReservations;
}

// Helper function to validate scenario
function validateScenario(foundAdmissions, foundReservations, trips, passengerSpecifications, scenarioType) {
	const legAmountsLength = trips[0].legs.length;
	const passengerAmounts = passengerSpecifications.length;
	const amounts = legAmountsLength * passengerAmounts;

	switch (scenarioType) {
		case "BOTH":
			pm.test("Correct admissions are returned", function () {
				pm.expect(foundAdmissions).to.equal(amounts);
			});
			pm.test("Correct reservations are returned", function () {
				pm.expect(foundReservations).to.equal(amounts);
			});
			return foundAdmissions === amounts && foundReservations === amounts;

		case "RESERVATION":
			pm.test("Correct reservations are returned", function () {
				pm.expect(foundReservations).to.equal(amounts);
			});
			return foundReservations === amounts;

		default:
			pm.test("Correct admissions are returned", function () {
				pm.expect(foundAdmissions).to.equal(amounts);
			});
			return foundAdmissions === amounts;
	}
}

// Helper function to validate trip specifications
function validateTripSpecifications(trips) {
	if (pm.globals.get(OFFER.TRIP_SPECIFICATIONS)) {
		const requiredTrip = JSON.parse(pm.globals.get(OFFER.TRIP_SPECIFICATIONS));

		pm.test("Trips are returned", function () {
			pm.expect(trips).not.to.be.empty;

			const found = trips.some(trip => {
				const legsFound = trip.legs.filter(leg =>
					requiredTrip[0].legs.some(requiredLeg =>
						requiredLeg.timedLeg.start.stopPlaceRef.stopPlaceRef === leg.timedLeg.start.stopPlaceRef.stopPlaceRef &&
						requiredLeg.timedLeg.end.stopPlaceRef.stopPlaceRef === leg.timedLeg.end.stopPlaceRef.stopPlaceRef &&
						requiredLeg.timedLeg.service.vehicleNumbers[0] === leg.timedLeg.service.vehicleNumbers[0] &&
						requiredLeg.timedLeg.service.carriers[0].ref === leg.timedLeg.service.carriers[0].ref
					)
				).length;

				return legsFound === requiredTrip[0].legs.length;
			});

			pm.test("Correct legs are returned", function () {
				pm.expect(found).to.equal(true);
			});
		});
	}
}

// Helper function to validate offer search criteria
function validateOfferSearchCriteria(trips) {
	if (pm.globals.get(OFFER.TRIP_SEARCH_CRITERIA)) {
		const requiredCriteria = JSON.parse(pm.globals.get(OFFER.TRIP_SEARCH_CRITERIA));
		pm.test("Trips are returned", function () {
			pm.expect(trips).not.to.be.empty;

			const vehicleNumberCriteria = requiredCriteria?.parameters?.dataFilter?.vehicleFilter?.vehicleNumbers?.length > 0 
				? requiredCriteria.parameters.dataFilter.vehicleFilter.vehicleNumbers[0] 
				: undefined;
		
			const carrierCriteria = requiredCriteria?.parameters?.dataFilter?.carrierFilter?.carriers?.length > 0 
				? requiredCriteria.parameters.dataFilter.carrierFilter.carriers[0] 
				: undefined;
		
			const found = trips.some(trip => {
				const legs = trip.legs;
				const firstLeg = legs[0];
				const lastLeg = legs[legs.length - 1];

				if (!firstLeg || !lastLeg) return false;
				const matches = [firstLeg, lastLeg].every(leg => {
					const matchesOrigin = firstLeg.timedLeg.start.stopPlaceRef.stopPlaceRef === requiredCriteria.origin.stopPlaceRef;
					const matchesDestination = lastLeg.timedLeg.end.stopPlaceRef.stopPlaceRef === requiredCriteria.destination.stopPlaceRef;
					const matchesVehicleNumber = vehicleNumberCriteria !== undefined
					? firstLeg.timedLeg.service.vehicleNumbers[0] === vehicleNumberCriteria
					: true;

				const matchesCarrier = carrierCriteria !== undefined
					? firstLeg.timedLeg.service.carriers[0].ref === carrierCriteria
					: true;

					return matchesOrigin && matchesDestination && matchesVehicleNumber && matchesCarrier;
				});
				return matches;
			});

			pm.test("Correct legs matching search criteria are returned", function () {
				pm.expect(found).to.equal(true);
			});
		});
	}
}

// Helper function to validate anonymous passenger specifications
function validateAnonymousPassengerSpecifications() {
	pm.test("AnonymousPassengerSpecifications are returned", function () {
		const response = pm.response.json();
		pm.expect(response.anonymousPassengerSpecifications).not.to.be.empty;
	});
}

// Helper function to select and set the desired offer
function selectAndSetOffer(offers) {
	const desiredFlexibility = pm.globals.get("desiredFlexibility");
	const selectedOffers = offers.filter(offer => offer.offerSummary?.overallFlexibility === desiredFlexibility);
	const selectedOffer = selectedOffers.length > 0 ? selectedOffers[0] : offers[0];

	validationLogger("[INFO] DesiredFlexibility for current scenario : " + desiredFlexibility);
	console.log("[INFO] 🔍 Selected offer : ", selectedOffer);

	pm.globals.set("offers", offers);
	pm.globals.set("offerId", selectedOffer.offerId);
	pm.globals.set("offer", selectedOffer);

	if (selectedOffers.length === 0) {
		validationLogger("[INFO] Offer doesn't match the entry FLEXIBILITY criteria, taking the 1st offer in the list");
	}
}

// Helper function to handle place selection
function handlePlaceSelection() {
	if (pm.globals.get("requiresPlaceSelection") === true) {
		const reservationOfferPart = offer.reservationOfferParts[0];
		pm.globals.set("reservationId", reservationOfferPart.id);
	} else {
		validationLogger("skipping Get Place Maps for Reservation of Offer");
		pm.execution.setNextRequest("03. Create a Booking");
	}
}
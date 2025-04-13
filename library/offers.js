// Function to validate offer response
validateOfferResponse = function(passengerSpecifications, searchCriteria, fulfillmentOptions, offers, trips, scenarioType) {
	
	// Test if offers are returned
	pm.test("Offers are returned", function () {
		validationLogger("[INFO] DesiredType : "+scenarioType);
		var requireAdmission = false;
		var requireAncillary = false;
		var requireReservation = false;

		// Determine required offer parts based on scenario type
		switch(scenarioType) {
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

		if(offers!=undefined && offers.length>0){
			var offerIndex = 0;
			var found = false;
			validationLogger("[INFO] 🔍 There are "+offers.length+" offers available");
	
			while(found==false && offerIndex < offers.length) {
				validationLogger("[INFO] Checking offer index : "+offerIndex);
				offer = offers[offerIndex];
				var foundAdmissions = 0;
				var foundAncillaries = 0;
				var foundReservations = 0;

				// Check the admissions
				if(offer.admissionOfferParts!=undefined && requireAdmission==true) {
					var admissionOfferPartsIndex = 0;
					var passengerIndex = 0;
					
					// Check admissions for items
					while(admissionOfferPartsIndex < offer.admissionOfferParts.length) {
						for (let passengerRef of offer.admissionOfferParts[admissionOfferPartsIndex].passengerRefs) {
							let passengerFound = false;
							for (let passenger of passengerSpecifications) {
								if (passenger.externalRef === passengerRef) {
									passengerFound = true;

									// Check if fulfillment options were requested
									if (fulfillmentOptions !== undefined) {
										let correctFulfillmentOption = false;
										let fulfillmentOptionRequested = JSON.parse(fulfillmentOptions);
										for (let fulfillmentOption of offer.admissionOfferParts[admissionOfferPartsIndex].availableFulfillmentOptions) {
											if (fulfillmentOption.type === fulfillmentOptionRequested[0].type &&
												fulfillmentOption.media === fulfillmentOptionRequested[0].media) {
												correctFulfillmentOption = true;
												foundAdmissions++;
											}
										}
										pm.test("Correct requested fulfillments are returned", function () {
											pm.expect(correctFulfillmentOption).to.equal(true);
										});
									} else {
										foundAdmissions++;
									}
									break;
								}
							}
							if (!passengerFound) {
								console.log("Passenger ref not found:", passengerRef);
								// TODO : Throw exception ?
							}
						}
						admissionOfferPartsIndex++;
					}
				}

				// Check the ancillaries
				if(offer.ancillaryOfferParts!=undefined && requireAncillary==true) {
					var ancillaryOfferPartsIndex = 0;
				
					// Check ancillaries for items
					while(ancillaryOfferPartsIndex < offer.ancillaryOfferParts.length) {
						var passengerIndex = 0;
						offer.ancillaryOfferParts[ancillaryOfferPartsIndex].passengerRefs.forEach(function(passengerRef){
							while(passengerIndex<passengerSpecifications.length){
								if(passengerSpecifications[passengerIndex].externalRef==passengerRef){
									foundAncillaries++;
									// TODO : if(passengerSpecifications[passengerIndex].externalRef==passengerRef) Check is ok ?
								}
								passengerIndex++;
							}
						 });
						ancillaryOfferPartsIndex++;
					}
				}

				// Check the reservations
				if(offer.reservationOfferParts!=undefined && requireReservation==true) {
					var reservationOfferPartsIndex = 0;
				
					// Check reservations for items
					while(reservationOfferPartsIndex < offer.reservationOfferParts.length) {
						var passengerIndex = 0;
						offer.reservationOfferParts[reservationOfferPartsIndex].passengerRefs.forEach(function(passengerRef){
							while(passengerIndex<passengerSpecifications.length){
								if(passengerSpecifications[passengerIndex].externalRef==passengerRef){
									if(searchCriteria!=undefined&&searchCriteria.currency!=undefined) {
										pm.test("Reservation: correct currency is returned", function () {
											pm.expect(offer.reservationOfferParts[reservationOfferPartsIndex].price.currency).to.equal(searchCriteria.currency);
										});
										if(offer.reservationOfferParts[reservationOfferPartsIndex].price.currency==searchCriteria.currency) {
											foundReservations++;
										}
									} else {
										foundReservations++;
									}

									// Check if fulfillment options were requested
									if(fulfillmentOptions!=undefined) {
										var correctReservationFulfillmentOption = false;
										var fulfillmentOptionRequested = JSON.parse(fulfillmentOptions);
										offer.reservationOfferParts[reservationOfferPartsIndex].availableFulfillmentOptions.forEach(function(fulfillmentOption){
										if(fulfillmentOption.type==fulfillmentOptionRequested[0].type&&fulfillmentOption.media==fulfillmentOptionRequested[0].media) {
											correctReservationFulfillmentOption = true;
										}
										});
										pm.test("Correct requested fulfillments for reservations are returned", function () {
											pm.expect(correctReservationFulfillmentOption).to.equal(true);
											
										});
									}
								}
								passengerIndex++;
							}
						 });
						reservationOfferPartsIndex++;
					}
				}

				validationLogger("[INFO] Admissions : " + foundAdmissions);
				validationLogger("[INFO] Ancillaries : " + foundAncillaries);
				validationLogger("[INFO] Reservations : " + foundReservations);

				var legAmountsLength = trips[0].legs.length;
				var passengerAmounts = passengerSpecifications.length;
				amounts = legAmountsLength*passengerAmounts
				switch(scenarioType) {
					case "BOTH":
						
						pm.test("Correct admissions are returned", function () {
							pm.expect(foundAdmissions).to.equal(amounts);
						});
						pm.test("Correct reservations are returned", function () {
							pm.expect(foundReservations).to.equal(amounts);
						});
						if(amounts==foundAdmissions&&amounts==foundReservations) {
							found = true;
						}
						
						break;
					case "RESERVATION":
						pm.test("Correct reservations are returned", function () {
							pm.expect(foundReservations).to.equal(amounts);
						});
						if(amounts==foundReservations) {
							found = true;
						}
						break;
					default:
						pm.test("Correct admissions are returned", function () {
							pm.expect(foundAdmissions).to.equal(amounts);
						});
						if(amounts==foundAdmissions) {
							found = true;
						}
				}
				offerIndex++;
			}
		} else {
			validationLogger("[INFO] No offer(s) available");
		}
	});

	// Check if trip specifications are available
	if(pm.globals.get(OFFER.TRIP_SPECIFICATIONS)!=undefined&&pm.globals.get(OFFER.TRIP_SPECIFICATIONS)!=null) {
		var requiredTrip = JSON.parse(pm.globals.get(OFFER.TRIP_SPECIFICATIONS));
		validationLogger("[INFO] RequiredTrip : "+requiredTrip);
		pm.test("Trips are returned", function () {
			pm.expect(trips).not.to.be.empty;
			var found = false;
			var tripIndex = 0;
			var tripLength = trips.length;
			while(found==false&&tripIndex<tripLength){
				var trip = trips[tripIndex];
				var legsFound = 0;
				var legFound = true;
				var legIndex = 0;
				while(legFound==true&&legIndex<trip.legs.length){
					var leg = trip.legs[legIndex];
					legFound = false;
					requiredTrip[0].legs.forEach(function(requiredLeg){
						if(requiredLeg.timedLeg.start.stopPlaceRef.stopPlaceRef==leg.timedLeg.start.stopPlaceRef.stopPlaceRef&&
							requiredLeg.timedLeg.end.stopPlaceRef.stopPlaceRef==leg.timedLeg.end.stopPlaceRef.stopPlaceRef &&
							requiredLeg.timedLeg.service.vehicleNumbers[0]==leg.timedLeg.service.vehicleNumbers[0] &&
							requiredLeg.timedLeg.service.carriers[0].ref==leg.timedLeg.service.carriers[0].ref
							) {
							legsFound++;
							legFound = true;
						}
					});
					legIndex++;
				}
				if(legFound==false){
					found = false;
				} else if(legsFound==requiredTrip[0].legs.length){
					found = true;
				}
				tripIndex++;
			}
			pm.test("Correct legs are returned", function () {
				pm.expect(found).to.equal(true);
			});
		});
	}
	
	// Test if anonymous passenger specifications are returned
	pm.test("AnonymousPassengerSpecifications are returned", function () {
		let response = pm.response.json();
		pm.expect(response.anonymousPassengerSpecifications).not.to.be.empty;
	});

	// Select the desired offer based on flexibility
	let desiredFlexibility = pm.globals.get("desiredFlexibility"); 
	let selectedOffers = offers.filter(offer => 
		offer.offerSummary && offer.offerSummary.overallFlexibility === desiredFlexibility
	);
	let selectedOffer = selectedOffers.length > 0 ? selectedOffers[0] : null;
	validationLogger("[INFO] DesiredFlexibility for current scenario : " + desiredFlexibility);

	// Set the offer
	pm.globals.set("offers", offers);
	if (selectedOffer != null) {
		console.log("[INFO] 🔍 Selected offer : ", selectedOffer);
		pm.globals.set("offerId", selectedOffer.offerId);
		pm.globals.set("offer", selectedOffer);
	} else {
		console.log("[INFO] 🔍 Selected offer : ", offers[0]);
		pm.globals.set("offerId", offers[0].offerId);
		pm.globals.set("offer", offers[0]);
		validationLogger("[INFO] Offer doesn't match the entry FLEXIBILITY criteria, taking the 1st offer in the list");
		if (jsonData.warnings !== null) {
			validationLogger("[INFO] ⚠️ Warnings  : ", jsonData.warnings);
		}
	}

	// Function to validate offer conforms to offer search criteria
	pm.test("Offer is available and has valid search criteria", function () {
		pm.expect(OFFER.SEARCH_CRITERIA).not.to.be.null;
		pm.expect(OFFER.SEARCH_CRITERIA).to.be.a('string');
	});

	// Check if place selection is required
	if(pm.globals.get("requiresPlaceSelection")==true) {
		var reservationOfferPart = offer.reservationOfferParts[0];
		pm.globals.set("reservationId", reservationOfferPart.id);
	} else {
		validationLogger("skipping Get Place Maps for Reservation of Offer");
		pm.execution.setNextRequest("03. Create a Booking");
	}
};
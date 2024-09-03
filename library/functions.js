var uuid = require('uuid');

setAuthToken = function () {
    let jsonData = JSON.parse(responseBody);
    
    pm.globals.set(GV.ACCESS_TOKEN, jsonData.access_token);
}

osdmTripSearchCriteria = function (legDefinitions) {
	console.log("osdmTripSearchCriteria Method")
	pm.test('Trip Search Criteria has at least one leg', function () {
        pm.expect(legDefinitions).to.be.an("array");
        pm.expect(legDefinitions.length).to.be.above(0);

        if (legDefinitions.length == 0) return; // Stop execution if legs are missing
    });

	if (legDefinitions.length > 1) {
		console.log("WARNING TripSearchCriteria currently doesn't generate via points when multiple legs are provided");
	}

	var legDef = legDefinitions[0];

	var carrierFilter = legDef.carrier ? new CarrierFilter([legDef.carrier], false) : null;
	var vehicleFilter = new VehicleFilter([legDef.vehicleNumber], null, false);

	var tripDataFilter = new TripDataFilter(carrierFilter, vehicleFilter);

	var tripParameters = new TripParameters(tripDataFilter);

	var tripSearchCriteria = new TripSearchCriteria(
		legDef.startDateTime.substring(0, legDef.startDateTime.length - 6) ,
		new StopPlaceRef(legDef.startStopPlaceRef),
		new StopPlaceRef(legDef.endStopPlaceRef),
		tripParameters
	);
	
	pm.globals.set(OFFER.TRIP_SEARCH_CRITERIA, JSON.stringify(tripSearchCriteria));
};

osdmTripSpecification = function (legDefinitions) {
    pm.test('Trip Specification has at least one leg', function () {
        pm.expect(legDefinitions).to.be.an("array");
        pm.expect(legDefinitions.length).to.be.above(0);

        if (legDefinitions.length == 0) return; // Stop execution if legs are missing
    });

    pm.globals.set(TRIP.EXTERNAL_REF, uuid.v4());

    var legSpecs = [];

    for (let n = 1; n <= legDefinitions.length; n++) {
        var legKey = TRIP.LEG_SPECIFICATION_REF_PATTERN.replace("%LEG_COUNT%", n);
        var legDef = legDefinitions[n-1];

        var boardSpec = new BoardSpecification(new StopPlaceRef(legDef.startStopPlaceRef), new ServiceTime(legDef.startDateTime));
        var alignSpec = new AlignSpecification(new StopPlaceRef(legDef.endStopPlaceRef), new ServiceTime(legDef.endDateTime));

        var productCategory = legDef.productCategoryRef == null ? 
            null :
            new ProductCategory(legDef.productCategoryRef, legDef.productCategoryName, legDef.productCategoryShortName);

        var datedJourney = new DatedJourney(productCategory, [legDef.vehicleNumber], [new NamedCompany(legDef.carrier)]);

        var timedLegSpec = new TimedLegSpecification(
            boardSpec,
            alignSpec,
            datedJourney
        );

        pm.globals.set(legKey, uuid.v4());

        legSpecs.push(new TripLegSpecification(
            pm.globals.get(legKey),
            timedLegSpec
        ));
    }

    var tripSpecification = new TripSpecification(
        pm.globals.get(TRIP.EXTERNAL_REF),
        legSpecs
    );

    pm.globals.set(OFFER.TRIP_SPECIFICATIONS, JSON.stringify([tripSpecification]));
};

osdmAnonymousPassengerSpecifications = function(passengerNumber) {
    pm.globals.set(OFFER.PASSENGER_NUMBER, passengerNumber);

    var passengerSpecs = [];

    for (let n = 1; n <= passengerNumber; n++) {
        var passengerKey = OFFER.PASSENGER_SPECIFICATION_EXTERNAL_REF_PATTERN.replace("%PASSENGER_COUNT%", n);

        var birthDate = new Date();
        birthDate.setFullYear(birthDate.getFullYear() - 26);
        birthDate.setDate(birthDate.getDate() -1);

        pm.globals.set(passengerKey, uuid.v4());

        passengerSpecs.push(new AnonymousPassengerSpec(
            pm.globals.get(passengerKey),
            PassengerType.PERSON,
            birthDate.toISOString().substring(0,10),
        ));
    }

    pm.globals.set(OFFER.PASSENGER_SPECIFICATIONS, JSON.stringify(passengerSpecs));
};

osdmOfferSearchCriteria = function (
    currency,
    offerMode,
    offerParts,
    flexibilities,
    serviceClassTypes,
    travelClasses,
    productTags,
) {
    var offerSearchCriteria = new Object();

    if (currency != null && currency != '') {
        offerSearchCriteria.currency = currency;
    }

    if (Array.isArray(offerParts) && offerParts.length > 0) {
        offerSearchCriteria.requestedOfferParts = offerParts;
    }

    if (Array.isArray(serviceClassTypes) && serviceClassTypes.length > 0) {
        offerSearchCriteria.serviceClassTypes = serviceClassTypes;
    }

    if (Array.isArray(travelClasses) && travelClasses.length > 0) {
        offerSearchCriteria.travelClasses = travelClasses;
    }

    pm.globals.set(OFFER.SEARCH_CRITERIA, JSON.stringify(offerSearchCriteria));
};

osdmFulfillmentOptions = function(requestedFulfillmentOptions) {
    if (Array.isArray(requestedFulfillmentOptions) && requestedFulfillmentOptions.length > 0) {
        pm.globals.set(OFFER.FULFILLMENT_OPTIONS, JSON.stringify(requestedFulfillmentOptions));
    }
};

validateOfferConformsToOfferSearchCriteria = function (offer) {
    pm.test("Offer is available", function () {
        pm.expect(pm.globals.get(OFFER.SEARCH_CRITERIA)).not.be.null;
    });

    pm.test("Offer Search Criteria are available", function () {
        pm.expect(pm.globals.get(OFFER.SEARCH_CRITERIA)).to.be.a('string');
    });

    //offerSearchCriteria = JSON.parse(pm.globals.get(OFFER.SEARCH_CRITERIA));
    //offerSearchCriteria.requestedOfferParts
};


validateOfferResponse = function(passengerSpecifications, searchCriteria, fulfillmentOptions, offers, trips, scenarioType) {
	
	pm.test("offers are returned", function () {
	    pm.expect(offers).not.to.be.empty;

        validationLogger(passengerSpecifications);
        validationLogger(pm.globals.get(OFFER.FULFILLMENT_OPTIONS));
        validationLogger(searchCriteria);
        validationLogger(offers);
        validationLogger("type:"+pm.globals.get("SCENARIO_TYPE"));

        
	    var requireAdmission = false;
	    var requireAncillary = false;
	    var requireReservation = false;
	    
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
	        var offerLength = offers.length;
	
	        var found = false;
            
	        var items_found = 0;
	        var passengerRef = "";
	        
	        validationLogger("There are "+offerLength+" offers available");
	
	        while(found==false && offerIndex < offerLength) {
	            validationLogger("checking offer: "+offerIndex);
	            offer = offers[offerIndex];

                var foundAdmissions = 0;
                var foundAncillaries = 0;
                var foundReservations = 0;


				//Check the admissions	            
	            if(offer.admissionOfferParts!=undefined && requireAdmission==true) {
	            	var admissionOfferPartsIndex = 0;
	            	var admissionOfferPartsLength = offer.admissionOfferParts.length;
	            	
	            	//check admissions for items
		            while(admissionOfferPartsIndex < admissionOfferPartsLength) {
		                var admissionOfferPart = offer.admissionOfferParts[admissionOfferPartsIndex];

                         var passengerIndex = 0;
                         var passengerLenght = passengerSpecifications.length;

                         admissionOfferPart.passengerRefs.forEach(function(passengerRef){
                            while(passengerIndex<passengerLenght){
                                
                                if(passengerSpecifications[passengerIndex].externalRef==passengerRef){

                                    //check if fullfillment options were requested
                                    if(fulfillmentOptions!=undefined) {

                                        var correctFulfillmentOption = false;
                                        var fulfillmentOptionRequested = JSON.parse(fulfillmentOptions);

                                        admissionOfferPart.availableFulfillmentOptions.forEach(function(fulfillmentOption){

                                            if(fulfillmentOption.type==fulfillmentOptionRequested[0].type&&fulfillmentOption.media==fulfillmentOptionRequested[0].media) {
                                                correctFulfillmentOption = true;
                                                foundAdmissions++;
                                            }
                                        });

                                        pm.test("Correct requested fulfillments are returned", function () {
                                            pm.expect(correctFulfillmentOption).to.equal(true);
                                            
                                        });
                                    } else {
                                        foundAdmissions++;
                                    }
                                    
                                }

                                passengerIndex++;
                            }
                         });

		                admissionOfferPartsIndex++;
		            }
	            }
	
				//Check the ancillaries
	            if(offer.ancillaryOfferParts!=undefined && requireAncillary==true) {
					var ancillaryOfferPartsIndex = 0;
	            	var ancillaryOfferPartsLength = offer.ancillaryOfferParts.length;
	            
		            //check ancillaries for items
		            while(ancillaryOfferPartsIndex < ancillaryOfferPartsLength) {
		                var ancillaryOfferPart = offer.ancillaryOfferParts[ancillaryOfferPartsIndex];
	
                        var passengerIndex = 0;
                        var passengerLenght = passengerSpecifications.length;
                        ancillaryOfferPart.passengerRefs.forEach(function(passengerRef){
                            while(passengerIndex<passengerLenght){
                                
                                if(passengerSpecifications[passengerIndex].externalRef==passengerRef){
                                    foundAncillaries++;
                                }

                                passengerIndex++;
                            }
                         });
		
		                ancillaryOfferPartsIndex++;
		            }
	            }
	            
	            //check the reservations
	            if(offer.reservationOfferParts!=undefined && requireReservation==true) {
					var reservationOfferPartsIndex = 0;
	            	var reservationOfferPartsLength = offer.reservationOfferParts.length;
	            
		            //check ancillaries for items
		            while(reservationOfferPartsIndex < reservationOfferPartsLength) {
		                var reservationOfferPart = offer.reservationOfferParts[reservationOfferPartsIndex];

                        var passengerIndex = 0;
                        var passengerLenght = passengerSpecifications.length;
                        reservationOfferPart.passengerRefs.forEach(function(passengerRef){
                            while(passengerIndex<passengerLenght){
                                
                                if(passengerSpecifications[passengerIndex].externalRef==passengerRef){

                                    if(searchCriteria!=undefined&&searchCriteria.currency!=undefined) {
                                        
                                        pm.test("Reservation: correct currency is returned", function () {
                                            pm.expect(reservationOfferPart.price.currency).to.equal(searchCriteria.currency);
                                        });

                                        if(reservationOfferPart.price.currency==searchCriteria.currency) {
                                            foundReservations++;
                                        }
                                    } else {
                                        foundReservations++;
                                    }

                                    //check if fullfillment options were requested
                                    if(fulfillmentOptions!=undefined) {

                                        var correctReservationFulfillmentOption = false;
                                        var fulfillmentOptionRequested = JSON.parse(fulfillmentOptions);

                                        reservationOfferPart.availableFulfillmentOptions.forEach(function(fulfillmentOption){

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

                validationLogger("admissions:"+foundAdmissions);
	            validationLogger("ancillaries:"+foundAncillaries);
                validationLogger("reservations:"+foundReservations);
                

                var amounts = passengerSpecifications.length;
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
	        validationLogger("No offers available");
	    }
	});

	if(pm.globals.get(OFFER.TRIP_SPECIFICATIONS)!=undefined&&pm.globals.get(OFFER.TRIP_SPECIFICATIONS)!=null) {
	    var requiredTrip = JSON.parse(pm.globals.get(OFFER.TRIP_SPECIFICATIONS));
	    validationLogger("requiredTrip:"+requiredTrip);
	
	    pm.test("trips are returned", function () {
		    pm.expect(trips).not.to.be.empty;
	
	        var found = false;
	        var tripIndex = 0;
	        var tripLength = trips.length;
	
	        while(found==false&&tripIndex<tripLength){
	            var trip = trips[tripIndex];
	
	            var legsFound = 0;
	            var legFound = true;
	            var legIndex = 0;
	            var legLength = trip.legs.length;
	            while(legFound==true&&legIndex<legLength){
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
	
	pm.test("anonymousPassengerSpecifications are returned", function () {
	    let response = pm.response.json();
	    pm.expect(response.anonymousPassengerSpecifications).not.to.be.empty;
	});
};

validateBookingResponse = function( passengerSpecifications, searchCriteria, fulfillmentOptions, offers, offerId, booking, scenarioType, state) {

	var bookingId = booking.id;
	var createdOn = new Date(booking.createdOn);
	var passengers = booking.passengers;
	var confirmationTimeLimit = new Date(booking.confirmationTimeLimit);
	var bookedOffers = booking.bookedOffers;
	
	validationLogger("Checking booking with Id: "+bookingId);
	validationLogger("CreatedOn: "+createdOn);
	validationLogger("Passengers: "+passengers);
	validationLogger("ConfirmationTimeLimit: "+confirmationTimeLimit);
	validationLogger("BookedOffers: "+bookedOffers);
	validationLogger("offers: "+offers);
	validationLogger("offer_id: "+offerId);
	
	//check the bookingId
	pm.test("a bookingId is returned", function () {
        pm.expect(bookingId).to.be.a('string').and.not.be.empty;
    });
	
	//check the creation date
	var currentDate = new Date();
	validationLogger(currentDate);
	pm.test("Correct createdOn is returned", function () {
        pm.expect(currentDate.getDate()).to.equal(createdOn.getDate());
        pm.expect(currentDate.getMonth()).to.equal(createdOn.getMonth());
        pm.expect(currentDate.getFullYear()).to.equal(createdOn.getFullYear());
    });
    
    //check if a confirmationTimeLimit is available to check
    if(booking.confirmationTimeLimit!=undefined&&booking.confirmationTimeLimit!=null){
	    //check the confirmationTimeLimit
	    pm.test("a correct confirmationTimeLimit is returned", function () {
	    	var current = currentDate.getTime();
	    	var confirmation = confirmationTimeLimit.getTime();
	        pm.expect(confirmation).to.be.above(current);
	    });
    }
    
    var offer = null;
    offers.some(function(internalOffer){
    	if(internalOffer.offerId==offerId){
    		offer = internalOffer;
    		return true;
    	}
    });
    
    if(offer==undefined||offer==null) {
    	validationLogger("No correct offer can be found, skipping rest of validation");
    	return;
    } else {
    	validationLogger("Correct offer from offer response found, performing rest of validation");
    }
    
    var found = bookedOffers.some(function(bookedOffer){
		return compareOffers(bookedOffer, offer, booking, state);
	});
	
	pm.test("Correct offer "+offer.offerId+" is returned", function () {
        pm.expect(found).to.equal(true);
    });
    
    //check that all the passengers match the passengers from the offer
	offer.passengerRefs.forEach(function(passenger){

		var found = false;
		found = passengers.some(function(bookedPassenger){
			validationLogger("checking "+bookedPassenger.externalRef+" against "+passenger);
			if(bookedPassenger.externalRef==passenger){
				return true;
			}
		});

		pm.test("passenger "+passenger+" returned", function () {
			pm.expect(found).to.equal(true);
		});

	});

};

compareOffers = function(bookedOffer, offer, booking, state){
	validationLogger("Comparing "+bookedOffer.offerId+" to "+offer.offerId);
	
	if((bookedOffer.admissions==undefined||bookedOffer.admissions==null||bookedOffer.admissions.length==0)&&
		(offer.admissionOfferParts==undefined||offer.admissionOfferParts==null||offer.admissionOfferParts.length==0)) {
		//ok, nothing defined
		validationLogger("skipping admissions");
	} else {
		validationLogger("checking admissions");
		bookedOffer.admissions.forEach(function(bookedAdmission){
		
			//check generic part
			checkGenericBookedOfferPart(bookedAdmission, state);
			
			var found = offer.admissionOfferParts.some(function(offeredAdmission){
				return compareAdmissions (bookedAdmission, offeredAdmission, booking);
			});
		});	
	}
	
	if((bookedOffer.reservations==undefined||bookedOffer.reservations==null||bookedOffer.reservations.length==0)&&
		(offer.reservationOfferParts==undefined||offer.reservationOfferParts==null||offer.reservationOfferParts.length==0)) {
		//ok, nothing defined
		validationLogger("skipping reservations");
	} else {
		validationLogger("checking reservations");
		bookedOffer.reservations.forEach(function(bookedReservation){
		
			//check generic part
			checkGenericBookedOfferPart(bookedReservation, state);
		
			var found = offer.reservationOfferParts.some(function(offeredReservation){
				return compareReservations (bookedReservation, offeredReservation, booking);
			});
		});	
	}
	
	return true;
};

compareAdmissions = function(bookedAdmission, offeredAdmission, booking){
	validationLogger("Comparing admission "+bookedAdmission.id+" to "+offeredAdmission.id);
	
	//price "should" be the same
	pm.test("Price of the admission should be correct", function () {
		pm.expect(bookedAdmission.price.amount).to.equal(offeredAdmission.price.amount);
		pm.expect(bookedAdmission.price.currency).to.equal(offeredAdmission.price.currency);
		pm.expect(bookedAdmission.price.scale).to.equal(offeredAdmission.price.scale);
	});
	
	//products should be the same
	pm.test("Products of the admission should be correct", function () {
		bookedAdmission.products.forEach(function(bookedProduct){
			var found = offeredAdmission.products.some(function(offeredProduct){

				if(bookedProduct.productId==offeredProduct.productId){
					return true;
				}
			});
			
			pm.expect(found).to.equal(true);
		});
	});
	
	//exchangeable
	if(bookedAdmission.exchangeable!=undefined){
		pm.test("Exchangable should be set and similar to offered", function () {
			pm.expect(bookedAdmission.exchangeable).to.equal(offeredAdmission.exchangeable);
		});
	}
	
	//isReservationRequired
	if(bookedAdmission.isReservationRequired!=undefined){
		pm.test("isReservationRequired should be set and similar to offered", function () {
			pm.expect(bookedAdmission.isReservationRequired).to.equal(offeredAdmission.isReservationRequired);
		});
	}
	
	//isReusable
	if(bookedAdmission.isReusable!=undefined){
		pm.test("Exchangable should be set and similar to offered", function () {
			pm.expect(bookedAdmission.isReusable).to.equal(offeredAdmission.isReusable);
		});
	}
	
	//offerMode
	if(bookedAdmission.offerMode!=undefined){
		pm.test("offerMode should be set and similar to offered", function () {
			pm.expect(bookedAdmission.offerMode).to.equal(offeredAdmission.offerMode);
		});
	}
	
	//refundable
	if(bookedAdmission.refundable!=undefined){
		pm.test("refundable should be set and similar to offered", function () {
			pm.expect(bookedAdmission.refundable).to.equal(offeredAdmission.refundable);
		});
	}
	
	//passengerIds should match the passenger id in the passenger object of the booking, 
	//with the reference still matching the offer
	pm.test("Correct passengers are part of the admission", function () {
		bookedAdmission.passengerIds.forEach(function(passengerId){
			var found = booking.passengers.some(function(bookedPassenger){
				if(passengerId==bookedPassenger.id){
					return true;
				}
			});
			
			pm.expect(found).to.equal(true);
		});
		
		
	});
	
	return true;
};

compareReservations = function(bookedReservation, offeredReservation, booking){
	validationLogger("Comparing reservation "+bookedReservation.id+" to "+offeredReservation.id);
	//price "should" be the same
	pm.test("Price of the reservation should be correct", function () {
		pm.expect(bookedReservation.price.amount).to.equal(offeredReservation.price.amount);
		pm.expect(bookedReservation.price.currency).to.equal(offeredReservation.price.currency);
		pm.expect(bookedReservation.price.scale).to.equal(offeredReservation.price.scale);
	});
	
	//products should be the same when available
	if(bookedReservation.products!=undefined&&bookedReservation.products!=null&&bookedReservation.products.length!=0){
		pm.test("Products of the reservation should be correct", function () {
			bookedReservation.products.forEach(function(bookedProduct){
				var found = offeredReservation.products.some(function(offeredProduct){
	
					if(bookedProduct.productId==offeredProduct.productId){
						return true;
					}
				});
				
				pm.expect(found).to.equal(true);
			});
		});
	}
	
	//exchangeable
	if(bookedReservation.exchangeable!=undefined){
		pm.test("Exchangable should be set and similar to offered", function () {
			pm.expect(bookedReservation.exchangeable).to.equal(offeredReservation.exchangeable);
		});
	}
	
	//isReservationRequired
	if(bookedReservation.isReservationRequired!=undefined){
		pm.test("isReservationRequired should be set and similar to offered", function () {
			pm.expect(bookedReservation.isReservationRequired).to.equal(offeredReservation.isReservationRequired);
		});
	}
	
	//isReusable
	if(bookedReservation.isReusable!=undefined){
		pm.test("Exchangable should be set and similar to offered", function () {
			pm.expect(bookedReservation.isReusable).to.equal(offeredReservation.isReusable);
		});
	}
	
	//offerMode
	if(bookedReservation.offerMode!=undefined){
		pm.test("offerMode should be set and similar to offered", function () {
			pm.expect(bookedReservation.offerMode).to.equal(offeredReservation.offerMode);
		});
	}
	
	//refundable
	if(bookedReservation.refundable!=undefined){
		pm.test("refundable should be set and similar to offered", function () {
			pm.expect(bookedReservation.refundable).to.equal(offeredReservation.refundable);
		});
	}
	
	//passengerIds should match the passenger id in the passenger object of the booking, 
	//with the reference still matching the offer
	pm.test("Correct passengers are part of the reservation", function () {
		bookedReservation.passengerIds.forEach(function(passengerId){
			var found = booking.passengers.some(function(bookedPassenger){
				if(passengerId==bookedPassenger.id){
					return true;
				}
			});
			
			pm.expect(found).to.equal(true);
		});
		
		
	});
	
	return true;
};

compareAncillaries = function(ancillary1, ancillary2, booking){
	validationLogger("Comparing ancillary "+ancillary1.id+" to "+ancillary2.id);
	return true;
};

validationLogger = function (message) {
	if(pm.globals.get("LOGGING_TYPE")=="FULL") {
		console.log(message);
	}
};

checkGenericBookedOfferPart = function(offerPart, state){
	//check the creation date
	var currentDate = new Date();
	var createdOn = new Date(offerPart.createdOn);
	var confirmableUntil = new Date(offerPart.confirmableUntil);

	
	pm.test("Correct createdOn is returned on bookedofferpart", function () {
        pm.expect(currentDate.getDate()).to.equal(createdOn.getDate());
        pm.expect(currentDate.getMonth()).to.equal(createdOn.getMonth());
        pm.expect(currentDate.getFullYear()).to.equal(createdOn.getFullYear());
    });
    
    //check the confirmableUntil when this is a prebooked offer part
    if(state=="PREBOOKED"){
	    pm.test("a correct confirmableUntil is returned on bookedofferpart", function () {
	    	var current = currentDate.getTime();
	    	var confirmation = confirmableUntil.getTime();
	        pm.expect(confirmation).to.be.above(current);
	    });
    }
    
    //check the status
    pm.test("a correct status is returned on bookedofferpart", function () {
        pm.expect(offerPart.status).to.equal(state);
    });
    
};

checkFulFilledBooking = function(booking, offer, state){

	validationLogger("offer:"+offer);
	var passengers = booking.passengers;

	booking.bookedOffers.forEach(function(bookedOffer){
	
		//check the admissions
		if(bookedOffer.admissions!=undefined&&bookedOffer.admissions!=null&&bookedOffer.admissions.length>0){
			bookedOffer.admissions.forEach(function(bookedOfferPart){
				checkGenericBookedOfferPart(bookedOfferPart,state);
			});
		}
		
		//check the reservations
		if(bookedOffer.reservations!=undefined&&bookedOffer.reservations!=null&&bookedOffer.reservations.length>0){
			bookedOffer.reservations.forEach(function(bookedOfferPart){
				checkGenericBookedOfferPart(bookedOfferPart,state);
			});
		}

		//confirmedPrice
		var offerPrice = offer.offerSummary.minimalPrice;
		var bookingPrice = booking.confirmedPrice;
		
		pm.test("Correct price is used on booking, compared to offer", function () {
			pm.expect(offerPrice.amount).to.equal(bookingPrice.amount);
			pm.expect(offerPrice.currency).to.equal(bookingPrice.currency);
		});
		
		//fulfillments
		booking.fulfillments.forEach(function(fulfillment) {
			checkFulfillment(booking, fulfillment, state);
		});
		
		//passengers
		//check that all the passengers match the passengers from the offer
		offer.passengerRefs.forEach(function(passenger){
	
			var found = false;
			found = passengers.some(function(bookedPassenger){
				validationLogger("checking "+bookedPassenger.externalRef+" against "+passenger);
				if(bookedPassenger.externalRef==passenger){
					return true;
				}
			});
	
			pm.test("passenger "+passenger+" returned", function () {
				pm.expect(found).to.equal(true);
			});
	
		});
		
		//purchaser
		if(booking.purchaser!=undefined&&booking.purchaser!=null&&booking.purchaser.detail!=undefined&&booking.purchaser.detail!=null) {
			pm.test("Correct Purchaser is returned", function () {
				pm.expect(booking.purchaser.detail.firstName).not.to.be.empty;
				pm.expect(booking.purchaser.detail.lastName).not.to.be.empty;
			});
		}
		
		//trips
	});
};

checkFulfillment = function(booking, fulfillment, state){

	pm.test("Correct booking reference is returned on fulfillment", function () {
		pm.expect(fulfillment.bookingRef).to.equal(booking.id);
	});

	var currentDate = new Date();
	var createdOn = new Date(fulfillment.createdOn);
	
	pm.test("Correct createdOn is returned on fulfillment", function () {
        pm.expect(currentDate.getDate()).to.equal(createdOn.getDate());
        pm.expect(currentDate.getMonth()).to.equal(createdOn.getMonth());
        pm.expect(currentDate.getFullYear()).to.equal(createdOn.getFullYear());
    });
    
    
	pm.test("Correct state is returned on fulfillment", function () {
		pm.expect(fulfillment.status).to.equal(state);
	});
};

validateRefundResponse = function(refundResponse) {
    var refundOffers = refundResponse.refundOffers;

    pm.test("Refund response contains refundOffers", function () {
        pm.expect(refundOffers).to.be.an('array').that.is.not.empty;
    });

    refundOffers.forEach(function(refundOffer) {
        //var validUntil = refundOffer.validUntil ? new Date(refundOffer.validUntil) : null;
        var status = refundOffer.status;
        var appliedOverruleCode = refundOffer.appliedOverruleCode;
        var fulfillments = refundOffer.fulfillments;
		var refundFee = refundOffer.refundFee;
        var refundableAmount = refundOffer.refundableAmount;

        validationLogger("Checking refund offer with Id: " + refundOffer.id);
        //validationLogger("ValidUntil: " + validUntil);
        validationLogger("Status: " + status);
        validationLogger("AppliedOverruleCode: " + appliedOverruleCode);

		/*
		// Check validUntil is at least 10 minutes from now
		pm.test("ValidUntil is at least 10 minutes from now", function () {
			var validUntilBookedOffers = pm.globals.get("valid_until_booked_offers");
			var validUntil = response.booking.bookedOffers[0].reservations[0].validUntil
			pm.expect(validUntil).to.be.below(validUntilBookedOffers);
		});
		*/

        // Check the status
		pm.test("Correct status is returned", function () {
			pm.expect(status).to.be.a('string').and.to.equal('PROPOSED');
		});

		pm.test("AppliedOverruleCode is returned", function () {
			var expectedOverruleCode = pm.globals.get("overruleCode");
			if (expectedOverruleCode === null || expectedOverruleCode === undefined) {
				pm.expect(appliedOverruleCode).to.be.null;
			} else {
				pm.expect(appliedOverruleCode).to.equal(expectedOverruleCode);
			}
		});

        // Check the fulfillments
        pm.test("Fulfillments are present and valid", function () {
            pm.expect(fulfillments).to.be.an('array').that.is.not.empty;
            fulfillments.forEach(function(fulfillment) {
                pm.expect(fulfillment.id).to.be.a('string').and.not.be.empty;

				// TODO DONE for fulfillment implementation
				var fulfillmentsId = pm.globals.get("fulfillments_id");
				pm.expect(fulfillment.id).to.eql(fulfillmentsId);
            });
		});

        // Check the refundFee
        pm.test("refundFee is correct", function () {
            pm.expect(refundFee.amount).to.be.a('number').and.to.be.at.least(0);
        });

        // Check the refundableAmount
        pm.test("Refundable amount matches the confirmed booking price", function () {
			var overruleCode = pm.globals.get("overruleCode");
			if (overruleCode === "CODE_DOES_NOT_EXIST") {
				pm.expect(appliedOverruleCode) //CODE_DOES_NOT_EXIST is reflected
				pm.expect(refundableAmount.amount).to.be.null;
			} else {
				pm.expect(refundableAmount.amount).to.be.a('number').and.to.be.at.least(0);

				var bookingConfirmedPrice = pm.globals.get("booking_confirmedPrice");
				// Check refundableAmount equal to bookingConfirmedPrice from GET /booking
				pm.expect(refundableAmount.amount).to.equal(bookingConfirmedPrice);
			}
        });
    });
};

validateGetBookingResponseBeforeRefund = function(response) {
    pm.test("Booking is present in the response", function() {
        pm.expect(response).to.have.property('booking');
    });

    const booking = response.booking;
    const refundOffer = booking.refundOffers[0];

    pm.test("Booking ID is a non-empty string", function() {
        pm.expect(booking).to.have.property('id').that.is.a('string').and.not.empty;
    });

	pm.test("ValidUntil is at least 10 minutes from now for Booked Offers", function () {
		var validUntilBookedOffers = new Date(pm.variables.get("valid_until_booked_offers"));
		var validUntil = new Date(response.booking.bookedOffers[0].reservations[0].validUntil);
		const validUntilBookedOffersPlus10Min = new Date(validUntilBookedOffers.getTime() + 10 * 60000);
		pm.expect(validUntil).to.be.below(validUntilBookedOffersPlus10Min);
	});

	pm.test("ValidUntil is at least 10 minutes from now for Refund Offers", function () {
		var validUntilRefundOffers = new Date(pm.variables.get("valid_until_refund_offers"));
		var validUntil = new Date(response.booking.refundOffers[0].validUntil);
		const validUntilRefundOffersPlus10Min = new Date(validUntilRefundOffers.getTime() + 10 * 60000);
		pm.expect(validUntil).to.be.below(validUntilRefundOffersPlus10Min);
	});

    pm.test("Refund offers array exists and is not empty", function() {
        pm.expect(booking).to.have.property('refundOffers').that.is.an('array').with.length.above(0);
    });

    pm.test("Refund offer ID is a non-empty string", function() {
        pm.expect(refundOffer).to.have.property('id').that.is.a('string').and.not.empty;
    });

    pm.test("Admissions are present and have status REFUNDED", function() {
        if (refundOffer.admissions) {
            refundOffer.admissions.forEach(admission => {
                pm.expect(admission).to.have.property('status').that.equals('REFUNDED');
            });
        }
    });

    pm.test("Fulfillments are present and have status FULFILLED", function() {
        if (refundOffer.fulfillments) {
            refundOffer.fulfillments.forEach(fulfillment => {
                pm.expect(fulfillment).to.have.property('status').that.equals('FULFILLED');
                pm.expect(fulfillment.id).to.be.a('string').and.not.be.empty;

				// TODO DONE for fulfillment implementation
				var fulfillmentsId = pm.globals.get("fulfillments_id");
				pm.expect(fulfillment.id).to.eql(fulfillmentsId);
			});
		}
	});

    pm.test("Refundable amount matches the amount from Refund", function() {
        pm.expect(refundOffer).to.have.property('refundableAmount');
		pm.expect(refundOffer.refundableAmount).to.have.property('amount').that.is.a('number').and.not.below(0);

		var bookingConfirmedPrice = pm.globals.get("booking_confirmedPrice");
		// Check refundableAmount equal to bookingConfirmedPrice from GET /booking
		pm.expect(refundOffer.refundableAmount.amount).to.equal(bookingConfirmedPrice);
	});	
}

validateGetBookingResponseAfterRefund = function(response) {
    pm.test("Booking is present in the response", function() {
        pm.expect(response).to.have.property('booking');
    });

    const booking = response.booking;
    const refundOffer = booking.refundOffers[0];

    pm.test("Booking ID is a non-empty string", function() {
        pm.expect(booking).to.have.property('id').that.is.a('string').and.not.empty;
    });

	pm.test("ValidUntil is at least 10 minutes from now for Booked Offers", function () {
		var validUntilBookedOffers = new Date(pm.variables.get("valid_until_booked_offers"));
		var validUntil = new Date(response.booking.bookedOffers[0].reservations[0].validUntil);
		const validUntilBookedOffersPlus10Min = new Date(validUntilBookedOffers.getTime() + 10 * 60000);
		pm.expect(validUntil).to.be.below(validUntilBookedOffersPlus10Min);
	});

	pm.test("ValidUntil is at least 10 minutes from now for Refund Offers", function () {
		var validUntilRefundOffers = new Date(pm.variables.get("valid_until_refund_offers"));
		var validUntil = new Date(response.booking.refundOffers[0].validUntil);
		const validUntilRefundOffersPlus10Min = new Date(validUntilRefundOffers.getTime() + 10 * 60000);
		pm.expect(validUntil).to.be.below(validUntilRefundOffersPlus10Min);
	});

    pm.test("Refund offers array exists and is not empty", function() {
        pm.expect(booking).to.have.property('refundOffers').that.is.an('array').with.length.above(0);
    });

    pm.test("Refund offer ID is a non-empty string", function() {
        pm.expect(refundOffer).to.have.property('id').that.is.a('string').and.not.empty;
    });

    pm.test("Admissions are present and have status REFUNDED", function() {
        if (refundOffer.admissions) {
            refundOffer.admissions.forEach(admission => {
                pm.expect(admission).to.have.property('status').that.equals('REFUNDED');
            });
        }
    });

    pm.test("Fulfillments are present and have status REFUNDED", function() {
        if (refundOffer.fulfillments) {
            refundOffer.fulfillments.forEach(fulfillment => {
                pm.expect(fulfillment).to.have.property('status').that.equals('REFUNDED');
                pm.expect(fulfillment.id).to.be.a('string').and.not.be.empty;

				// TODO DONE for fulfillment implementation
				var fulfillmentsId = pm.globals.get("fulfillments_id");
				pm.expect(fulfillment.id).to.eql(fulfillmentsId);
			});
		}
	});

    pm.test("Refundable amount after patch matches the refundable amount", function() {
        pm.expect(refundOffer).to.have.property('refundableAmount');
        pm.expect(refundOffer.refundableAmount).to.have.property('amount').that.is.a('number').and.not.below(0);

		var refundableAmountRefund = pm.globals.get("refund_refundAmount");
		// Check refundableAmount equal to refundableAmountRefund from GET /booking after refund
		pm.expect(refundOffer.refundableAmount.amount).to.equal(refundableAmountRefund);
    });	
}

var validatePatchRefundResponse = function(patchRefundResponse) {
    var refundOffer = patchRefundResponse.refundOffer;

    pm.test("Refund response contains refundOffer", function () {
        pm.expect(refundOffer).to.be.an('object').that.is.not.empty;
    });

	var validUntil = refundOffer.validUntil ? new Date(refundOffer.validUntil) : null;
    var fulfillments = refundOffer.fulfillments;
    var refundFee = refundOffer.refundFee;
    var refundableAmount = refundOffer.refundableAmount;
    var status = refundOffer.status;
	var appliedOverruleCode = refundOffer.appliedOverruleCode;
    var confirmedOn = refundOffer.confirmedOn;

    validationLogger("Checking refund offer with Id: " + refundOffer.id);
    validationLogger("Status: " + status);
	validationLogger("AppliedOverruleCode: " + appliedOverruleCode);


	if (validUntil) {
		// Check validUntil is at least 10 minutes from now
		var currentDate = new Date();
		pm.test("ValidUntil is at least 10 minutes from now", function () {
			var tenMinutesLater = new Date(currentDate.getTime() + 10 * 60000);
			pm.expect(validUntil.getTime()).to.be.a('number').and.to.be.above(tenMinutesLater.getTime());
		});
	} else {
		pm.test("ValidUntil is null", function () {
			pm.expect(validUntil).to.be.null;
		});
	}

	// Check fullfillments.id equal to fullfillments_id from global variables
	pm.test("Fulfillments Id match", function () {
		var fullfillmentsId = pm.globals.get("fullfillments_id");
		pm.expect(fulfillments.id).to.equal(fullfillmentsId);
	});

    // Check the refundFee amount
    pm.test("RefundFee amount is correct", function () {
        pm.expect(refundFee.amount).to.be.a('number').and.to.equal(0);
    });

	// Check the refundableAmount
    pm.test("Refundable amount after patch matches the refundable amount", function() {
        pm.expect(refundOffer).to.have.property('refundableAmount');
        pm.expect(refundOffer.refundableAmount).to.have.property('amount').that.is.a('number').and.not.below(0);

		// Check refundableAmount equal to refundableAmountRefund from GET /booking after refund
		var refundableAmountRefund = pm.globals.get("refund_refundAmount");
		pm.expect(refundableAmount.amount).to.equal(refundableAmountRefund);
    });	

    // Check that all fulfillments have status REFUNDED
    pm.test("All fulfillments have status REFUNDED", function () {
        pm.expect(fulfillments).to.be.an('array').that.is.not.empty;
        fulfillments.forEach(function (fulfillment) {
            pm.expect(fulfillment.status).to.equal("REFUNDED");
        });
    });

    // Check the refundOffer status
    pm.test("Refund offer status is CONFIRMED", function () {
        pm.expect(status).to.equal("CONFIRMED");
    });

	// Check the appliedOverruleCode
	pm.test("AppliedOverruleCode is returned", function () {
		var expectedOverruleCode = pm.globals.get("overruleCode");
		if (expectedOverruleCode === null || expectedOverruleCode === undefined) {
			pm.expect(appliedOverruleCode).to.be.null;
		} else {
			pm.expect(appliedOverruleCode).to.equal(expectedOverruleCode);
		}
	});

    // Check the confirmedOn timestamp is not null
    pm.test("Refund offer confirmedOn timestamp is not null", function () {
        pm.expect(confirmedOn).to.not.be.null;
    });
};
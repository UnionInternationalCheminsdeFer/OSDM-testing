var uuid = require('uuid');

setAuthToken = function () {
    let jsonData = JSON.parse(responseBody);
    
    pm.globals.set(GV.ACCESS_TOKEN, jsonData.access_token);
}

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


validateOfferResponse = function(tripSpecifications, passengerSpecifications, searchCriteria, fulfillmentOptions, offers, scenarioType) {
	
	pm.test("offers are returned", function () {
	    pm.expect(offers).not.to.be.empty;

        console.log("trip:"+pm.globals.get(OFFER.TRIP_SPECIFICATIONS));
        console.log(anonymousPassengerSpecifications);
        console.log(pm.globals.get(OFFER.FULFILLMENT_OPTIONS));
        console.log(searchCriteria);
        console.log(offers);
        console.log(anonymousPassengerSpecifications);
        console.log("type:"+pm.globals.get("SCENARIO_TYPE"));

        
	    var requireAdmission = false;
	    var requireAncillary = false;
	    var requireReservation = false;
	    
	    switch(scenarioType) {
	      case "BOTH":
	        requireAdmission = true;
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
	        
	        console.log("There are "+offerLength+" offers available");
	
	        while(found==false && offerIndex < offerLength) {
	            console.log("checking offer: "+offerIndex);
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
                         var passengerLenght = anonymousPassengerSpecifications.length;

                         admissionOfferPart.passengerRefs.forEach(function(passengerRef){
                            while(passengerIndex<passengerLenght){
                                
                                if(anonymousPassengerSpecifications[passengerIndex].externalRef==passengerRef){

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
                        var passengerLenght = anonymousPassengerSpecifications.length;
                        ancillaryOfferPart.passengerRefs.forEach(function(passengerRef){
                            while(passengerIndex<passengerLenght){
                                
                                if(anonymousPassengerSpecifications[passengerIndex].externalRef==passengerRef){
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
                        var passengerLenght = anonymousPassengerSpecifications.length;
                        reservationOfferPart.passengerRefs.forEach(function(passengerRef){
                            while(passengerIndex<passengerLenght){
                                
                                if(anonymousPassengerSpecifications[passengerIndex].externalRef==passengerRef){

                                    if(searchCriteria!=undefined&&searchCriteria.currency!=undefined) {
                                        
                                        pm.test("Correct currency is returned", function () {
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

                console.log("admissions:"+foundAdmissions);
	            console.log("ancillaries:"+foundAncillaries);
                console.log("reservations:"+foundReservations);
                

                var amounts = anonymousPassengerSpecifications.length;
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
	        console.log("No offers available");
	    }
	});

    var requiredTrip = JSON.parse(pm.globals.get(OFFER.TRIP_SPECIFICATIONS));

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
                        requiredLeg.timedLeg.service.carriers[0].ref==leg.timedLeg.service.carriers[0].ref) {
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
	
	pm.test("anonymousPassengerSpecifications are returned", function () {
	    let response = pm.response.json();
	    pm.expect(response.anonymousPassengerSpecifications).not.to.be.empty;
	});
};





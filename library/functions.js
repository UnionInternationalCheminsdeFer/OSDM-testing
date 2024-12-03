/*
Copyright UIC, Union Internationale des Chemins de fer
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

No reproduction nor distribution shall be allowed without the following notice
“This material is copyrighted by UIC, Union Internationale des Chemins de fer © 2023  – 2024 , OSDM is a trademark belonging to UIC, and any use of this trademark is strictly prohibited unless otherwise agreed by UIC.”
*/

var uuid = require('uuid');
var totalBookedAmount = 0;

setAuthToken = function () {
    let jsonData = JSON.parse(responseBody);
    
    pm.globals.set(GV.ACCESS_TOKEN, jsonData.access_token);
}

function buildOfferCollectionRequest() {
	var tripType = pm.globals.get("TripType");
	
	switch(tripType) {
    	case "SPECIFICATION":
    		pm.globals.set("OfferCollectionRequest", "{\"objectType\": \"OfferCollectionRequest\","
			+ "\"tripSpecifications\":"+pm.globals.get("offerTripSpecifications")+","
			+ "\"anonymousPassengerSpecifications\":"+pm.globals.get("offerPassengerSpecifications")+","
			+ "\"offerSearchCriteria\":"+pm.globals.get("offerSearchCriteria")+","
			+ "\"requestedFulfillmentOptions\":"+pm.globals.get("offerFulfillmentOptions")
			+ "}");
    		break;
	    case "SEARCH":
	    	pm.globals.set("OfferCollectionRequest", "{\"objectType\": \"OfferCollectionRequest\","
			+ "\"tripSearchCriteria\":"+pm.globals.get("offerTripSearchCriteria")+","
			+ "\"anonymousPassengerSpecifications\":"+pm.globals.get("offerPassengerSpecifications")+","
			+ "\"offerSearchCriteria\":"+pm.globals.get("offerSearchCriteria")+","
			+ "\"requestedFulfillmentOptions\":"+pm.globals.get("offerFulfillmentOptions")
			+ "}");
	    	break;
	}
}

function buildBookingRequest() {
	
	//first create all the required items
	var uuid = require('uuid');
	pm.globals.set("bookingExternalRef", uuid.v4());
	
	placeSelections();
	
	var detail = new Detail("Pur","Chaser","yourusername@example.com","0612345678");
	var purchaser = new Purchaser(detail);
	
	pm.globals.set("BookingRequest", "{"
			+ "\"offers\": [\n"
			+ "{\n"
			+ "            \"offerId\": \""+pm.globals.get("offerId")+"\",\n"
			+ "            "+pm.globals.get("placeSelections")+"\n"
			+ "            \"passengerRefs\": \n"
			+ "                "+pm.globals.get("bookingPassengerReferences")+"\n"
			+ "            \n"
			+ "        }\n"
			+ "    ],"
			+ "\"purchaser\": "+JSON.stringify(purchaser)+","
			+ "\"passengerSpecifications\":"+pm.globals.get("bookingPassengerSpecifications")+","
			+ "\"externalRef\":\""+pm.globals.get("bookingExternalRef")+"\""
			+ "}");
}

function placeSelections() {
	
	var requiresPlaceSelection = pm.globals.get("requiresPlaceSelection");
	
	if(requiresPlaceSelection==true) {
	
		pm.globals.set("placeSelections", "\"placeSelections\": [\n"
				+ "	                    {\n"
				+ "	                        \"reservationId\": \""+pm.globals.get("reservationId")+"\",\n"
				+ "	                        \"places\": [\n"
				+ "	                            {\n"
				+ "	                                \"coachNumber\": \""+pm.globals.get("preselectedCoach")+"\",\n"
				+ "	                                \"placeNumber\": \""+pm.globals.get("preselectedPlace")+"\",\n"
				+ "	                                \"passengerRef\": \""+pm.globals.get("passengerSpecification1ExternalRef")+"\"\n"
				+ "	                            }\n"
				+ "	                        ],\n"
				+ "	                        \"tripLegCoverage\" : {\n"
				+ "	                            \"tripId\": \""+pm.globals.get("tripId")+"\",\n"
				+ "	                            \"legId\" : \""+pm.globals.get("legId")+"\"\n"
				+ "	                        }\n"
				+ "	                    }\n"
				+ "	                ],");
		
	} else {
		pm.globals.set("placeSelections", "");
	}
	
}

getScenarioData = function(scenarioType, scenarioCode) {
	if(!pm.environment.has('data_file')) {
		pm.globals.set("LoggingType","FULL");
		
		validationLogger("data file was not set, expecting running in runner");
        pm.sendRequest({
            url: pm.environment.get("data_base"),
            method: 'GET',
        }, function (err, res) {
            if (err) {
                validationLogger(err);
            } else {
                var jsonData = JSON.parse(res.text());
                parseScenarioData(jsonData);

            }
        });
	}
	else if(pm.environment.has('data_file')) {
		//since running in postman, do full logging to the console
		pm.globals.set("LoggingType","FULL");
		
        validationLogger("data file was set, expecting running in postman");
        var res = pm.environment.get("data_file");
        var jsonData = JSON.parse(res);
        parseScenarioData(jsonData);
        
    } else {
    	pm.globals.set("LoggingType","FULL");
    	validationLogger("Please specify using a data_file or data_base parameter in the environment used.");
    }
}

parseScenarioData = function(jsonData) {
	var nextWeekday = get_next_weekday(new Date());
    var nextWeekdayString = "" + nextWeekday.getUTCFullYear() + "-" + pad(nextWeekday.getUTCMonth() + 1) + "-" + pad(nextWeekday.getUTCDate());

    var dataFileIndex = 0;
    var dataFileLength = jsonData.scenarios.length;
    var foundCorrectDataSet = false;

    while(foundCorrectDataSet==false && dataFileIndex<dataFileLength) {
        validationLogger("checking code:"+jsonData.scenarios[dataFileIndex].code+" against:"+scenarioCode);

        if(jsonData.scenarios[dataFileIndex].code==scenarioCode) {

            jsonData.tripRequirements.some(function(tripRequirement){

                validationLogger(tripRequirement);

                if(tripRequirement.id==jsonData.scenarios[dataFileIndex].tripRequirementId){
                    
                    pm.globals.set("TripType",tripRequirement.tripType);
                    
                    switch(tripRequirement.tripType) {
				      case "SPECIFICATION":
				      	validationLogger('processing a specification');
				        var legIndex = 0;
				        
				        var legDefinitions = [];
				        
                        tripRequirement.legs.forEach(function(leg){
                            pm.globals.set("leg"+(legIndex+1)+"StartStopPlaceRef", tripRequirement.legs[legIndex].origin);
                            pm.globals.set("leg"+(legIndex+1)+"EndStopPlaceRef", tripRequirement.legs[legIndex].destination);
                            pm.globals.set("leg"+(legIndex+1)+"StartDatetime", tripRequirement.legs[legIndex].start_datetime.replace("%TRIP_DATE%", nextWeekdayString));
                            pm.globals.set("leg"+(legIndex+1)+"EndDatetime", tripRequirement.legs[legIndex].end_datetime.replace("%TRIP_DATE%", nextWeekdayString));
                            pm.globals.set("leg"+(legIndex+1)+"VehicleNumber", tripRequirement.legs[legIndex].vehicleNumber);
                            pm.globals.set("leg"+(legIndex+1)+"OperatorCode", tripRequirement.legs[legIndex].operatorCode);
                            pm.globals.set("leg"+(legIndex+1)+"ProductCategoryRef", tripRequirement.legs[legIndex].productCategoryRef);
                            pm.globals.set("leg"+(legIndex+1)+"ProductCategoryName", tripRequirement.legs[legIndex].productCategoryName);
                            pm.globals.set("leg"+(legIndex+1)+"ProductCategoryShortName", tripRequirement.legs[legIndex].productCategoryShortName);
                        
                            legDefinitions.push(new TripLegDefinition(
                            	tripRequirement.legs[legIndex].origin,
                            	tripRequirement.legs[legIndex].start_datetime.replace("%TRIP_DATE%", nextWeekdayString),
                            	tripRequirement.legs[legIndex].destination,
                            	tripRequirement.legs[legIndex].end_datetime.replace("%TRIP_DATE%", nextWeekdayString),
                            	tripRequirement.legs[legIndex].productCategoryRef,
                            	tripRequirement.legs[legIndex].productCategoryName,
                            	tripRequirement.legs[legIndex].productCategoryShortName,
                            	tripRequirement.legs[legIndex].vehicleNumber,
                            	tripRequirement.legs[legIndex].operatorCode
					        ));
                            
                            legIndex++;
                        
                        });
                        
                        osdmTripSpecification(legDefinitions);
        
				        break;
				      case "SEARCH":
				      	validationLogger('processing a search');
				        pm.globals.set("tripStartStopPlaceRef", tripRequirement.trip.origin);
                        pm.globals.set("tripEndStopPlaceRef", tripRequirement.trip.destination);
                        pm.globals.set("tripStartDatetime", tripRequirement.trip.startDatetime.replace("%TRIP_DATE%", nextWeekdayString));
                        pm.globals.set("tripEndDatetime", tripRequirement.trip.endDatetime.replace("%TRIP_DATE%", nextWeekdayString));
                        pm.globals.set("tripVehicleNumber", tripRequirement.trip.vehicleNumber);
                        pm.globals.set("tripOperatorCode", tripRequirement.trip.operatorCode);
                        pm.globals.set("tripProductCategoryRef", tripRequirement.trip.productCategoryRef);
                        pm.globals.set("tripProductCategoryName", tripRequirement.trip.productCategoryName);
                        pm.globals.set("tripProductCategoryShortName", tripRequirement.trip.productCategoryShortName);
                        
                        
                        osdmTripSearchCriteria([
                            new TripLegDefinition(
                            	tripRequirement.trip.origin,
                            	tripRequirement.trip.startDatetime.replace("%TRIP_DATE%", nextWeekdayString),
                            	tripRequirement.trip.destination,
                            	tripRequirement.trip.endDatetime.replace("%TRIP_DATE%", nextWeekdayString),
                            	tripRequirement.trip.productCategoryRef,
                            	tripRequirement.trip.productCategoryName,
                        		tripRequirement.trip.productCategoryShortName,
            					tripRequirement.trip.vehicleNumber,
            					tripRequirement.trip.operatorCode
                            )
                        ]);
                        validationLogger('processed a search');
                        
				        break;
				      
				    }
                    
                    return true;
                }
            });

            pm.globals.set("offerSearchCriteriaCurrency", jsonData.scenarios[dataFileIndex].currency);
            pm.globals.set("offerSearchCriteriaTravelClass", jsonData.scenarios[dataFileIndex].travelClass);
            pm.globals.set("offerSearchCriteriaSearchClass", jsonData.scenarios[dataFileIndex].serviceClass);
            pm.globals.set("refundOverruleCode", jsonData.scenarios[dataFileIndex].overruleCode);
            pm.globals.set("flexibility", jsonData.scenarios[dataFileIndex].flexibility);
            
            pm.globals.set("ScenarioType",scenarioType);
            pm.globals.set("ScenarioCode",scenarioCode);
            
            pm.globals.set("requiresPlaceSelection",jsonData.scenarios[dataFileIndex].requiresPlaceSelection);
            

			jsonData.passengersList.some(function(passengersList){
			
				validationLogger('checking passenger_list:'+passengersList.id+' against:'+jsonData.scenarios[dataFileIndex].passengersListId);
			
				if(passengersList.id==jsonData.scenarios[dataFileIndex].passengersListId){
				
					validationLogger('found number of passengers:'+passengersList.passengers.length);
				
					pm.globals.set(OFFER.PASSENGER_NUMBER, passengersList.passengers.length);
		
				    var offerPassengerSpecs = [];
				    var passengerSpecs = [];
				    var passengerReferences = [];
					var passengerIndex = 0;
					
				    passengersList.passengers.forEach(function(passenger){
				    	var passengerKey = OFFER.PASSENGER_SPECIFICATION_EXTERNAL_REF_PATTERN.replace("%PASSENGER_COUNT%", (passengerIndex+1));
				    	pm.globals.set(passengerKey, uuid.v4());
				    	
				    	offerPassengerSpecs.push(new AnonymousPassengerSpec(
				            pm.globals.get(passengerKey),
				            passenger.type,
				            passenger.dateOfBirth
				        ));
				    	
				    	passengerSpecs.push(new PassengerSpec(
					            pm.globals.get(passengerKey),
					            passenger.type,
					            passenger.dateOfBirth
					        ));
				    	
				    	
				    	passengerReferences.push(pm.globals.get(passengerKey));
				    	
				    	passengerIndex++;
				    });
				    
				    validationLogger('pushed passengerspec to globals:'+JSON.stringify(passengerSpecs));
				
				    pm.globals.set(OFFER.PASSENGER_SPECIFICATIONS, JSON.stringify(offerPassengerSpecs));
				    pm.globals.set(BOOKING.PASSENGER_SPECIFICATIONS, JSON.stringify(passengerSpecs));
				    pm.globals.set(BOOKING.PASSENGER_REFERENCES, JSON.stringify(passengerReferences));
					return true;
				}
			});
			
			
			osdmOfferSearchCriteria(
					jsonData.scenarios[dataFileIndex].currency,
				    null,
				    jsonData.scenarios[dataFileIndex].type,
				    null,
				    jsonData.scenarios[dataFileIndex].serviceClass,
				    jsonData.scenarios[dataFileIndex].travelClass,
				    null
				);
			

				osdmFulfillmentOptions([
				    new FulfillmentOption(jsonData.scenarios[dataFileIndex].fulfillmentType, jsonData.scenarios[dataFileIndex].fulfillmentMedia)
				]);

            foundCorrectDataSet = true;
            validationLogger("correct data set was found for this scenario:"+scenarioCode);
        }
        dataFileIndex++;
    }
}

osdmTripSearchCriteria = function (legDefinitions) {
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
        validationLogger("type:"+pm.globals.get("ScenarioType"));

        
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

	let desiredFlexibility = pm.globals.get("flexibility"); 
	console.log("Flexibility for current leg:" + desiredFlexibility);

	let selectedOffer = offers.find(offer => 
		offer.offerSummary.overallFlexibility === desiredFlexibility
	);

	pm.globals.set("offers", offers);
	if (selectedOffer) {
		console.log("######");
		console.log("Desired flexibility : ", desiredFlexibility);
		console.log("Selected offer : ", selectedOffer);
		console.log("offers[0] : ", offers[0]);
		console.log("######");
		pm.globals.set("offerId", selectedOffer.offerId);
		pm.globals.set("offer", selectedOffer);
	} else {
		pm.globals.set("offerId", offers[0].offerId);
		pm.globals.set("offer", offers[0]);
		// TODO : Catch it differently (default one ?)
		// STOP THE TEST ?? TO CONFIRM 
		console.log("Offer doesn't match the entry criteria, displaying warning.");
		console.log("Warnings :", jsonData.warnings);
		// Taking the 1st as default 
	}

	var requiresPlaceSelection = pm.globals.get("requiresPlaceSelection");
	
	if(requiresPlaceSelection==true) {
		var reservationOfferPart = offer.reservationOfferParts[0];
		pm.globals.set("reservationId", reservationOfferPart.id);
	}
	
};

displayOfferResponse = function(response) {
	try {
		if (!response || !response.offers || response.offers.length === 0) {
			validationLogger("Error: No offers found in the response.");
			return;
		}

		// Variable pour vérifier si un train est lié et si des réservations sont incluses
		let includedReservations = null;
		let isTrainBound = false;

		// Parcourir chaque offre
		response.offers.forEach((offer, index) => {
			validationLogger(`Offer ${index + 1} Details:`);
			validationLogger(`  Minimal Price amount: ${offer.offerSummary?.minimalPrice?.amount || 'Not available'}`);
			validationLogger(`  Overall Flexibility: ${offer.offerSummary?.overallFlexibility || 'Not available'}`);
			validationLogger(`  Overall ServiceClass: ${offer.offerSummary?.overallServiceClass?.name || 'Not available'}`);
			validationLogger(`  Overall TravelClass: ${offer.offerSummary?.overallTravelClass || 'Not available'}`);
			validationLogger(`  Overall AccommodationType: ${offer.offerSummary?.overallAccommodationType || 'Not available'}`);
			validationLogger(`  Overall AccommodationSubType: ${offer.offerSummary?.overallAccommodationSubType || 'Not available'}`);

			// Parcourir chaque admissionOfferPart
			(offer.admissionOfferParts || []).forEach((admissionPart, partIndex) => {
				validationLogger(`  Admission Offer Part ${partIndex + 1}:`);
				validationLogger(`      Summary: ${admissionPart?.summary || 'Not available'}`);
				validationLogger(`      Price: ${
					admissionPart?.price?.amount 
						? `${admissionPart.price.amount} ${admissionPart.price.currency || 'Unknown currency'}` 
						: 'Not available'
				}`);

				// Vérifier et enregistrer les includedReservations
				if (admissionPart?.includedReservations?.length > 0) {
					includedReservations = admissionPart.includedReservations;
					admissionPart.includedReservations.forEach((reservation, reservationIndex) => {
						validationLogger(`    Included Reservation ${reservationIndex + 1}:`);
						validationLogger(`      ID: ${reservation?.id || 'Not available'}`);
						validationLogger(`      Summary: ${reservation?.summary || 'Not available'}`);
						validationLogger(`      Created On: ${reservation?.createdOn || 'Not available'}`);
						validationLogger(`      Valid From: ${reservation?.validFrom || 'Not available'}`);
						validationLogger(`      Valid Until: ${reservation?.validUntil || 'Not available'}`);
						validationLogger(`      Price: ${
							reservation?.price?.amount 
								? `${reservation.price.amount} ${reservation.price.currency || 'Unknown currency'}` 
								: 'Not available'
						}`);
					});
				} else {
					validationLogger(`  No included reservations.`);
				}
			});

			// Parcourir chaque produit dans l'offre
			(offer.products || []).forEach((product, productIndex) => {
				isTrainBound = product?.isTrainBound || false;
				validationLogger(`  Product ${productIndex + 1}:`);
				validationLogger(`      Product Summary: ${product?.summary || 'Not available'}`);
				validationLogger(`      Product Type: ${product?.type || 'Not available'}`);
				validationLogger(`      Train is bound: ${isTrainBound}`);
			});

			// Identifier NRT, TLT ou IRT
			if (!isTrainBound && !includedReservations) {
				validationLogger(`      NRT: Train is not bound, and no included reservations.`);
			} else if (isTrainBound && !includedReservations) {
				validationLogger(`      TLT: Train is bound, but no included reservations.`);
			} else if (isTrainBound && Array.isArray(includedReservations)) {
				validationLogger(`      IRT: Train is bound, and included reservations present.`);
			}

			// Informations sur les passagers
			validationLogger(`  Number of passengers: ${response.anonymousPassengerSpecifications?.length || 0}`);
			validationLogger(`      Type: ${
				response.anonymousPassengerSpecifications?.map(spec => spec?.type || 'Unknown').join(', ') || 'None'
			}`);
			validationLogger(`      Cards: ${
				response.anonymousPassengerSpecifications?.map(
					spec => spec?.cards ? spec.cards.join(', ') : 'None'
				).join(', ') || 'None'
			}`);

			// Parcourir chaque voyage
			(response.trips || []).forEach((trip, tripIndex) => {
				validationLogger(`  Trip ${tripIndex + 1} Summary: ${trip?.summary || 'Not available'}`);
				validationLogger(`  Number of trip legs: ${trip?.legs?.length || 0}`);
				validationLogger(`  Start Time: ${trip?.startTime || 'Not available'}`);
				validationLogger(`  End Time: ${trip?.endTime || 'Not available'}`);

				// Parcourir chaque étape (leg) du voyage
				(trip?.legs || []).forEach((leg, legIndex) => {
					validationLogger(`    Leg ${legIndex + 1} Details:`);
					validationLogger(`        Start Stop Place Name: ${leg?.timedLeg?.start?.stopPlaceName || 'Not available'}`);
					validationLogger(`        End Stop Place Name: ${leg?.timedLeg?.end?.stopPlaceName || 'Not available'}`);
					validationLogger(`        Vehicle Numbers: ${
						leg?.timedLeg?.service?.vehicleNumbers 
							? leg.timedLeg.service.vehicleNumbers.join(', ') 
							: 'None'
					}`);
					validationLogger(`        Line Numbers: ${
						leg?.timedLeg?.service?.lineNumbers 
							? leg.timedLeg.service.lineNumbers.join(', ') 
							: 'None'
					}`);
				});
			});
		});
	} catch (error) {
		validationLogger(`Error processing the offer response: ${error.message}`);
	}
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

displayBookingResponse = function(response) {
	// Log booking information
	validationLogger(`Booking ID: ${response.booking.id}`);
	validationLogger(`Booking Code: ${response.booking.bookingCode}`);
	validationLogger(`External Reference: ${response.booking.externalRef}`);
	validationLogger(`Created On: ${response.booking.createdOn}`);
	validationLogger(`Provisional Price: ${response.booking.provisionalPrice.amount} ${response.booking.provisionalPrice.currency}`);
	validationLogger(`Number of Passengers: ${response.booking.passengers.length}`);

	// Log passenger information
	response.booking.passengers.forEach((passenger, passengerIndex) => {
		validationLogger(`Passenger ${passengerIndex + 1} Details:`);
		validationLogger(`  Passenger ID: ${passenger.id}`);
		validationLogger(`  Type: ${passenger.type}`);
		validationLogger(`  Date of Birth: ${passenger.dateOfBirth}`);
		validationLogger(`  Cards: ${passenger.cards ? passenger.cards.join(', ') : 'None'}`);
	});

	// Log trip information
	response.booking.trips.forEach((trip, tripIndex) => {
		validationLogger(`Trip ${tripIndex + 1} Summary: ${trip.summary}`);
		validationLogger(`  Trip ID: ${trip.id}`);
		validationLogger(`  Direction: ${trip.direction}`);
		validationLogger(`  Start Time: ${trip.startTime}`);
		validationLogger(`  End Time: ${trip.endTime}`);
		validationLogger(`  Duration: ${trip.duration}`);
		validationLogger(`  Distance: ${trip.distance} meters`);

		// Log leg information for each trip
		trip.legs.forEach((leg, legIndex) => {
			validationLogger(`    Leg ${legIndex + 1} Details:`);
			validationLogger(`      Leg ID: ${leg.id}`);
			validationLogger(`      Start Stop Place Name: ${leg.timedLeg.start.stopPlaceName}`);
			validationLogger(`      End Stop Place Name: ${leg.timedLeg.end.stopPlaceName}`);
			validationLogger(`      Start Time: ${leg.timedLeg.start.serviceDeparture.timetabledTime}`);
			validationLogger(`      End Time: ${leg.timedLeg.end.serviceArrival.timetabledTime}`);

			// Log vehicle numbers and line numbers
			validationLogger(`      Vehicle Numbers: ${leg.timedLeg.service.vehicleNumbers ? leg.timedLeg.service.vehicleNumbers.join(', ') : 'None'}`);
			validationLogger(`      Line Numbers: ${leg.timedLeg.service.lineNumbers ? leg.timedLeg.service.lineNumbers.join(', ') : 'None'}`);
		});
	});

	// Log booked offers
	response.booking.bookedOffers.forEach((offer, offerIndex) => {
		validationLogger(`Offer ${offerIndex + 1} Details:`);
		validationLogger(`  Offer ID: ${offer.offerId}`);
		validationLogger(`  Reservations: ${offer.reservations.length} reservation(s)`);
		
		offer.reservations.forEach((reservation, reservationIndex) => {
			validationLogger(`    Reservation ${reservationIndex + 1} Details:`);
			validationLogger(`      Object Type: ${reservation.objectType}`);
			validationLogger(`      Status: ${reservation.status}`);
			validationLogger(`      Valid From: ${reservation.validFrom}`);
			validationLogger(`      Valid Until: ${reservation.validUntil}`);
			validationLogger(`      Price: ${reservation.price.amount} ${reservation.price.currency}`);
			validationLogger(`      Refundable: ${reservation.refundable}`);
			validationLogger(`      Exchangeable: ${reservation.exchangeable}`);
		});
	});
}

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
	if(pm.globals.get("LoggingType")=="FULL") {
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

	totalBookedAmount += offerPart.price.amount;
	//confirmedPrice

/*	TODO : CHECK PRICE TO BE ENABLED WHEN PRICING IS FIXED
	var offerPrice = offer.offerSummary.minimalPrice;
	var bookingPrice = booking.confirmedPrice;
	
	pm.test("Correct price is used on booking, compared to offer", function () {
		pm.expect(offerPrice.amount).to.equal(bookingPrice.amount);
		pm.expect(offerPrice.currency).to.equal(bookingPrice.currency);
	});
*/

    //check the confirmableUntil when this is a prebooked offer part
    if(state=="PREBOOKED"){
	    pm.test("a correct confirmableUntil is returned on bookedofferpart", function () {
	    	var current = currentDate.getTime();
	    	var confirmation = confirmableUntil.getTime();
	        pm.expect(confirmation).to.be.above(current);
	    });
    }

    //check the status
    pm.test("Correct status is returned on bookedofferpart : " + state, function () {
        pm.expect(offerPart.status).to.equal(state);
    });
    
};

checkFulFilledBooking = function(booking, offer, bookingState, fulfillmentState=undefined){

	validationLogger("offer:"+offer);
	var passengers = booking.passengers;

	booking.bookedOffers.forEach(function(bookedOffer){
		validationLogger("checking bookedOffer "+bookedOffer.offerId);
		//check the admissions
		if(bookedOffer.admissions!=undefined&&bookedOffer.admissions!=null&&bookedOffer.admissions.length>0){
			bookedOffer.admissions.forEach(function(bookedOfferPart){
				checkGenericBookedOfferPart(bookedOfferPart,bookingState);
			});
		}

		//check the reservations
		if(bookedOffer.reservations!=undefined&&bookedOffer.reservations!=null&&bookedOffer.reservations.length>0){
			bookedOffer.reservations.forEach(function(bookedOfferPart){
				checkGenericBookedOfferPart(bookedOfferPart,bookingState);
			});
		}

		//fulfillments
		if(fulfillmentState!=undefined) {
			booking.fulfillments.forEach(function(fulfillment) {
				checkFulfillment(booking, fulfillment, fulfillmentState);
			});
		}
		
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

	//new sets
	if(pm.globals.get("fulfillmentsId")!==undefined) {
		pm.test("Verify fulfillment ID", function () {
			var fulfillmentsId = pm.globals.get("fulfillmentsId");
			pm.expect(booking.fulfillments[0].id).to.eql(fulfillmentsId);
		});
	}
/*
	pm.globals.set("bookingConfirmedPrice", booking.confirmedPrice.amount);
	var bookingConfirmedPrice = pm.globals.get("bookingConfirmedPrice");
	pm.test("Check totalBookedAmount=" + totalBookedAmount + " with bookingConfirmedPrice=" + bookingConfirmedPrice, function () {
		pm.expect(totalBookedAmount).to.eql(bookingConfirmedPrice);
	});*/
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
    
    
	pm.test("Correct state is returned on fulfillment : " + state, function () {
		pm.expect(fulfillment.status).to.equal(state);
	});
};

displayFulFilledBooking = function (response) {
	try {
		if (!response?.booking) {
			validationLogger("Error: Booking information is missing from the response.");
			return;
		}

		// Log booking information
		validationLogger(`Booking ID: ${response.booking?.id ?? 'Not available'}`);
		validationLogger(`Booking Code: ${response.booking?.bookingCode ?? 'Not available'}`);
		validationLogger(`External Reference: ${response.booking?.externalRef ?? 'Not available'}`);
		validationLogger(`Created On: ${response.booking?.createdOn ?? 'Not available'}`);
		validationLogger(`Provisional Price: ${
			response.booking?.provisionalPrice
				? response.booking.provisionalPrice.amount + ' ' + response.booking.provisionalPrice.currency
				: 'Not available'
		}`);
		validationLogger(`Confirmed Price: ${
			response.booking?.confirmedPrice
				? response.booking.confirmedPrice.amount + ' ' + response.booking.confirmedPrice.currency
				: 'Not available'
		}`);
		validationLogger(`Number of Passengers: ${response.booking?.passengers?.length ?? 'Not available'}`);

		// Log passenger information
		response.booking?.passengers?.forEach((passenger, passengerIndex) => {
			validationLogger(`Passenger ${passengerIndex + 1} Details:`);
			validationLogger(`  Passenger ID: ${passenger?.id ?? 'Not available'}`);
			validationLogger(`  Type: ${passenger?.type ?? 'Not available'}`);
			validationLogger(`  Date of Birth: ${passenger?.dateOfBirth ?? 'Not available'}`);
			validationLogger(`  Cards: ${passenger?.cards?.join(', ') ?? 'None'}`);
		});

		// Log trip information
		response.booking?.trips?.forEach((trip, tripIndex) => {
			validationLogger(`Trip ${tripIndex + 1} Summary: ${trip?.summary ?? 'Not available'}`);
			validationLogger(`  Trip ID: ${trip?.id ?? 'Not available'}`);
			validationLogger(`  Direction: ${trip?.direction ?? 'Not available'}`);
			validationLogger(`  Start Time: ${trip?.startTime ?? 'Not available'}`);
			validationLogger(`  End Time: ${trip?.endTime ?? 'Not available'}`);
			validationLogger(`  Duration: ${trip?.duration ?? 'Not available'}`);
			validationLogger(`  Distance: ${trip?.distance ?? 'Not available'} meters`);

			trip?.legs?.forEach((leg, legIndex) => {
				validationLogger(`    Leg ${legIndex + 1} Details:`);
				validationLogger(`      Leg ID: ${leg?.id ?? 'Not available'}`);
				validationLogger(`      Start Stop Place Name: ${leg?.timedLeg?.start?.stopPlaceName ?? 'Not available'}`);
				validationLogger(`      End Stop Place Name: ${leg?.timedLeg?.end?.stopPlaceName ?? 'Not available'}`);
				validationLogger(`      Start Time: ${leg?.timedLeg?.start?.serviceDeparture?.timetabledTime ?? 'Not available'}`);
				validationLogger(`      End Time: ${leg?.timedLeg?.end?.serviceArrival?.timetabledTime ?? 'Not available'}`);
				validationLogger(`      Vehicle Numbers: ${
					leg?.timedLeg?.service?.vehicleNumbers?.join(', ') ?? 'None'
				}`);
				validationLogger(`      Line Numbers: ${
					leg?.timedLeg?.service?.lineNumbers?.join(', ') ?? 'None'
				}`);
			});
		});

		// Log booked offers
		response.booking?.bookedOffers?.forEach((offer, offerIndex) => {
			validationLogger(`Offer ${offerIndex + 1} Details:`);
			validationLogger(`  Offer ID: ${offer?.offerId ?? 'Not available'}`);
			validationLogger(`  Reservations: ${offer?.reservations?.length ?? 0} reservation(s)`);

			offer?.reservations?.forEach((reservation, reservationIndex) => {
				validationLogger(`    Reservation ${reservationIndex + 1} Details:`);
				validationLogger(`      Object Type: ${reservation?.objectType ?? 'Not available'}`);
				validationLogger(`      Status: ${reservation?.status ?? 'Not available'}`);
				validationLogger(`      Valid From: ${reservation?.validFrom ?? 'Not available'}`);
				validationLogger(`      Valid Until: ${reservation?.validUntil ?? 'Not available'}`);
				validationLogger(`      Price: ${
					reservation?.price
						? reservation.price.amount + ' ' + reservation.price.currency
						: 'Not available'
				}`);
				validationLogger(`      Refundable: ${
					reservation?.refundable !== undefined ? reservation.refundable : 'Not available'
				}`);
				validationLogger(`      Exchangeable: ${
					reservation?.exchangeable !== undefined ? reservation.exchangeable : 'Not available'
				}`);
			});
		});

		// Log fulfillments information
		if (response.booking?.fulfillments?.length > 0) {
			validationLogger(`Number of Fulfillments: ${response.booking.fulfillments.length}`);
			response.booking.fulfillments.forEach((fulfillment, fulfillmentIndex) => {
				validationLogger(`Fulfillment ${fulfillmentIndex + 1} Details:`);
				validationLogger(`  Fulfillment ID: ${fulfillment?.id ?? 'Not available'}`);
				validationLogger(`  Status: ${fulfillment?.status ?? 'Not available'}`);
				validationLogger(`  Booking Reference: ${fulfillment?.bookingRef ?? 'Not available'}`);
				validationLogger(`  Created On: ${fulfillment?.createdOn ?? 'Not available'}`);
				validationLogger(`  Control Number: ${fulfillment?.controlNumber ?? 'Not available'}`);

				fulfillment?.bookingParts?.forEach((part, partIndex) => {
					validationLogger(`    Booking Part ${partIndex + 1} Details:`);
					validationLogger(`      Part ID: ${part?.id ?? 'Not available'}`);
					validationLogger(`      Summary: ${part?.summary ?? 'Not available'}`);
				});

				validationLogger(`  Fulfillment Documents: ${
					fulfillment?.fulfillmentDocuments?.length ?? 'None'
				}`);
			});
		} else {
			validationLogger(`No fulfillments found.`);
		}
	} catch (error) {
		validationLogger(`Error processing the booking data: ${error.message}`);
	}
};

function logRefundDetails(refundOffer) {
    validationLogger("Checking refund offer with Id: " + refundOffer.id);
    validationLogger("ValidUntil: " + new Date(pm.variables.get("validUntilRefundOffers")));
    validationLogger("Status: " + refundOffer.status);
    validationLogger("AppliedOverruleCode: " + refundOffer.appliedOverruleCode);
}

function validateFulfillments(fulfillments, expectedStatus) {
	
	var fulfillmentStatus = "FULFILLED";
	if(expectedStatus=="CONFIRMED") {
		fulfillmentStatus = "REFUNDED";
	}
	
    pm.test("Fulfillments are present and valid", function () {
        pm.expect(fulfillments).to.be.an('array').that.is.not.empty;
        fulfillments.forEach(function (fulfillment) {
        	
            pm.expect(fulfillment.id).to.be.a('string').and.not.be.empty;
            pm.expect(fulfillment).to.have.property('status').that.equals(fulfillmentStatus);

            const fulfillmentsId = pm.globals.get("fulfillmentsId");
            pm.expect(fulfillment.id).to.eql(fulfillmentsId);
        });
    });
}

function validateRefundFee(refundFee) {
//Why? if a fee is configured this amount will not be zero. if present it should be a number.
//    pm.test("Refund fee equals to 0", function () {
//        pm.expect(refundFee).to.have.property('amount').that.equals(0);
//    });
}

function validateRefundableAmount(refundOffer, overruleCode, bookingConfirmedPrice) {
	console.log("bookingConfirmedPrice:"+bookingConfirmedPrice);
    pm.test("Refundable amount is valid", function () {
        if (overruleCode === "CODE_DOES_NOT_EXIST") {
            pm.expect(refundOffer.appliedOverruleCode).to.equal(overruleCode);
            pm.expect(refundOffer.refundableAmount.amount).to.be.null;
        } else {
            pm.expect(refundOffer.refundableAmount.amount).to.be.a('number').and.to.be.at.least(0);
            
            console.log("refundOffer.refundableAmount.amount:"+refundOffer.refundableAmount.amount);
            console.log("=");
            console.log("bookingConfirmedPrice:"+bookingConfirmedPrice);
            console.log("-");
            console.log("refundOffer.refundFee.amount:"+refundOffer.refundFee.amount);

            pm.expect(refundOffer.refundableAmount.amount).to.equal(bookingConfirmedPrice - refundOffer.refundFee.amount);
        }
    });
}

function validateAppliedOverruleCode(appliedOverruleCode) {
    const expectedOverruleCode = pm.globals.get("overruleCode");
    
    console.log("validateAppliedOverruleCode:"+expectedOverruleCode);
    console.log("appliedOverruleCode:"+appliedOverruleCode);
    
    pm.test("AppliedOverruleCode is valid", function () {
        if (!expectedOverruleCode || expextedOverruleCode == undefined) {
            pm.expect(appliedOverruleCode).to.be.undefined;
        } else {
            pm.expect(appliedOverruleCode).to.equal(expectedOverruleCode);
        }
    });
}

function validateRefundOffer(refundOffer, expectedStatus) {
	
	logRefundDetails(refundOffer);
	
	//refundOffer is linked to a bookedOfferpart, being admision or reservation
	//for now, default to the first one found in the refundOffer
	pm.globals.set("refundOfferPartReference", refundOffer.fulfillments[0].bookingParts[0].id);

    pm.test("Refund offer has a valid ID", function () {
        pm.expect(refundOffer.id).to.exist;
        pm.globals.set("refundId", refundOffer.id);
    });

    pm.test("Correct status is returned on refund : " + expectedStatus, function () {
       pm.expect(refundOffer.status).to.equal(expectedStatus);
    });

    if (expectedStatus=="PROPOSED") {
        pm.test("ValidUntil is set for refundOffer", function () {
            pm.expect(refundOffer.validUntil).to.exist;
            pm.globals.set("validUntilRefundOffers", refundOffer.validUntil);
        });
    }

    validateFulfillments(refundOffer.fulfillments, expectedStatus);
	// TODO : Check if the refundFee is correct
    validateRefundFee(refundOffer.refundFee);

    if (expectedStatus=="CONFIRMED") {
        const refundableAmountRefund = pm.globals.get("refundRefundAmount");
        pm.test("Refundable amount after patch is valid", function () {
            pm.expect(refundOffer.refundableAmount.amount).to.equal(refundableAmountRefund.amount - refundOffer.refundFee.amount);
        });
    } else {
        const overruleCode = pm.globals.get("overruleCode");
        const bookingConfirmedPrice = pm.globals.get("bookingConfirmedPrice");
        validateRefundableAmount(refundOffer, overruleCode, bookingConfirmedPrice);
    }

    validateAppliedOverruleCode(refundOffer.appliedOverruleCode);
}

function checkWarningsAndProblems(response) {
    try {
        // Check and log warnings
        if (response.warnings) {
            validationLogger(`Warning: ${response.warnings}`);
        } else {
            validationLogger("No warnings found.");
        }

        // Check and log problems
        if (response.problems && response.problems.length > 0) {
            validationLogger(`Problems found (${response.problems.length}):`);
            response.problems.forEach((problem, index) => {
                validationLogger(`  Problem ${index + 1}:`);
                validationLogger(`    Code: ${problem.code || 'Not available'}`);
                validationLogger(`    Type: ${problem.type || 'Not available'}`);
                validationLogger(`    Title: ${problem.title || 'Not available'}`);
                validationLogger(`    Status: ${problem.status || 'Not available'}`);
                validationLogger(`    Detail: ${problem.detail || 'Not available'}`);

                if (problem.pointers && problem.pointers.length > 0) {
                    problem.pointers.forEach((pointer, pointerIndex) => {
                        validationLogger(`    Pointer ${pointerIndex + 1}:`);
                        validationLogger(`      Code: ${pointer.code || 'Not available'}`);
                        validationLogger(`      Request Pointer: ${pointer.requestPointer || 'Not available'}`);
                    });
                } else {
                    validationLogger("    No pointers found.");
                }
            });
        } else {
            validationLogger("No problems found.");
        }
    } catch (error) {
        validationLogger(`Error processing the response: ${error.message}`);
    }
}


function validateRefundOffersResponse(response, isPatchResponse = false) {
	checkWarningsAndProblems(response);
    const refundOffers = isPatchResponse ? [response.refundOffer] : response.refundOffers;    
    pm.test("Status code is 200", function () {
        pm.response.to.have.status(200);
    });

    pm.test(isPatchResponse ? "Patch refund response contains refundOffer" : "Refund response contains refundOffers", function () {
        pm.expect(refundOffers).to.be.an('array').that.is.not.empty;
    });
    
    const expectedStatus = isPatchResponse ? 'CONFIRMED' : 'PROPOSED';

    refundOffers.forEach(function (refundOffer) {
    	validateRefundOffer(refundOffer, expectedStatus);
    });
}

function validateBookingResponseRefund(response, refundType) {
    const booking = response.booking;

	if (refundType == "post" || refundType == "patch" || refundType == "delete") {
		//pm.globals.set("refundRefundAmount", jsonData.booking.bookedOffers[0].reservations[0].refundAmount);
		
		let refundOfferPartReference = pm.globals.get("refundOfferPartReference");

		console.log("refundOfferPartReference"+refundOfferPartReference);
		
		//check if referenced part is an admission
		let refundOfferPart;
		
		if(booking.bookedOffers[0].admissions!=null&&booking.bookedOffers[0].admissions!=undefined) {
			refundOfferPart = booking.bookedOffers[0].admissions.find(admission => 
			    admission.id === refundOfferPartReference
		    );
		} 
		
		//check if the referenced part is a reservation 
		if((refundOfferPart==null||refundOfferPart==undefined)&&
				(booking.bookedOffers[0].reservations!=null&&booking.bookedOffers[0].reservations!=undefined)) {
			refundOfferPart = booking.bookedOffers[0].reservations.find(reservation => 
			    reservation.id === refundOfferPartReference
		    );
		}
		
		// Check why no refundAmount is returned
		pm.globals.set("refundRefundAmount", refundOfferPart.refundAmount);
	}

    pm.test("Booking is present and Booking ID is valid", function () {
        pm.expect(response).to.have.property('booking');
        pm.expect(booking).to.have.property('id').that.is.a('string').and.not.empty;
    });

	if (refundType == "post" || refundType == "patch") {
		pm.test("Refund offers are valid", function () {
			pm.expect(booking).to.have.property('refundOffers').that.is.an('array').with.length.above(0);
			const refundOffer = booking.refundOffers[0];

			pm.expect(refundOffer).to.have.property('id').that.is.a('string').and.not.empty;
			
			//This does not exist
			//pm.expect(refundOffer.admissions).to.satisfy(admissions => admissions.every(a => a.status === (afterRefund ? 'REFUNDED' : 'PENDING')));
			if (refundType == "post") {
				var expectedStatus = 'PROPOSED';
			} else if (refundType == "patch") {
				var expectedStatus = 'CONFIRMED';
			}
			validateFulfillments(refundOffer.fulfillments, expectedStatus);
			// TODO : Check if the refundFee is correct
			validateRefundFee(refundOffer.refundFee);

			const overruleCode = pm.globals.get("overruleCode");
			const bookingConfirmedPrice = pm.globals.get("bookingConfirmedPrice");
			validateRefundableAmount(refundOffer, overruleCode, bookingConfirmedPrice);
		});
	} else if (refundType == "delete") {
		pm.test("Refund offers are not present", function () {
			pm.expect(booking).to.not.have.property('refundOffers') || pm.expect(booking.refundOffers.length).to.equal(0);
		});
	}

	//TODO Valid Until to check 
    pm.test("ValidUntil is at least 10 minutes from now", function () {
        const validUntilRefundOffers = new Date(pm.variables.get("validUntilRefundOffers"));
        const validUntil = new Date(booking.refundOffers[0].validUntil);
        const validUntilPlus10Min = new Date(validUntilRefundOffers.getTime() + 10 * 60000);
        pm.expect(validUntil).to.be.below(validUntilPlus10Min);
    });
}

function capturePassengerData(response) {
	/*
	const firstName = response.passenger?.detail?.firstName || null;
	const lastName = response.passenger?.detail?.lastName || null;
	const dateOfBirth = response.passenger?.dateOfBirth || null;
	const phoneNumber = response.passenger?.detail?.contact?.phoneNumber || null;
	const email = response.passenger?.detail?.contact?.email || null;
	
	const newDateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
	if (newDateOfBirth) {
		newDateOfBirth.setDate(newDateOfBirth.getDate() + 1);
	}
	const newPhoneNumber = phoneNumber
		? phoneNumber.slice(0, -1) + ((parseInt(phoneNumber.slice(-1)) + 1) % 10) // Dernier chiffre +1
		: null;
	*/

	const firstName = "firstName";
	const lastName = "lastName";
	const dateOfBirth = response.passenger?.dateOfBirth || null;
	const phoneNumber = "0612345678";
	const email = "email@email.com";
	const newFirstName = firstName ? `new_${firstName}` : null;
	const newLastName = lastName ? `new_${lastName}` : null;
	const newEmail = email ? `new_${email}` : null;

	const newDateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
	if (newDateOfBirth) {
		newDateOfBirth.setDate(newDateOfBirth.getDate() + 1);
	}
	const newPhoneNumber = phoneNumber.slice(0, -1) + "9";

	pm.globals.set("newFirstName", newFirstName);
	pm.globals.set("newLastName", newLastName);
	pm.globals.set("newDateOfBirth", newDateOfBirth ? newDateOfBirth.toISOString().split("T")[0] : null);
	pm.globals.set("newPhoneNumber", newPhoneNumber);
	pm.globals.set("newEmail", newEmail);
}

function validatePassengerData (response, isPatchResponse = false) {
	const firstName = response.passenger?.detail?.firstName || null;
	const lastName = response.passenger?.detail?.lastName || null;
	const dateOfBirth = response.passenger?.dateOfBirth || null;
	//const phoneNumber = "0612345679";
	//const email = "new_email@email.com";

	pm.test("Passenger data is valid", function () {
		pm.expect(firstName).to.equal(pm.globals.get("newFirstName"));
		pm.expect(lastName).to.equal(pm.globals.get("newLastName"));
		pm.expect(dateOfBirth).to.equal(pm.globals.get("newDateOfBirth"));
		//pm.expect(phoneNumber).to.equal(pm.globals.get("newPhoneNumber"));
		//pm.expect(email).to.equal(pm.globals.get("newEmail"));
	});
}


function requestRefundOffersBody(fulfillmentsId, overruleCode, refundDate) {
	var fulfillmentId = pm.globals.get('fulfillmentsId');
	var overruleCode = pm.globals.get('refundOverruleCode') || null;
	var refundDate = pm.globals.get('refundDate') || null;

	var body = {
        fulfillmentIds: [fulfillmentId]
    };
    if (overruleCode !== null) {
        body.overruleCode = overruleCode;
    }
    if (refundDate !== null) {
        body.refundDate = refundDate;
    }

	pm.globals.set("requestRefundOffersBodyData", JSON.stringify(body));
}
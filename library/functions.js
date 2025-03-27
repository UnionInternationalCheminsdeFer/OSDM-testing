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

// Import the uuid module for generating unique identifiers
var uuid = require('uuid');

// Initialize a variable to keep track of the total provisional or booking price
var totalProvisionalOrBookingPrice = 0;

// Function to set the authentication token
setAuthToken = function () {
	let jsonData = JSON.parse(responseBody);
	pm.globals.set(GV.ACCESS_TOKEN, jsonData.access_token);
}

// Function to build the offer collection request
function buildOfferCollectionRequest() {
	var tripType = pm.globals.get("TripType");
	var sandbox = pm.environment.get("api_base");

	// Check if the sandbox includes "paxone"
	if (sandbox.includes("paxone")) {
		switch(tripType) {
			case "SPECIFICATION":
				pm.globals.set("OfferCollectionRequest", "{\"tripSpecifications\" : "+pm.globals.get("offerTripSpecifications")+"," +
					"\"anonymousPassengerSpecifications\" : "+pm.globals.get("offerPassengerSpecifications")+"," +
					"\"offerSearchCriteria\" : "+pm.globals.get("offerSearchCriteria") +
					(pm.globals.get("offerFulfillmentOptions") ? ",\"requestedFulfillmentOptions\" : "+pm.globals.get("offerFulfillmentOptions") : "") +
					"}");
				break;
			case "SEARCH":
				pm.globals.set("OfferCollectionRequest", "{\"tripSearchCriteria\" : "+pm.globals.get("offerTripSearchCriteria")+"," +
					"\"anonymousPassengerSpecifications\" : "+pm.globals.get("offerPassengerSpecifications")+"," +
					"\"offerSearchCriteria\" : "+pm.globals.get("offerSearchCriteria") +
					(pm.globals.get("offerFulfillmentOptions") ? ",\"requestedFulfillmentOptions\" : "+pm.globals.get("offerFulfillmentOptions") : "") +
					"}");
				break;
		}
	} else {
		switch(tripType) {
			case "SPECIFICATION":
				pm.globals.set("OfferCollectionRequest", "{\"objectType\": \"OfferCollectionRequest\"," +
					"\"tripSpecifications\" : "+pm.globals.get("offerTripSpecifications")+"," +
					"\"anonymousPassengerSpecifications\" : "+pm.globals.get("offerPassengerSpecifications")+"," +
					"\"offerSearchCriteria\" : "+pm.globals.get("offerSearchCriteria")+"," +
					"\"requestedFulfillmentOptions\" : "+pm.globals.get("offerFulfillmentOptions") +
					"}");
				break;
			case "SEARCH":
				pm.globals.set("OfferCollectionRequest", "{\"objectType\": \"OfferCollectionRequest\"," +
					"\"tripSearchCriteria\" : "+pm.globals.get("offerTripSearchCriteria")+"," +
					"\"anonymousPassengerSpecifications\" : "+pm.globals.get("offerPassengerSpecifications")+"," +
					"\"offerSearchCriteria\" : "+pm.globals.get("offerSearchCriteria")+"," +
					"\"requestedFulfillmentOptions\" : "+pm.globals.get("offerFulfillmentOptions") +
					"}");
				break;
		}
	}
}

// Function to build the booking request
function buildBookingRequest() {
	// Generate a unique identifier for the booking external reference
	var uuid = require('uuid');
	pm.globals.set("bookingExternalRef", uuid.v4());

	// Call the placeSelections function
	placeSelections();
	var osdmVersion = pm.globals.get("osdmVersion");

	// Check the OSDM version and create the purchaser object accordingly
	if (osdmVersion == "3.4") {
		var contact = new Contact("yourusername@example.com", "+33612345678");
		var detail = new DetailContact("Pur", "Chaser", contact);
		var purchaser = new PurchaserContact(detail);
	} else {
		var detail = new Detail("Pur", "Chaser", "yourusername@example.com", "+33612345678");
		var purchaser = new Purchaser(detail);
	}

	var sandbox = pm.environment.get("api_base");

	// Check if the sandbox includes "paxone"
	if (sandbox.includes("paxone")) {
		pm.globals.set("BookingRequest", "{" +
			"\"offers\": [\n" +
			"{\n" +
			"            \"offerId\": \""+pm.globals.get("offerId")+"\",\n" +
			"            "+pm.globals.get("placeSelections")+"\n" +
			"            \"passengerRefs\": \n" +
			"                "+pm.globals.get("bookingPassengerReferences")+"\n" +
			"            \n" +
			"        }\n" +
			"    ]," +
			"\"purchaser\": "+JSON.stringify(purchaser)+"," +
			"\"passengerSpecifications\" : "+pm.globals.get("bookingPassengerSpecifications") +
			"}");
	} else {
		pm.globals.set("BookingRequest", "{" +
			"\"offers\": [\n" +
			"{\n" +
			"            \"offerId\": \""+pm.globals.get("offerId")+"\",\n" +
			"            "+pm.globals.get("placeSelections")+"\n" +
			"            \"passengerRefs\": \n" +
			"                "+pm.globals.get("bookingPassengerReferences")+"\n" +
			"            \n" +
			"        }\n" +
			"    ]," +
			"\"purchaser\": "+JSON.stringify(purchaser)+"," +
			"\"passengerSpecifications\" : "+pm.globals.get("bookingPassengerSpecifications")+"," +
			"\"externalRef\":\""+pm.globals.get("bookingExternalRef")+"\"" +
			"}");
	}
}

// Function to handle place selections
function placeSelections() {
	// Check if place selection is required
	var requiresPlaceSelection = pm.globals.get("requiresPlaceSelection");

	if (requiresPlaceSelection == true) {
		// Set the place selections in global variables
		pm.globals.set("placeSelections", "\"placeSelections\": [\n"
			+ "	                    {\n"
			+ "	                        \"reservationId\": \"" + pm.globals.get("reservationId") + "\",\n"
			+ "	                        \"places\": [\n"
			+ "	                            {\n"
			+ "	                                \"coachNumber\": \"" + pm.globals.get("preselectedCoach") + "\",\n"
			+ "	                                \"placeNumber\": \"" + pm.globals.get("preselectedPlace") + "\",\n"
			+ "	                                \"passengerRef\": \"" + pm.globals.get("passengerSpecification1ExternalRef") + "\"\n"
			+ "	                            }\n"
			+ "	                        ],\n"
			+ "	                        \"tripLegCoverage\" : {\n"
			+ "	                            \"tripId\": \"" + pm.globals.get("tripId") + "\",\n"
			+ "	                            \"legId\" : \"" + pm.globals.get("legId") + "\"\n"
			+ "	                        }\n"
			+ "	                    }\n"
			+ "	                ],");
	} else {
		// Set an empty string if place selection is not required
		pm.globals.set("placeSelections", "");
	}
}

// Function to get scenario data
getScenarioData = function () {
	console.log("[INFO] ⏳ Getting scenario data");
	if (!pm.environment.has('data_file')) {
		// If data file is not set, get data from the base URL in the environment
		validationLogger("[INFO] 🌐 Data file was not set, grabbing data base url from environment : " + pm.environment.get("data_base"));
		pm.sendRequest({
			url: pm.environment.get("data_base"),
			method: 'GET',
			proxy: false
		}, function (err, res) {
			if (err) {
				validationLogger(err);
			} else {
				var jsonData = JSON.parse(res.text());
				pm.globals.set("data_base_tmp", jsonData);

				// Validate JSON with template
				validateJsonWithTemplate(pm.globals.get("data_base_tmp"));
				parseScenarioData(jsonData);
			}
		});
	} else if (pm.environment.has('data_file')) {

		// Validate JSON with template
		validateJsonWithTemplate(JSON.parse(pm.environment.get("data_file")));

		// If data file is set, parse the scenario data from the file
		validationLogger("[INFO] Data file was set, expecting running in postman");
		parseScenarioData(JSON.parse(pm.environment.get("data_file")));
	} else {
		validationLogger("[INFO] Please specify using a data_file or data_base parameter in the environment used.");
	}
}

// Function to validate JSON with a template
function validateJsonWithTemplate(jsonData) {
    pm.sendRequest({
        url: pm.environment.get("json_schema"),
        method: 'GET',
        proxy: false
    }, function (err, res) {
        if (err) {
            console.error("Error loading the schema: ", err);
            pm.test("Schema load failed", function () {
                throw new Error("Schema load failed: " + err);
            });
            return;
        }

        const schema = res.json();

        function validateType(type, value) {
            if (type === "string") return typeof value === "string";
            if (type === "integer") return Number.isInteger(value);
            if (type === "boolean") return typeof value === "boolean";
            if (type === "object") return value !== null && typeof value === "object";
            if (type === "array") return Array.isArray(value);
            if (type === "null") return value === null;
            return false;
        }

        function validateJson(jsonData, schema) {
            const requiredFields = schema.required || [];

            for (let key in schema.properties) {
                const propertySchema = schema.properties[key];

                if (!(key in jsonData)) {
                    if (!requiredFields.includes(key)) {
                        continue;
                    }
                    console.error(`The property '${key}' is required.`);
                    pm.test(`Validation of '${key}' failed`, function () {
                        throw new Error(`The property '${key}' is required.`);
                    });
                    return false;
                }

                const value = jsonData[key];
                const expectedTypes = Array.isArray(propertySchema.type) ? propertySchema.type : [propertySchema.type];
                if (propertySchema.nullable && !expectedTypes.includes("null")) {
                    expectedTypes.push("null");
                }

                const isValidType = expectedTypes.some(type => validateType(type, value));
                if (!isValidType) {
                    console.error(`The type of '${key}' is invalid. Expected: ${expectedTypes.join(', ')}.`);
                    pm.test(`Validation of '${key}' failed`, function () {
                        throw new Error(`The type of '${key}' is invalid. Expected: ${expectedTypes.join(', ')}.`);
                    });
                    return false;
                }

                if (propertySchema.type === "object" && value !== null && typeof value === "object" && propertySchema.properties) {
                    if (!validateJson(value, propertySchema)) {
                        console.error(`The object '${key}' is invalid.`);
                        pm.test(`Validation of '${key}' failed`, function () {
                            throw new Error(`The object '${key}' is invalid.`);
                        });
                        return false;
                    }
                }

                if (propertySchema.type === "array" && Array.isArray(value) && propertySchema.items) {
                    for (let item of value) {
                        if (!validateJson(item, propertySchema.items)) {
                            console.error(`The item in '${key}' is invalid.`);
                            pm.test(`Item in '${key}' failed`, function () {
                                throw new Error(`The item in '${key}' is invalid.`);
                            });
                            return false;
                        }
                    }
                }
            }
            return true;
        }

        const isValid = validateJson(jsonData, schema);
        if (isValid) {
            validationLogger("[INFO] ✅ Valid JSON Datafile structure !");
            pm.test("JSON validation passed", function () {
                pm.expect(true).to.eql(true);
            });
        } else {
            pm.globals.set("loggingType", "ERROR");
            validationLogger("[INFO] ⛔ Invalid JSON Datafile structure !");
            pm.test("JSON validation failed", function () {
                throw new Error("The provided JSON is invalid");
            });
        }
    });
}

// Function to parse scenario data from JSON
parseScenarioData = function(jsonData) {
	// Get the next weekday date
	var nextWeekday = get_next_weekday(new Date());
	var nextWeekdayString = "" + nextWeekday.getUTCFullYear() + "-" + pad(nextWeekday.getUTCMonth() + 1) + "-" + pad(nextWeekday.getUTCDate());

	var dataFileIndex = 0;
	var dataFileLength = jsonData.scenarios.length;
	var foundCorrectDataSet = false;
	var scenarioCodes = [];

	// Loop through the scenarios to find the correct data set
	while(foundCorrectDataSet==false && dataFileIndex<dataFileLength) {
		validationLogger("[INFO] Checking scenario code : "+jsonData.scenarios[dataFileIndex].code+" ⇔ "+scenarioCode);

		// Check if the scenario code matches
		if(jsonData.scenarios[dataFileIndex].code==scenarioCode) {
			scenarioCodes.push(jsonData.scenarios[dataFileIndex].code);

			// Loop through trip requirements to find the matching trip requirement ID
			jsonData.tripRequirements.some(function(tripRequirement){
				if(tripRequirement.id==jsonData.scenarios[dataFileIndex].tripRequirementId){

					// Set the trip type in global variables
					pm.globals.set("TripType",tripRequirement.tripType);

					// Process the trip type
					switch(tripRequirement.tripType) {
					  case "SPECIFICATION":
						validationLogger('[INFO] ⏳ processing a specification');
						var legDefinitions = [];

						// Loop through the legs and set global variables for each leg
						tripRequirement.legs.forEach(function(leg, legIndex) {
							const legPrefix = `leg${legIndex + 1}`;
							const startDatetime = leg.startDatetime.replace("%TRIP_DATE%", nextWeekdayString);
							const endDatetime = leg.endDatetime.replace("%TRIP_DATE%", nextWeekdayString);

							pm.globals.set(`${legPrefix}StartStopPlaceRef`, leg.origin);
							pm.globals.set(`${legPrefix}EndStopPlaceRef`, leg.destination);
							pm.globals.set(`${legPrefix}StartDatetime`, startDatetime);
							pm.globals.set(`${legPrefix}EndDatetime`, endDatetime);
							pm.globals.set(`${legPrefix}VehicleNumber`, leg.vehicleNumber);
							pm.globals.set(`${legPrefix}OperatorCode`, leg.operatorCode);
							pm.globals.set(`${legPrefix}ProductCategoryRef`, leg.productCategoryRef || null);
							pm.globals.set(`${legPrefix}ProductCategoryName`, leg.productCategoryName || null);
							pm.globals.set(`${legPrefix}ProductCategoryShortName`, leg.productCategoryShortName || null);

							// Add the leg definition to the array
							legDefinitions.push(new TripLegDefinition(
								leg.origin,
								startDatetime,
								leg.destination,
								endDatetime,
								leg.productCategoryRef,
								leg.productCategoryName,
								leg.productCategoryShortName,
								leg.vehicleNumber,
								leg.operatorCode
							));
						});
						// Call the function to set trip specifications
						osdmTripSpecification(legDefinitions);

						break;
					  case "SEARCH":
						validationLogger('[INFO] ⏳ processing a search');
						// Set global variables for the trip search criteria
						pm.globals.set("tripStartStopPlaceRef", tripRequirement.trip.origin);
						pm.globals.set("tripEndStopPlaceRef", tripRequirement.trip.destination);
						pm.globals.set("tripStartDatetime", tripRequirement.trip.startDatetime.replace("%TRIP_DATE%", nextWeekdayString));
						pm.globals.set("tripEndDatetime", tripRequirement.trip.endDatetime.replace("%TRIP_DATE%", nextWeekdayString));
						pm.globals.set("tripVehicleNumber", tripRequirement.trip.vehicleNumber);
						pm.globals.set("tripOperatorCode", tripRequirement.trip.operatorCode);
						pm.globals.set("tripProductCategoryRef", tripRequirement.trip.productCategoryRef || null);
						pm.globals.set("tripProductCategoryName", tripRequirement.trip.productCategoryName || null);
						pm.globals.set("tripProductCategoryShortName", tripRequirement.trip.productCategoryShortName || null);
						// Call the function to set trip search criteria
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
						break;
					}
					return true;
				}
			});

			// Set global variables for the scenario
			pm.globals.set("loggingType", ["", "null"].includes(jsonData.scenarios[dataFileIndex].loggingType) ? null : jsonData.scenarios[dataFileIndex].loggingType);
			pm.globals.set("osdmVersion", ["", "null"].includes(jsonData.scenarios[dataFileIndex].osdmVersion) ? null : jsonData.scenarios[dataFileIndex].osdmVersion);
			pm.globals.set("refundOverruleCode", ["", "null"].includes(jsonData.scenarios[dataFileIndex].refundOverruleCode) ? null : jsonData.scenarios[dataFileIndex].refundOverruleCode);
			pm.globals.set("refundDate", ["", "null"].includes(jsonData.scenarios[dataFileIndex].refundDate) ? null : jsonData.scenarios[dataFileIndex].refundDate);
			pm.globals.set("desiredFlexibility", ["", "null"].includes(jsonData.scenarios[dataFileIndex].desiredFlexibility) ? null : jsonData.scenarios[dataFileIndex].desiredFlexibility);
			pm.globals.set("desiredType", jsonData.scenarios[dataFileIndex].desiredType);
			pm.globals.set("ScenarioCode", jsonData.scenarios[dataFileIndex].code);
			pm.globals.set("requestedOfferParts", jsonData.offerSearchCriteria[0].requestedOfferParts);
			pm.globals.set("offerSearchCriteriaCurrency", jsonData.offerSearchCriteria[0].currency);
			pm.globals.set("offerSearchCriteriaTravelClass", jsonData.offerSearchCriteria[0].travelClass);
			pm.globals.set("offerSearchCriteriaSearchClass", jsonData.offerSearchCriteria[0].serviceClass);
			pm.globals.set("requiredPlaceSelection", jsonData.offerSearchCriteria[0].requiredPlaceSelection);
			pm.globals.set("flexibilities", jsonData.offerSearchCriteria[0].flexibilities);
			pm.globals.set("offerMode", jsonData.offerSearchCriteria[0].offerMode);

			// Loop through the passengers list to find the matching passengers list ID
			jsonData.passengersList.some(function(passengersList){
				if(passengersList.id==jsonData.scenarios[dataFileIndex].passengersListId){
					validationLogger('[INFO] Found number of passengers: '+passengersList.passengers.length);
					pm.globals.set(OFFER.PASSENGER_NUMBER, passengersList.passengers.length);
					var offerPassengerSpecs = [];
					var passengerSpecs = [];
					var passengerReferences = [];
					var passengerAdditionalData = [];
					var passengerIndex = 0;
					// Loop through the passengers and set global variables for each passenger
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

						let passengerAdditionalDataStruct = {
							patchFirstName: passenger.patchFirstName,
							patchLastName: passenger.patchLastName,
							patchDateOfBirth: passenger.patchDateOfBirth,
							patchEmail: passenger.patchEmail,
							patchPhoneNumber: passenger.patchPhoneNumber,
						};
						passengerAdditionalData.push(passengerAdditionalDataStruct);
						passengerIndex++;
					});

					validationLogger('[INFO] Pushed passengerspec to globals: '+JSON.stringify(passengerSpecs));
					pm.globals.set(OFFER.PASSENGER_SPECIFICATIONS, JSON.stringify(offerPassengerSpecs));
					pm.globals.set(BOOKING.PASSENGER_SPECIFICATIONS, JSON.stringify(passengerSpecs));
					pm.globals.set(BOOKING.PASSENGER_REFERENCES, JSON.stringify(passengerReferences));
					pm.globals.set("passengerAdditionalData", JSON.stringify(passengerAdditionalData));
					let passengerData = pm.globals.get("passengerAdditionalData");
					passengerData = JSON.parse(passengerData);
					passengerData.forEach((data, index) => {
						Object.entries(data).forEach(([key, value]) => {
							pm.globals.set(`${key}_${index}`, value);
						});
					});
					return true;
				}
			});

			// Set offer search criteria in global variables
			osdmOfferSearchCriteria(
				pm.globals.get("offerSearchCriteriaCurrency") || null,
				pm.globals.get("offerMode") || null,
				pm.globals.get("requestedOfferParts") || [],
				pm.globals.get("flexibilities") || [],
				pm.globals.get("offerSearchCriteriaSearchClass") || null,
				pm.globals.get("offerSearchCriteriaTravelClass") || null,
				null
			);

			// Loop through the requested fulfillment options list to find the matching fulfillment options ID
			if (Array.isArray(jsonData.requestedFulfillmentOptionsList) && jsonData.requestedFulfillmentOptionsList.length > 0) {
				// Loop through the requested fulfillment options list to find the matching fulfillment options ID
				jsonData.requestedFulfillmentOptionsList.some(function(requestedFulfillmentOptionList) {
					if (requestedFulfillmentOptionList.id == jsonData.scenarios[dataFileIndex].requestedFulfillmentOptionsListId) {
						var requestedFulfillmentOptions = [];
			
						requestedFulfillmentOptionList.requestedFulfillmentOptions.forEach(function(requestedFulfillmentOption) {
							// pm.globals.set("fulfillmentType", requestedFulfillmentOption.fulfillmentType);
							// pm.globals.set("fulfillmentMedia", requestedFulfillmentOption.fulfillmentMedia);
							const fulfillmentType = requestedFulfillmentOption.fulfillmentType ?? null;
							const fulfillmentMedia = requestedFulfillmentOption.fulfillmentMedia ?? null;
							
							if (fulfillmentType != null && fulfillmentMedia != null) {
								requestedFulfillmentOptions.push(new FulfillmentOption(fulfillmentType, fulfillmentMedia));
							}
						});
			
						osdmFulfillmentOptions(requestedFulfillmentOptions);
						return true; // Stop iteration once found
					}
				});
			} else {
				validationLogger("[ERROR] requestedFulfillmentOptionsList is empty or not an array.");
			}
			foundCorrectDataSet = true;
			validationLogger("[INFO] ✅ Correct data set was found for this scenario : "+scenarioCode);
		}
		dataFileIndex++;
	}
	if(foundCorrectDataSet==false) {
		throw new Error("[INFO] ⛔ Wrong scenario code. No data set found for this scenario : "+scenarioCode);
	}
}

// Function to set trip search criteria
osdmTripSearchCriteria = function (legDefinitions) {
	// Test if trip search criteria has at least one leg
	pm.test('Trip Search Criteria has at least one leg', function () {
		pm.expect(legDefinitions).to.be.an("array");
		pm.expect(legDefinitions.length).to.be.above(0);

		if (legDefinitions.length == 0) return; // Stop execution if legs are missing
	});

	// Log a warning if multiple legs are provided
	if (legDefinitions.length > 1) {
		validationLogger("[WARNING] TripSearchCriteria currently doesn't generate via points when multiple legs are provided");
	}

	var legDef = legDefinitions[0];

	var carrierFilter = legDef.carrier ? new CarrierFilter([legDef.carrier], false) : null;
	var vehicleFilter = new VehicleFilter([legDef.vehicleNumber], null, false);

	var tripDataFilter = new TripDataFilter(carrierFilter, vehicleFilter);

	var tripParameters = new TripParameters(tripDataFilter);

	var sandbox = pm.environment.get("api_base");
	// Check if the sandbox includes "paxone"
	if (sandbox.includes("paxone")) {
		var tripSearchCriteria = new TripSearchCriteria(
			legDef.startDateTime.substring(0, legDef.startDateTime.length - 6) ,
			new StopPlaceRef(legDef.startStopPlaceRef),
			new StopPlaceRef(legDef.endStopPlaceRef),
			null
		);
	} else {
		var tripSearchCriteria = new TripSearchCriteria(
			legDef.startDateTime.substring(0, legDef.startDateTime.length - 6) ,
			new StopPlaceRef(legDef.startStopPlaceRef),
			new StopPlaceRef(legDef.endStopPlaceRef),
			tripParameters
		);
	}
	
	// Set trip search criteria in global variables
	pm.globals.set(OFFER.TRIP_SEARCH_CRITERIA, JSON.stringify(tripSearchCriteria));
};

// Function to set trip specifications
osdmTripSpecification = function (legDefinitions) {
	// Test if trip specification has at least one leg
	pm.test('Trip Specification has at least one leg', function () {
		pm.expect(legDefinitions).to.be.an("array");
		pm.expect(legDefinitions.length).to.be.above(0);

		if (legDefinitions.length == 0) return; // Stop execution if legs are missing
	});

	// Set trip external reference in global variables
	pm.globals.set(TRIP.EXTERNAL_REF, uuid.v4());

	var legSpecs = [];

	// Loop through the leg definitions and set global variables for each leg
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

		// Add the leg specification to the array
		legSpecs.push(new TripLegSpecification(
			pm.globals.get(legKey),
			timedLegSpec
		));
	}

	var tripSpecification = new TripSpecification(
		pm.globals.get(TRIP.EXTERNAL_REF),
		legSpecs
	);

	// Set trip specifications in global variables
	pm.globals.set(OFFER.TRIP_SPECIFICATIONS, JSON.stringify([tripSpecification]));
};

// Function to set anonymous passenger specifications
osdmAnonymousPassengerSpecifications = function(passengerNumber) {

	// Set the number of passengers in global variables
	pm.globals.set(OFFER.PASSENGER_NUMBER, passengerNumber);

	var passengerSpecs = [];

	// Loop through the number of passengers and set global variables for each passenger
	for (let n = 1; n <= passengerNumber; n++) {
		var passengerKey = OFFER.PASSENGER_SPECIFICATION_EXTERNAL_REF_PATTERN.replace("%PASSENGER_COUNT%", n);

		var birthDate = new Date();
		birthDate.setFullYear(birthDate.getFullYear() - 26);
		birthDate.setDate(birthDate.getDate() -1);

		pm.globals.set(passengerKey, uuid.v4());

		// Add the passenger specification to the array
		passengerSpecs.push(new AnonymousPassengerSpec(
			pm.globals.get(passengerKey),
			PassengerType.PERSON,
			birthDate.toISOString().substring(0,10),
		));
	}

	// Set passenger specifications in global variables
	pm.globals.set(OFFER.PASSENGER_SPECIFICATIONS, JSON.stringify(passengerSpecs));
};
// Function to set offer search criteria
osdmOfferSearchCriteria = function (
	currency,
	offerMode,
	offerParts,
	flexibilities,
	serviceClassTypes,
	travelClasses,
	productTags,
) {
	// Create a new object for offer search criteria
	var offerSearchCriteria = new Object();

	// Set currency if provided
	if (currency != null && currency != '') {
		offerSearchCriteria.currency = currency;
	}
	// Set offer mode if provided
	if(offerMode != null && offerMode != ''){
		offerSearchCriteria.offerMode = offerMode;
	}

	// Set requested offer parts if provided
	if (Array.isArray(offerParts) && offerParts.length > 0) {
		offerSearchCriteria.requestedOfferParts = offerParts;
	}

	// Set flexibilities if provided
	if (Array.isArray(flexibilities) && flexibilities.length > 0) {
		offerSearchCriteria.flexibilities = flexibilities;
	}

	// Set service class types if provided
	if (Array.isArray(serviceClassTypes) && serviceClassTypes.length > 0) {
		offerSearchCriteria.serviceClassTypes = serviceClassTypes;
	}

	// Set travel classes if provided
	if (Array.isArray(travelClasses) && travelClasses.length > 0) {
		offerSearchCriteria.travelClasses = travelClasses;
	}

	// Set offer search criteria in global variables
	pm.globals.set(OFFER.SEARCH_CRITERIA, JSON.stringify(offerSearchCriteria));
};

// Function to set fulfillment options
osdmFulfillmentOptions = function(requestedFulfillmentOptions) {
	// Set fulfillment options in global variables if provided
	if (Array.isArray(requestedFulfillmentOptions) && requestedFulfillmentOptions.length > 0) {
		pm.globals.set(OFFER.FULFILLMENT_OPTIONS, JSON.stringify(requestedFulfillmentOptions));
	}
};

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

displayOfferResponse = function(response) {
	try {
		if (!response || !response.offers || response.offers.length === 0) {
			validationLogger("[FULL] Error: No offers found in the response.");
			return;
		}
		let includedReservations = null;
		let isTrainBound = false;

		response.offers.forEach((offer, index) => {
			validationLogger(`[FULL] Offer ${index + 1} Details:`);
			validationLogger(`[FULL]   Minimal Price amount: ${offer.offerSummary?.minimalPrice?.amount || 'Not available'}`);
			validationLogger(`[FULL]   Overall Flexibility: ${offer.offerSummary?.overallFlexibility || 'Not available'}`);
			validationLogger(`[FULL]   Overall ServiceClass: ${offer.offerSummary?.overallServiceClass?.name || 'Not available'}`);
			validationLogger(`[FULL]   Overall TravelClass: ${offer.offerSummary?.overallTravelClass || 'Not available'}`);
			validationLogger(`[FULL]   Overall AccommodationType: ${offer.offerSummary?.overallAccommodationType || 'Not available'}`);
			validationLogger(`[FULL]   Overall AccommodationSubType: ${offer.offerSummary?.overallAccommodationSubType || 'Not available'}`);

			(offer.admissionOfferParts || []).forEach((admissionPart, partIndex) => {
				validationLogger(`[FULL]   Admission Offer Part ${partIndex + 1}:`);
				validationLogger(`[FULL]       Summary: ${admissionPart?.summary || 'Not available'}`);
				validationLogger(`[FULL]       Price: ${
					admissionPart?.price?.amount 
						? `${admissionPart.price.amount} ${admissionPart.price.currency || 'Unknown currency'}` 
						: 'Not available'
				}`);

				if (admissionPart?.includedReservations?.length > 0) {
					includedReservations = admissionPart.includedReservations;
					admissionPart.includedReservations.forEach((reservation, reservationIndex) => {
						validationLogger(`[FULL]     Included Reservation ${reservationIndex + 1}:`);
						validationLogger(`[FULL]       ID: ${reservation?.id || 'Not available'}`);
						validationLogger(`[FULL]       Summary: ${reservation?.summary || 'Not available'}`);
						validationLogger(`[FULL]       Created On: ${reservation?.createdOn || 'Not available'}`);
						validationLogger(`[FULL]       Valid From: ${reservation?.validFrom || 'Not available'}`);
						validationLogger(`[FULL]       Valid Until: ${reservation?.validUntil || 'Not available'}`);
						validationLogger(`[FULL]       Price: ${
							reservation?.price?.amount 
								? `${reservation.price.amount} ${reservation.price.currency || 'Unknown currency'}` 
								: 'Not available'
						}`);
					});
				} else {
					validationLogger(`[FULL]   No included reservations.`);
				}
			});

			(offer.products || []).forEach((product, productIndex) => {
				isTrainBound = product?.isTrainBound || false;
				validationLogger(`[FULL]   Product ${productIndex + 1}:`);
				validationLogger(`[FULL]       Product Summary: ${product?.summary || 'Not available'}`);
				validationLogger(`[FULL]       Product Type: ${product?.type || 'Not available'}`);
				validationLogger(`[FULL]       Train is bound: ${isTrainBound}`);
			});

			if (!isTrainBound && !includedReservations) {
				validationLogger(`[FULL]       NRT: Train is not bound, and no included reservations.`);
			} else if (isTrainBound && !includedReservations) {
				validationLogger(`[FULL]       TLT: Train is bound, but no included reservations.`);
			} else if (isTrainBound && Array.isArray(includedReservations)) {
				validationLogger(`[FULL]       IRT: Train is bound, and included reservations present.`);
			}

			validationLogger(`[FULL]   Number of passengers: ${response.anonymousPassengerSpecifications?.length || 0}`);
			validationLogger(`[FULL]       Type: ${
				response.anonymousPassengerSpecifications?.map(spec => spec?.type || 'Unknown').join(', ') || 'None'
			}`);
			validationLogger(`[FULL]       Cards: ${
				response.anonymousPassengerSpecifications?.map(
					spec => spec?.cards ? spec.cards.join(', ') : 'None'
				).join(', ') || 'None'
			}`);

			(response.trips || []).forEach((trip, tripIndex) => {
				validationLogger(`[FULL]   Trip ${tripIndex + 1} Summary: ${trip?.summary || 'Not available'}`);
				validationLogger(`[FULL]   Number of trip legs: ${trip?.legs?.length || 0}`);
				validationLogger(`[FULL]   Start Time: ${trip?.startTime || 'Not available'}`);
				validationLogger(`[FULL]   End Time: ${trip?.endTime || 'Not available'}`);

				(trip?.legs || []).forEach((leg, legIndex) => {
					validationLogger(`[FULL]     Leg ${legIndex + 1} Details:`);
					validationLogger(`[FULL]         Start Stop Place Name: ${leg?.timedLeg?.start?.stopPlaceName || 'Not available'}`);
					validationLogger(`[FULL]         End Stop Place Name: ${leg?.timedLeg?.end?.stopPlaceName || 'Not available'}`);
					validationLogger(`[FULL]         Vehicle Numbers: ${
						leg?.timedLeg?.service?.vehicleNumbers 
							? leg.timedLeg.service.vehicleNumbers.join(', ') 
							: 'None'
					}`);
					validationLogger(`[FULL]         Line Numbers: ${
						leg?.timedLeg?.service?.lineNumbers 
							? leg.timedLeg.service.lineNumbers.join(', ') 
							: 'None'
					}`);
				});
			});
		});
	} catch (error) {
		validationLogger(`[FULL] Error processing the offer response: ${error.message}`);
	}
};

validateBookingResponse = function(offers, offerId, booking, state) {
	// Extract booking details
	var bookingId = booking.id;
	var createdOn = new Date(booking.createdOn);
	var confirmationTimeLimit = new Date(booking.confirmationTimeLimit);
	var bookedOffers = booking.bookedOffers;

	pm.globals.set("bookingId", bookingId);

	if (jsonData.booking && Array.isArray(jsonData.booking.passengers) && jsonData.booking.passengers.length > 0) {
		for (var i = 0; i < jsonData.booking.passengers.length; i++) {
			var passengerId = jsonData.booking.passengers[i].id;
			if (passengerId) {
				pm.globals.set("passengerId_" + i, passengerId);
			} else {
				validationLogger("[WARNING] Passenger at index " + i + " has no ID.");
			}
		}
	} else {
		validationLogger("[ERROR] Passengers structure is invalid or empty.");
	}

	// Log booking and offer information
	validationLogger("[INFO] Checking booking with Id : " + bookingId);
	validationLogger("[INFO] Offer Id : " + offerId);

	// Check if bookingId is returned
	pm.test("a bookingId is returned", function () {
		pm.expect(bookingId).to.be.a('string').and.not.be.empty;
	});

	// Check the creation date
	var currentDate = new Date();
	validationLogger("[INFO] CreatedOn specific date format is valid : " + currentDate);
	pm.test("Correct createdOn is returned", function () {
		pm.expect(currentDate.getDate()).to.equal(createdOn.getDate());
		pm.expect(currentDate.getMonth()).to.equal(createdOn.getMonth());
		pm.expect(currentDate.getFullYear()).to.equal(createdOn.getFullYear());
	});

	// TODO : Check if a confirmationTimeLimit is available to check
	if (booking.confirmationTimeLimit != undefined && booking.confirmationTimeLimit != null) {
		// Check the confirmationTimeLimit
		pm.test("a correct confirmationTimeLimit is returned", function () {
			var current = currentDate.getTime();
			var confirmation = confirmationTimeLimit.getTime();
			pm.expect(confirmation).to.be.above(current);
		});
	}

	// Find the correct offer from the list of offers
	var offer = null;
	offers.some(function (internalOffer) {
		if (internalOffer.offerId == offerId) {
			offer = internalOffer;
			return true;
		}
	});

	// If no correct offer is found, skip the rest of the validation
	if (offer == undefined || offer == null) {
		validationLogger("[INFO] No correct offer can be found, skipping rest of validation");
		return;
	} else {
		validationLogger("[INFO] Correct offer from offer response found, performing rest of validation");
	}

	validationLogger("[DEBUG] 🪲 BookedOffers: ", bookedOffers);
	validationLogger("[DEBUG] Offer: ", offer);
	validationLogger("[DEBUG] Booking: ", booking);
	validationLogger("[DEBUG] State: ", state);

	// Compare booked offers with the correct offer
	var found = bookedOffers.some(function (bookedOffer) {
		return compareOffers(bookedOffer, offer, booking, state);
	});

	// Check if the correct offer is returned
	pm.test("Correct offer " + offer.offerId + " is returned", function () {
		pm.expect(found).to.equal(true);
	});

	// Check that all the passengers match the passengers from the offer
	offer.passengerRefs.forEach(function (passenger) {
		var found = false;
		found = booking.passengers.some(function (bookedPassenger) {
			validationLogger("[INFO] Comparing bookedPassenger.externalRef = " + bookedPassenger.externalRef + " ⇔ Passenger ref = " + passenger);
			if (bookedPassenger.externalRef == passenger) {
				return true;
			}
		});

		// Check if the passenger is returned
		pm.test("passenger " + passenger + " returned", function () {
			pm.expect(found).to.equal(true);
		});

	});

};

displayBookingResponse = function(response) {
	validationLogger(`[FULL] Booking ID: ${response.booking.id}`);
	validationLogger(`[FULL] Booking Code: ${response.booking.bookingCode}`);
	validationLogger(`[FULL] External Reference: ${response.booking.externalRef}`);
	validationLogger(`[FULL] Created On: ${response.booking.createdOn}`);
	validationLogger(`[FULL] Provisional Price: ${response.booking.provisionalPrice.amount} ${response.booking.provisionalPrice.currency}`);
	validationLogger(`[FULL] Number of Passengers: ${response.booking.passengers.length}`);

	response.booking.passengers.forEach((passenger, passengerIndex) => {
		validationLogger(`[FULL] Passenger ${passengerIndex + 1} Details:`);
		validationLogger(`[FULL]   Passenger ID: ${passenger.id}`);
		validationLogger(`[FULL]   Type: ${passenger.type}`);
		validationLogger(`[FULL]   Date of Birth: ${passenger.dateOfBirth}`);
		validationLogger(`[FULL]   Cards: ${passenger.cards ? passenger.cards.join(', ') : 'None'}`);
	});

	response.booking.trips.forEach((trip, tripIndex) => {
		validationLogger(`[FULL] Trip ${tripIndex + 1} Summary: ${trip.summary}`);
		validationLogger(`[FULL]   Trip ID: ${trip.id}`);
		validationLogger(`[FULL]   Direction: ${trip.direction}`);
		validationLogger(`[FULL]   Start Time: ${trip.startTime}`);
		validationLogger(`[FULL]   End Time: ${trip.endTime}`);
		validationLogger(`[FULL]   Duration: ${trip.duration}`);
		validationLogger(`[FULL]   Distance: ${trip.distance} meters`);

		trip.legs.forEach((leg, legIndex) => {
			validationLogger(`[FULL]     Leg ${legIndex + 1} Details:`);
			validationLogger(`[FULL]       Leg ID: ${leg.id}`);
			validationLogger(`[FULL]       Start Stop Place Name: ${leg.timedLeg.start.stopPlaceName}`);
			validationLogger(`[FULL]       End Stop Place Name: ${leg.timedLeg.end.stopPlaceName}`);
			validationLogger(`[FULL]       Start Time: ${leg.timedLeg.start.serviceDeparture.timetabledTime}`);
			validationLogger(`[FULL]       End Time: ${leg.timedLeg.end.serviceArrival.timetabledTime}`);

			validationLogger(`[FULL]       Vehicle Numbers: ${leg.timedLeg.service.vehicleNumbers ? leg.timedLeg.service.vehicleNumbers.join(', ') : 'None'}`);
			validationLogger(`[FULL]       Line Numbers: ${leg.timedLeg.service.lineNumbers ? leg.timedLeg.service.lineNumbers.join(', ') : 'None'}`);
		});
	});

	response.booking.bookedOffers.forEach((offer, offerIndex) => {
		validationLogger(`[FULL] Offer ${offerIndex + 1} Details:`);
		validationLogger(`[FULL]   Offer ID: ${offer.offerId}`);
		validationLogger(`[FULL]   Reservations: ${offer.reservations.length} reservation(s)`);
		
		offer.reservations.forEach((reservation, reservationIndex) => {
			validationLogger(`[FULL]     Reservation ${reservationIndex + 1} Details:`);
			validationLogger(`[FULL]       Object Type: ${reservation.objectType}`);
			validationLogger(`[FULL]       Status: ${reservation.status}`);
			validationLogger(`[FULL]       Valid From: ${reservation.validFrom}`);
			validationLogger(`[FULL]       Valid Until: ${reservation.validUntil}`);
			validationLogger(`[FULL]       Price: ${reservation.price.amount} ${reservation.price.currency}`);
			validationLogger(`[FULL]       Refundable: ${reservation.refundable}`);
			validationLogger(`[FULL]       Exchangeable: ${reservation.exchangeable}`);
		});
	});
}

// Function to compare booked offers with the provided offer and booking state
compareOffers = function(bookedOffer, offer, booking, state){
	validationLogger("[INFO] Comparing bookedOffer offerId = "+bookedOffer.offerId+" ⇔ offer offerId = "+offer.offerId);
	
	// Check if admissions are defined and compare them
	if((bookedOffer.admissions==undefined||bookedOffer.admissions==null||bookedOffer.admissions.length==0)&&
		(offer.admissionOfferParts==undefined||offer.admissionOfferParts==null||offer.admissionOfferParts.length==0)) {
		validationLogger("[INFO] Skipping admissions");
	} else {
		bookedOffer.admissions.forEach(function(bookedAdmission){
			checkGenericBookedOfferPart(bookedAdmission, state, "admissions");
			offer.admissionOfferParts.some(function(offeredAdmission){
				return compareAdmissions(bookedAdmission, offeredAdmission, booking);
			});
		});	
	}
	
	// Check if reservations are defined and compare them
	if((bookedOffer.reservations==undefined||bookedOffer.reservations==null||bookedOffer.reservations.length==0)&&
		(offer.reservationOfferParts==undefined||offer.reservationOfferParts==null||offer.reservationOfferParts.length==0)) {
		validationLogger("[INFO] Skipping reservations");
	} else {
		bookedOffer.reservations.forEach(function(bookedReservation){
			checkGenericBookedOfferPart(bookedReservation, state, "reservations");
			var found = offer.reservationOfferParts.some(function(offeredReservation){
				return compareReservations(bookedReservation, offeredReservation, booking);
			});
		});	
	}
	
	return true;
};

// Function to compare booked admissions with offered admissions
compareAdmissions = function(bookedAdmission, offeredAdmission, booking){
	validationLogger("[INFO] Comparing admission bookedAdmission.id = "+bookedAdmission.id+" ⇔ offeredAdmission.id = "+offeredAdmission.id);

	// Compare prices
	pm.test("Price of the admission should be correct", function () {
		pm.expect(bookedAdmission.price.amount).to.equal(offeredAdmission.price.amount);
		pm.expect(bookedAdmission.price.currency).to.equal(offeredAdmission.price.currency);
		pm.expect(bookedAdmission.price.scale).to.equal(offeredAdmission.price.scale);
	});

	// Compare products
	pm.test("Products of the admission should be correct", function () {
		for (var i = 0; i < bookedAdmission.products.length; i++) {
			var bookedProduct = bookedAdmission.products[i];
			var found = false;
			for (var j = 0; j < offeredAdmission.products.length; j++) {
				var offeredProduct = offeredAdmission.products[j];
				if (bookedProduct.productId == offeredProduct.productId) {
					found = true;
					break;
				}
			}
			pm.expect(found).to.equal(true);
		}
	});
	
	// Compare exchangeable property
	if(bookedAdmission.exchangeable!=undefined){
		pm.test("Exchangable should be set and similar to offered", function () {
			pm.expect(bookedAdmission.exchangeable).to.equal(offeredAdmission.exchangeable);
		});
	}
	
	// Compare isReservationRequired property
	if(bookedAdmission.isReservationRequired!=undefined){
		pm.test("isReservationRequired should be set and similar to offered", function () {
			pm.expect(bookedAdmission.isReservationRequired).to.equal(offeredAdmission.isReservationRequired);
		});
	}
	
	// Compare isReusable property
	if(bookedAdmission.isReusable!=undefined){
		pm.test("Exchangable should be set and similar to offered", function () {
			pm.expect(bookedAdmission.isReusable).to.equal(offeredAdmission.isReusable);
		});
	}
	
	// Compare offerMode property
	if(bookedAdmission.offerMode!=undefined){
		pm.test("offerMode should be set and similar to offered", function () {
			pm.expect(bookedAdmission.offerMode).to.equal(offeredAdmission.offerMode);
		});
	}
	
	// Compare refundable property
	if(bookedAdmission.refundable!=undefined){
		pm.test("refundable should be set and similar to offered", function () {
			pm.expect(bookedAdmission.refundable).to.equal(offeredAdmission.refundable);
		});
	}
	
	// Compare passengerIds with booking passengers
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

// Function to compare booked reservations with offered reservations
compareReservations = function(bookedReservation, offeredReservation, booking){
	validationLogger("[INFO] Comparing reservation bookedReservation.id = "+bookedReservation.id+" ⇔ offeredReservation.id = "+offeredReservation.id);
	
	// Compare prices
	pm.test("Price of the reservation should be correct", function () {
		pm.expect(bookedReservation.price.amount).to.equal(offeredReservation.price.amount);
		pm.expect(bookedReservation.price.currency).to.equal(offeredReservation.price.currency);
		pm.expect(bookedReservation.price.scale).to.equal(offeredReservation.price.scale);
	});
	
	// Compare products if available
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

	// Compare exchangeable property
	if(bookedReservation.exchangeable!=undefined){
		pm.test("Exchangable should be set and similar to offered", function () {
			pm.expect(bookedReservation.exchangeable).to.equal(offeredReservation.exchangeable);
		});
	}

	// Compare isReservationRequired property
	if(bookedReservation.isReservationRequired!=undefined){
		pm.test("isReservationRequired should be set and similar to offered", function () {
			pm.expect(bookedReservation.isReservationRequired).to.equal(offeredReservation.isReservationRequired);
		});
	}

	// Compare isReusable property
	if(bookedReservation.isReusable!=undefined){
		pm.test("Exchangable should be set and similar to offered", function () {
			pm.expect(bookedReservation.isReusable).to.equal(offeredReservation.isReusable);
		});
	}

	// Compare offerMode property
	if(bookedReservation.offerMode!=undefined){
		pm.test("offerMode should be set and similar to offered", function () {
			pm.expect(bookedReservation.offerMode).to.equal(offeredReservation.offerMode);
		});
	}

	// Compare refundable property
	if(bookedReservation.refundable!=undefined){
		pm.test("refundable should be set and similar to offered", function () {
			pm.expect(bookedReservation.refundable).to.equal(offeredReservation.refundable);
		});
	}

	// Compare passengerIds with booking passengers
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

// Function to compare ancillaries
compareAncillaries = function(ancillary1, ancillary2, booking){
	validationLogger("[INFO] Comparing ancillary = "+ancillary1.id+" ⇔ "+ ancillary2.id);
	return true;
};

// Function to log validation messages based on logging type
validationLogger = function (message) {
	var loggingType = pm.globals.get("loggingType") || "INFO"; 
	switch (loggingType) {
		case "FULL":
			console.log(message);
			break;
		case "INFO":
			if (message.includes("[INFO]") || message.includes("[WARNING]") || message.includes("[ERROR]")) {
				console.log(message);
			}
			break;
		case "WARNING":
			if (message.includes("[WARNING]") || message.includes("[ERROR]")) {
				console.log(message);
			}
			break;
		case "ERROR":
			if (message.includes("[ERROR]")) {
				console.log(message);
			}
			break;
		case "DEBUG":
			if (message.includes("[DEBUG]") || message.includes("[INFO]")) {
				console.log(message);
			}
			break;
		default:
			if (message.includes("[INFO]")) {
				console.log(message);
			}
			break;
	}
};

// Function to check generic booked offer part
checkGenericBookedOfferPart = function(offerPart, state, textDescription){
	var currentDate = new Date();
	var createdOn = new Date(offerPart.createdOn);
	var confirmableUntil = new Date(offerPart.confirmableUntil);

	// Check createdOn date
	pm.test("Correct createdOn is returned on bookedofferpart " + textDescription, function () {
		pm.expect(currentDate.toDateString()).to.equal(createdOn.toDateString());
	});
	totalProvisionalOrBookingPrice += calculateTotalAmount(offerPart);

	// Check confirmableUntil date if state is PREBOOKED
	if(state=="PREBOOKED"){
		pm.test("a correct confirmableUntil is returned on bookedofferpart " + textDescription, function () {
			var current = currentDate.getTime();
			var confirmation = confirmableUntil.getTime();
			pm.expect(confirmation).to.be.above(current);
		});
	}

	// Check status
	pm.test("Correct status is returned on bookedofferpart " + textDescription + " : " + state, function () {
		pm.expect(offerPart.status).to.equal(state);
	});
};

// Function to calculate total amount of an offer part
function calculateTotalAmount(offerPart) {
	if (!offerPart || typeof offerPart !== 'object') {
		validationLogger("[ERROR] OfferPart not found.");
		return 0;
	}

	const objectTypes = ['Reservation', 'Admission', 'Fees', 'Fares', 'Ancillaries'];
	function getPriceAmount(obj) {
		if (objectTypes.includes(obj.objectType) && obj.price && typeof obj.price.amount === 'number') {
			return obj.price.amount;
		}
		return 0;
	}

	if (Array.isArray(offerPart)) {
		return offerPart.reduce((sum, item) => sum + getPriceAmount(item), 0);
	}

	return getPriceAmount(offerPart);
}

// Function to check fulfilled booking
checkFulFilledBooking = function(booking, offer, bookingState, fulfillmentState=undefined){
	booking.bookedOffers.forEach(function(bookedOffer){
		validationLogger("[INFO] Checking bookedOffer "+bookedOffer.offerId);
		
		// Check admissions
		if(bookedOffer.admissions!=undefined&&bookedOffer.admissions!=null&&bookedOffer.admissions.length>0){
			bookedOffer.admissions.forEach(function(bookedOfferPart){
				checkGenericBookedOfferPart(bookedOfferPart,bookingState, "admissions");
			});
		}

		// Check reservations
		if(bookedOffer.reservations!=undefined&&bookedOffer.reservations!=null&&bookedOffer.reservations.length>0){
			bookedOffer.reservations.forEach(function(bookedOfferPart){
				checkGenericBookedOfferPart(bookedOfferPart,bookingState, "reservations");
			});
		}

		// Check ancillaries
		if(bookedOffer.ancillaries!=undefined&&bookedOffer.ancillaries!=null&&bookedOffer.ancillaries.length>0){
			bookedOffer.ancillaries.forEach(function(bookedOfferPart){
				checkGenericBookedOfferPart(bookedOfferPart,bookingState, "ancillaries");
			});
		}

		// Check fees
		if(bookedOffer.fees!=undefined&&bookedOffer.fees!=null&&bookedOffer.fees.length>0){
			bookedOffer.fees.forEach(function(bookedOfferPart){
				checkGenericBookedOfferPart(bookedOfferPart,bookingState, "fees");
			});
		}

		// Check fares
		if(bookedOffer.fares!=undefined&&bookedOffer.fares!=null&&bookedOffer.fares.length>0){
			bookedOffer.fares.forEach(function(bookedOfferPart){
				checkGenericBookedOfferPart(bookedOfferPart,bookingState, "fares");
			});
		}

		// Check fulfillments
		if(fulfillmentState!=undefined) {
			booking.fulfillments.forEach(function(fulfillment) {
				checkFulfillment(booking, fulfillment, fulfillmentState);
			});
		}
		
		// Check passengers
		for (var i = 0; i < offer.passengerRefs.length; i++) {
			var passenger = offer.passengerRefs[i];
			var found = false;

			for (var j = 0; j < booking.passengers.length; j++) {
				var bookedPassenger = booking.passengers[j];
				validationLogger("[INFO] Checking bookedPassenger.externalRef = " + bookedPassenger.externalRef + " ⇔ passenger = " + passenger);

				if (bookedPassenger.externalRef == passenger) {
					found = true;
					break;
				}
			}

			pm.test("Passenger " + passenger + " returned", function () {
				pm.expect(found).to.equal(true);
			});
		}
		
		// Check purchaser
		if(booking.purchaser!=undefined&&booking.purchaser!=null&&booking.purchaser.detail!=undefined&&booking.purchaser.detail!=null) {
			pm.test("Correct Purchaser is returned", function () {
				pm.expect(booking.purchaser.detail.firstName).not.to.be.empty;
				pm.expect(booking.purchaser.detail.lastName).not.to.be.empty;
			});
		}
	});

	// Check fulfillment ID
	if(pm.globals.get("fulfillmentsId")!==undefined) {
		pm.test("Verify fulfillment ID", function () {
			var fulfillmentsId = pm.globals.get("fulfillmentsId");
			pm.expect(booking.fulfillments[0].id).to.eql(fulfillmentsId);
		});
	}

	// Check provisional and confirmed prices
	if(fulfillmentState=="FULFILLED") {
		pm.globals.set("bookingConfirmedPrice", booking.confirmedPrice.amount);
		var provisionalPrice = pm.globals.get("provisionalPrice");
		var bookingConfirmedPrice = pm.globals.get("bookingConfirmedPrice");
		pm.test("Check bookingConfirmedPrice = " + totalProvisionalOrBookingPrice + " with Admission + Reservation + Ancillaries + Fees+ Fares = " + bookingConfirmedPrice, function () {
			pm.expect(totalProvisionalOrBookingPrice).to.eql(bookingConfirmedPrice);
		});
		pm.test("Check provisionalPrice = " + provisionalPrice + " with bookingConfirmedPrice = " + bookingConfirmedPrice, function () {
			pm.expect(provisionalPrice).to.eql(bookingConfirmedPrice);
		});
	}
	else if(fulfillmentState==undefined) {
		pm.globals.set("provisionalPrice", booking.provisionalPrice.amount);
		var provisionalPrice = pm.globals.get("provisionalPrice");
		pm.test("Check provisionalPrice = " + totalProvisionalOrBookingPrice + " with Admission + Reservation + Ancillaries + Fees+ Fares = " + provisionalPrice, function () {
			pm.expect(totalProvisionalOrBookingPrice).to.eql(provisionalPrice);
		});
	}
};

// Function to check fulfillment details
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
			validationLogger("[FULL] Error: Booking information is missing from the response.");
			return;
		}

		validationLogger(`[FULL] Booking ID: ${response.booking?.id ?? 'Not available'}`);
		validationLogger(`[FULL] Booking Code: ${response.booking?.bookingCode ?? 'Not available'}`);
		validationLogger(`[FULL] External Reference: ${response.booking?.externalRef ?? 'Not available'}`);
		validationLogger(`[FULL] Created On: ${response.booking?.createdOn ?? 'Not available'}`);
		validationLogger(`[FULL] Provisional Price: ${
			response.booking?.provisionalPrice
				? response.booking.provisionalPrice.amount + ' ' + response.booking.provisionalPrice.currency
				: 'Not available'
		}`);
		validationLogger(`[FULL] Confirmed Price: ${
			response.booking?.confirmedPrice
				? response.booking.confirmedPrice.amount + ' ' + response.booking.confirmedPrice.currency
				: 'Not available'
		}`);
		validationLogger(`[FULL] Number of Passengers: ${response.booking?.passengers?.length ?? 'Not available'}`);

		response.booking?.passengers?.forEach((passenger, passengerIndex) => {
			validationLogger(`[FULL] Passenger ${passengerIndex + 1} Details:`);
			validationLogger(`[FULL]   Passenger ID: ${passenger?.id ?? 'Not available'}`);
			validationLogger(`[FULL]   Type: ${passenger?.type ?? 'Not available'}`);
			validationLogger(`[FULL]   Date of Birth: ${passenger?.dateOfBirth ?? 'Not available'}`);
			validationLogger(`[FULL]   Cards: ${passenger?.cards?.join(', ') ?? 'None'}`);
		});

		response.booking?.trips?.forEach((trip, tripIndex) => {
			validationLogger(`[FULL] Trip ${tripIndex + 1} Summary: ${trip?.summary ?? 'Not available'}`);
			validationLogger(`[FULL]   Trip ID: ${trip?.id ?? 'Not available'}`);
			validationLogger(`[FULL]   Direction: ${trip?.direction ?? 'Not available'}`);
			validationLogger(`[FULL]   Start Time: ${trip?.startTime ?? 'Not available'}`);
			validationLogger(`[FULL]   End Time: ${trip?.endTime ?? 'Not available'}`);
			validationLogger(`[FULL]   Duration: ${trip?.duration ?? 'Not available'}`);
			validationLogger(`[FULL]   Distance: ${trip?.distance ?? 'Not available'} meters`);

			trip?.legs?.forEach((leg, legIndex) => {
				validationLogger(`[FULL]     Leg ${legIndex + 1} Details:`);
				validationLogger(`[FULL]       Leg ID: ${leg?.id ?? 'Not available'}`);
				validationLogger(`[FULL]       Start Stop Place Name: ${leg?.timedLeg?.start?.stopPlaceName ?? 'Not available'}`);
				validationLogger(`[FULL]       End Stop Place Name: ${leg?.timedLeg?.end?.stopPlaceName ?? 'Not available'}`);
				validationLogger(`[FULL]       Start Time: ${leg?.timedLeg?.start?.serviceDeparture?.timetabledTime ?? 'Not available'}`);
				validationLogger(`[FULL]       End Time: ${leg?.timedLeg?.end?.serviceArrival?.timetabledTime ?? 'Not available'}`);
				validationLogger(`[FULL]       Vehicle Numbers: ${
					leg?.timedLeg?.service?.vehicleNumbers?.join(', ') ?? 'None'
				}`);
				validationLogger(`[FULL]       Line Numbers: ${
					leg?.timedLeg?.service?.lineNumbers?.join(', ') ?? 'None'
				}`);
			});
		});

		response.booking?.bookedOffers?.forEach((offer, offerIndex) => {
			validationLogger(`[FULL] Offer ${offerIndex + 1} Details:`);
			validationLogger(`[FULL]   Offer ID: ${offer?.offerId ?? 'Not available'}`);
			validationLogger(`[FULL]   Reservations: ${offer?.reservations?.length ?? 0} reservation(s)`);

			offer?.reservations?.forEach((reservation, reservationIndex) => {
				validationLogger(`[FULL]     Reservation ${reservationIndex + 1} Details:`);
				validationLogger(`[FULL]       Object Type: ${reservation?.objectType ?? 'Not available'}`);
				validationLogger(`[FULL]       Status: ${reservation?.status ?? 'Not available'}`);
				validationLogger(`[FULL]       Valid From: ${reservation?.validFrom ?? 'Not available'}`);
				validationLogger(`[FULL]       Valid Until: ${reservation?.validUntil ?? 'Not available'}`);
				validationLogger(`[FULL]       Price: ${
					reservation?.price
						? reservation.price.amount + ' ' + reservation.price.currency
						: 'Not available'
				}`);
				validationLogger(`[FULL]       Refundable: ${
					reservation?.refundable !== undefined ? reservation.refundable : 'Not available'
				}`);
				validationLogger(`[FULL]       Exchangeable: ${
					reservation?.exchangeable !== undefined ? reservation.exchangeable : 'Not available'
				}`);
			});
		});

		if (response.booking?.fulfillments?.length > 0) {
			validationLogger(`[FULL] Number of Fulfillments: ${response.booking.fulfillments.length}`);
			response.booking.fulfillments.forEach((fulfillment, fulfillmentIndex) => {
				validationLogger(`[FULL] Fulfillment ${fulfillmentIndex + 1} Details:`);
				validationLogger(`[FULL]   Fulfillment ID: ${fulfillment?.id ?? 'Not available'}`);
				validationLogger(`[FULL]   Status: ${fulfillment?.status ?? 'Not available'}`);
				validationLogger(`[FULL]   Booking Reference: ${fulfillment?.bookingRef ?? 'Not available'}`);
				validationLogger(`[FULL]   Created On: ${fulfillment?.createdOn ?? 'Not available'}`);
				validationLogger(`[FULL]   Control Number: ${fulfillment?.controlNumber ?? 'Not available'}`);

				fulfillment?.bookingParts?.forEach((part, partIndex) => {
					validationLogger(`[FULL]     Booking Part ${partIndex + 1} Details:`);
					validationLogger(`[FULL]       Part ID: ${part?.id ?? 'Not available'}`);
					validationLogger(`[FULL]       Summary: ${part?.summary ?? 'Not available'}`);
				});

				validationLogger(`[FULL]   Fulfillment Documents: ${
					fulfillment?.fulfillmentDocuments?.length ?? 'None'
				}`);
			});
		} else {
			validationLogger(`[FULL] No fulfillments found.`);
		}
	} catch (error) {
		validationLogger(`[FULL] Error processing the booking data: ${error.message}`);
	}
};
// Function to log refund details
function logRefundDetails(refundOffer) {
	validationLogger("[INFO] Checking refund offer with Id: " + refundOffer.id);
	validationLogger("[INFO] ValidUntil: " + new Date(pm.variables.get("validUntilRefundOffers")));
	validationLogger("[INFO] Status: " + refundOffer.status);
}

// Function to validate fulfillments
function validateFulfillments(fulfillments, expectedStatus) {
	var fulfillmentStatus = "FULFILLED";
	if (expectedStatus == "CONFIRMED") {
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

// Function to validate refund fee
function validateRefundFee(refundFee) {
	// TODO: Implement validation logic for refund fee
	// Why? if a fee is configured this amount will not be zero. if present it should be a number.
	// pm.test("Refund fee equals to 0", function () {
	//     pm.expect(refundFee).to.have.property('amount').that.equals(0);
	// });
}

// Function to validate refundable amount
function validateRefundableAmount(refundOffer, overruleCode, bookingConfirmedPrice) {
	validationLogger("[INFO] BookingConfirmedPrice : " + bookingConfirmedPrice);
	validationLogger("[INFO] RefundOffer.refundableAmount.amount : " + refundOffer.refundableAmount.amount);
	validationLogger("[INFO] RefundOffer.refundFee.amount : " + refundOffer.refundFee.amount);
	validationLogger("[INFO] OverruleCode : " + overruleCode);

	if (overruleCode == null || overruleCode == "CODE_DOES_NOT_EXIST") {
		pm.test("Refundable amount is 0 because overruleCode is null or CODE_DOES_NOT_EXIST", function () {
			pm.expect(refundOffer.refundableAmount.amount).to.equal(0);
		});
	} else {
		pm.test("Refundable amount is VALID : refundOffer.refundableAmount.amount = " + refundOffer.refundableAmount.amount + " ⇔ bookingConfirmedPrice - refundOffer.refundFee.amount", function () {
			pm.expect(refundOffer.refundableAmount.amount).to.equal(bookingConfirmedPrice - refundOffer.refundFee.amount);
		});
	}
}

// Function to validate applied overrule code
function validateAppliedOverruleCode(appliedOverruleCode, expectedOverruleCode) {
	validationLogger("[INFO] ExpectedOverruleCode : " + expectedOverruleCode);
	validationLogger("[INFO] AppliedOverruleCode : " + appliedOverruleCode);
	if (expectedOverruleCode == null) {
		pm.test("AppliedOverruleCode is null as expected", function () {
			pm.expect(appliedOverruleCode).to.be.null;
		});
	} else {
		pm.test("AppliedOverruleCode is valid, compare appliedOverruleCode = " + appliedOverruleCode + " with expectedOverruleCode = " + expectedOverruleCode, function () {
			pm.expect(appliedOverruleCode).to.equal(expectedOverruleCode);
		});
	}
}

// Function to validate refund offer
function validateRefundOffer(refundOffer, expectedStatus) {
	logRefundDetails(refundOffer);

	// refundOffer is linked to a bookedOfferpart, being admission or reservation
	// for now, default to the first one found in the refundOffer
	pm.globals.set("refundOfferPartReference", refundOffer.fulfillments[0].bookingParts[0].id);

	pm.test("Refund offer has a valid ID", function () {
		pm.expect(refundOffer.id).to.exist;
		pm.globals.set("refundId", refundOffer.id);
	});

	pm.test("Correct status is returned on refund : " + expectedStatus, function () {
		pm.expect(refundOffer.status).to.equal(expectedStatus);
	});

	validateFulfillments(refundOffer.fulfillments, expectedStatus);

	var overruleCode = pm.globals.get("refundOverruleCode");
	validateAppliedOverruleCode(refundOffer.appliedOverruleCode, overruleCode);

	if (expectedStatus == "CONFIRMED") {
		const bookingConfirmedPrice = pm.globals.get("bookingConfirmedPrice");
		validateRefundableAmount(refundOffer, overruleCode, bookingConfirmedPrice);
		validateRefundFee(refundOffer.refundFee);
	} else if (expectedStatus == "PROPOSED") {
		pm.globals.set("refundRefundAmount", refundOffer.refundableAmount.amount);
		pm.globals.set("refundFee", refundOffer.refundFee.amount);
	}
}

// Function to check warnings and problems in the response
function checkWarningsAndProblems(response) {
	try {
		// Check and log warnings
		if (response.warnings) {
			validationLogger(`[WARNING] Warning: ${response.warnings}`);
		} else {
			validationLogger("[WARNING] No warnings found.");
		}

		// Check and log problems
		if (response.problems && response.problems.length > 0) {
			validationLogger(`Problems found (${response.problems.length}):`);
			response.problems.forEach((problem, index) => {
				validationLogger(`[WARNING]   Problem ${index + 1}:`);
				validationLogger(`[WARNING]     Code: ${problem.code || 'Not available'}`);
				validationLogger(`[WARNING]     Type: ${problem.type || 'Not available'}`);
				validationLogger(`[WARNING]     Title: ${problem.title || 'Not available'}`);
				validationLogger(`[WARNING]     Status: ${problem.status || 'Not available'}`);
				validationLogger(`[WARNING]     Detail: ${problem.detail || 'Not available'}`);

				if (problem.pointers && problem.pointers.length > 0) {
					problem.pointers.forEach((pointer, pointerIndex) => {
						validationLogger(`[WARNING]     Pointer ${pointerIndex + 1}:`);
						validationLogger(`[WARNING]       Code: ${pointer.code || 'Not available'}`);
						validationLogger(`[WARNING]       Request Pointer: ${pointer.requestPointer || 'Not available'}`);
					});
				} else {
					validationLogger("[WARNING]     No pointers found.");
				}
			});
		} else {
			validationLogger("[WARNING] No problems found.");
		}
	} catch (error) {
		validationLogger(`[WARNING] Error processing the response: ${error.message}`);
	}
}

// Function to validate refund offers response
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
		if (expectedStatus == "PROPOSED") {
			pm.globals.set("validUntilRefundOffers", refundOffer.validUntil);
			pm.test("ValidUntil is set for refundOffer", function () {
				pm.expect(refundOffer.validUntil).to.exist;
			});
		}
		validateRefundOffer(refundOffer, expectedStatus);
	});
}

// Function to validate booking response for refund
function validateBookingResponseRefund(response, refundType) {
	const booking = response.booking;

	if (refundType == "post" || refundType == "patch" || refundType == "delete") {
		let refundOfferPartReference = pm.globals.get("refundOfferPartReference");

		validationLogger("[INFO] RefundOfferPartReference : " + refundOfferPartReference);

		// Check if referenced part is an admission
		let refundOfferPart;

		if (booking.bookedOffers[0].admissions != null && booking.bookedOffers[0].admissions != undefined) {
			refundOfferPart = booking.bookedOffers[0].admissions.find(admission =>
				admission.id === refundOfferPartReference
			);
		}

		// Check if the referenced part is a reservation
		if ((refundOfferPart == null || refundOfferPart == undefined) &&
			(booking.bookedOffers[0].reservations != null && booking.bookedOffers[0].reservations != undefined)) {
			refundOfferPart = booking.bookedOffers[0].reservations.find(reservation =>
				reservation.id === refundOfferPartReference
			);
		}

		pm.globals.set("admissionsRefundAmount", booking.bookedOffers[0].admissions.refundAmount);
		if (booking.bookedOffers[0].reservations) {
			pm.globals.set("reservationsRefundAmount", booking.bookedOffers[0].reservations.refundAmount);
		}
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

			if (refundType == "post") {
				var expectedStatus = 'PROPOSED';
			} else if (refundType == "patch") {
				var expectedStatus = 'CONFIRMED';
			}
			validateFulfillments(refundOffer.fulfillments, expectedStatus);
			validateRefundFee(refundOffer.refundFee);

			const overruleCode = pm.globals.get("refundOverruleCode");
			const bookingConfirmedPrice = pm.globals.get("bookingConfirmedPrice");
			validateRefundableAmount(refundOffer, overruleCode, bookingConfirmedPrice);
		});
	} else if (refundType == "delete") {
		pm.test("Refund offers are not present, empty array returned", function () {
			pm.expect(booking).to.have.property("refundOffers").that.is.an("array");
			pm.expect(booking.refundOffers).to.be.empty;
		});
	}
}

// Function to validate passenger data
function validatePassengerData(response, passengerIndex) {
    const { firstName, lastName } = response.passenger?.detail || {};
    const dateOfBirth = response.passenger?.dateOfBirth;
    const { phoneNumber, email } = response.passenger?.detail?.contact || {};

    const passengerDataString = pm.globals.get("passengerAdditionalData");
    const passengerDataArray = JSON.parse(passengerDataString);
    const passenger = passengerDataArray[passengerIndex];

    validationLogger(`Comparing passenger ${passengerIndex} values after PATCH passenger infos`);
    validationLogger(`[INFO] Passenger firstName data to patch : ${passenger.patchFirstName} ⇔ found : ${firstName}`);
    validationLogger(`[INFO] Passenger lastName data to patch : ${passenger.patchLastName} ⇔ found : ${lastName}`);
    validationLogger(`[INFO] Passenger dateOfBirth data to patch : ${passenger.patchDateOfBirth} ⇔ found : ${dateOfBirth}`);
    validationLogger(`[INFO] Passenger phoneNumber data to patch : ${passenger.patchPhoneNumber} ⇔ found : ${phoneNumber}`);
    validationLogger(`[INFO] Passenger email data to patch : ${passenger.patchEmail} ⇔ found : ${email}`);	

    pm.test(`Passenger ${passengerIndex} data is valid`, function () {
        pm.expect(firstName, `First name for passenger ${passengerIndex}`).to.equal(passenger.patchFirstName);
        pm.expect(lastName, `Last name for passenger ${passengerIndex}`).to.equal(passenger.patchLastName);
        pm.expect(dateOfBirth, `Date of birth for passenger ${passengerIndex}`).to.equal(passenger.patchDateOfBirth);
        pm.expect(phoneNumber, `Phone number for passenger ${passengerIndex}`).to.equal(passenger.patchPhoneNumber);
        pm.expect(email, `Email for passenger ${passengerIndex}`).to.equal(passenger.patchEmail);
    });
}

// Function to validate passenger fields
function validatePassengerFields(passengerData) {

}

// Function to create request body for refund offers
function requestRefundOffersBody(overruleCode, refundDate) {
	const fulfillmentId = pm.globals.get('fulfillmentsId');

	const body = {
		fulfillmentIds: [fulfillmentId],
		...(overruleCode && { overruleCode }),
		...(refundDate && { refundDate })
	};

	pm.globals.set("requestRefundOffersBodyData", JSON.stringify(body));
}

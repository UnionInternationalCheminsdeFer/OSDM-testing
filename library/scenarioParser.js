// Function to get scenario data
getScenarioData = function () {
	validationLogger("[INFO] ⏳ Getting scenario data");
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
				validationLogger("[DEBUG] 🪲 DUMMYAA")

				// Validate JSON with template
				validateJsonWithTemplate(pm.globals.get("data_base_tmp"));
				validationLogger("[DEBUG] 🪲 DUMMYAA")
				console.log("DUMMY")

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

// Function to parse scenario data from JSON
parseScenarioData = function(jsonData) {
	// Get the next weekday date
	var nextWeekday = get_next_weekday(new Date());
	var nextWeekdayString = "" + nextWeekday.getUTCFullYear() + "-" + pad(nextWeekday.getUTCMonth()+1) + "-" + pad(nextWeekday.getUTCDate()+1);

	var dataFileIndex = 0;
	var dataFileLength = jsonData.scenarios.length;
	var foundCorrectDataSet = false;
	var scenarioCodes = [];

	// Loop through the scenarios to find the correct data set
	while(foundCorrectDataSet==false && dataFileIndex<dataFileLength) {
		validationLogger("[DEBUG] 🪲 DUMMYA")

		// Check if the scenario code matches
		if(jsonData.scenarios[dataFileIndex].code==scenarioCode) {
			scenarioCodes.push(jsonData.scenarios[dataFileIndex].code);

			// Loop through trip requirements to find the matching trip requirement ID
			jsonData.tripRequirements.some(function(tripRequirement){
				if(tripRequirement.id==jsonData.scenarios[dataFileIndex].tripRequirementId){

					// Set the trip type in global variables
					pm.globals.set("TripType",tripRequirement.tripType);
					validationLogger("[DEBUG] 🪲 DUMMYAA")

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
							validationLogger("[DEBUG] 🪲 DUMMYBB")

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
			pm.globals.set("ScenarioCode", jsonData.scenarios[dataFileIndex].code);
			validationLogger("[DEBUG] 🪲 DUMMY0")

			// Purchaser details
			jsonData.purchaserList.some(function(purchaserList){
				validationLogger('[INFO] Found number of purchaser: '+purchaserList.purchaser.length);
				var purchaserSpecs = [];
				purchaserList.purchaser.forEach(function(purchaser){
					validationLogger("[DEBUG] 🪲 DUMMY1")

					var osdmVersion = pm.globals.get("osdmVersion");
					if (osdmVersion == "3.4" || osdmVersion == "3.5") {
						purchaserSpecs.push(new PurchaserContact(
							new DetailContact(
								purchaser.purchaserFirstName,
								purchaser.purchaserLastName,
								new Contact(
									purchaser.purchaserEmail,
									purchaser.purchaserPhoneNumber
								)
							)
						));
					} else {
						purchaserSpecs.push(new Purchaser(
							new Detail(
								purchaser.purchaserFirstName,
								purchaser.purchaserLastName,
								purchaser.purchaserEmail,
								purchaser.purchaserPhoneNumber
							)
						));
					}

				});
				validationLogger("[DEBUG] 🪲 DUMMY4")

				validationLogger('[INFO] Pushed purchaserSpec to globals: '+JSON.stringify(purchaserSpecs));
				pm.globals.set("bookingPurchaserSpecifications", JSON.stringify(purchaserSpecs[0]));
				return true;
			});

			// Loop through the passengers list to find the matching passengers list ID
			jsonData.passengersList.some(function(passengersList){
				if(passengersList.id==jsonData.scenarios[dataFileIndex].passengersListId){
					validationLogger('[INFO] Found number of passengers: '+passengersList.passengers.length);
					pm.globals.set("offerPassengerNumber", passengersList.passengers.length);
					var offerPassengerSpecs = [];
					var passengerSpecs = [];
					var passengerReferences = [];
					var passengerAdditionalData = [];
					var passengerIndex = 0;
					// Loop through the passengers and set global variables for each passenger
					passengersList.passengers.forEach(function(passenger){
						var passengerKey = "passengerSpecification%PASSENGER_COUNT%ExternalRef".replace("%PASSENGER_COUNT%", (passengerIndex+1));
						pm.globals.set(passengerKey, uuid.v4());
						offerPassengerSpecs.push(new AnonymousPassengerSpec(
							//pm.globals.get(passengerKey),
							passenger.reference,
							passenger.type,
							passenger.dateOfBirth,
							passenger.gender || "X",
						));
						validationLogger("[DEBUG] 🪲 DUMMY1")

						var osdmVersion = pm.globals.get("osdmVersion");
						if (osdmVersion == "3.4" || osdmVersion == "3.5") {
							passengerSpecs.push(new PassengerSpec(
								//pm.globals.get(passengerKey),
								passenger.reference,
								passenger.type,
								passenger.dateOfBirth,
								passenger.gender || "X",
								new DetailContact(
									passenger.firstName,
									passenger.lastName,
									new Contact(
										passenger.email || null,
										passenger.phoneNumber || null
									)
								)
							));
						} else {							
							passengerSpecs.push(new PassengerSpec(
								//pm.globals.get(passengerKey),
								passenger.reference,
								passenger.type,
								passenger.dateOfBirth,
								passenger.gender || "X",
								new Detail(
									passenger.firstName,
									passenger.lastName,
									passenger.email || null,
									passenger.phoneNumber || null
								)
							));
						}
						validationLogger("[DEBUG] 🪲 DUMMY3")
						passengerReferences.push(passenger.reference);
						//passengerReferences.push(pm.globals.get(passengerKey));

						let passengerAdditionalDataStruct = {
							updateFirstName: passenger.updateFirstName,
							updateLastName: passenger.updateLastName,
							updateDateOfBirth: passenger.updateDateOfBirth,
							updateEmail: passenger.updateEmail,
							updatePhoneNumber: passenger.updatePhoneNumber,
							updateGender: passenger.updateGender || passenger.gender || "X",
						};
						passengerAdditionalData.push(passengerAdditionalDataStruct);
						passengerIndex++;
					});
					validationLogger("[DEBUG] 🪲 DUMMY4")

					validationLogger('[INFO] Pushed passengerSpec to globals: '+JSON.stringify(passengerSpecs));
					pm.globals.set("offerPassengerSpecifications", JSON.stringify(offerPassengerSpecs));
					pm.globals.set("bookingPassengerSpecifications", JSON.stringify(passengerSpecs));
					pm.globals.set("bookingPassengerReferences", JSON.stringify(passengerReferences));
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

			// Loop through the offer search criteria list to find the matching offer search criteria ID
			if (Array.isArray(jsonData.offerSearchCriteriaList) && jsonData.offerSearchCriteriaList.length > 0) {
				jsonData.offerSearchCriteriaList.some(function (offerSearchCriteriaItem) {
					if (offerSearchCriteriaItem.id == jsonData.scenarios[dataFileIndex].offerSearchCriteriaListId) {
						osdmOfferSearchCriteria(
							offerSearchCriteriaItem.offerSearchCriteria[0].currency || null,
							offerSearchCriteriaItem.offerSearchCriteria[0].offerMode || null,
							offerSearchCriteriaItem.offerSearchCriteria[0].requestedOfferParts,
							offerSearchCriteriaItem.offerSearchCriteria[0].flexibilities || null,
							offerSearchCriteriaItem.offerSearchCriteria[0].serviceClass || null,
							offerSearchCriteriaItem.offerSearchCriteria[0].travelClass || null,
							null
						);
						return true;
					}
				});
			} else {
				validationLogger("[ERROR] offerSearchCriteriaList is empty or not an array.");
			}
			// Loop through the requested fulfillment options list to find the matching fulfillment options ID
			if (Array.isArray(jsonData.requestedFulfillmentOptionsList) && jsonData.requestedFulfillmentOptionsList.length > 0) {
				jsonData.requestedFulfillmentOptionsList.some(function(requestedFulfillmentOptionList) {
					if (requestedFulfillmentOptionList.id == jsonData.scenarios[dataFileIndex].requestedFulfillmentOptionsListId) {
						var requestedFulfillmentOptions = [];
						requestedFulfillmentOptionList.requestedFulfillmentOptions.forEach(function(requestedFulfillmentOption) {
							const fulfillmentType = requestedFulfillmentOption.fulfillmentType ?? null;
							const fulfillmentMedia = requestedFulfillmentOption.fulfillmentMedia ?? null;
							
							if (fulfillmentType != null && fulfillmentMedia != null) {
								requestedFulfillmentOptions.push(new FulfillmentOption(fulfillmentType, fulfillmentMedia));
							}
						});
			
						osdmFulfillmentOptions(requestedFulfillmentOptions);
						return true;
					}
				});
			} else {
				validationLogger("[INFO] requestedFulfillmentOptionsList is empty");
			}
			foundCorrectDataSet = true;
			validationLogger("[INFO] ✅ Correct data set was found for this scenario : "+scenarioCode);
		}
		dataFileIndex++;
	}
	if(foundCorrectDataSet==false) {
		throw new Error("[ERROR] ⛔ Wrong scenario code. No data set found for this scenario : "+scenarioCode);
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
	pm.globals.set("offerTripSearchCriteria", JSON.stringify(tripSearchCriteria));
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
	pm.globals.set("offerTripSpecifications", JSON.stringify([tripSpecification]));
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
	pm.globals.set("offerSearchCriteria", JSON.stringify(offerSearchCriteria));
};

// Function to set fulfillment options
osdmFulfillmentOptions = function(requestedFulfillmentOptions) {
	// Set fulfillment options in global variables if provided
	if (Array.isArray(requestedFulfillmentOptions) && requestedFulfillmentOptions.length > 0) {
		pm.globals.set("offerFulfillmentOptions", JSON.stringify(requestedFulfillmentOptions));
	}
};
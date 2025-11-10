// Function to get scenario data
getScenarioData = function () {
	validationLogger("[DEBUG] 🪲 getScenarioData")
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
				pm.environment.set("data_base_tmp", jsonData);

				// Validate JSON with template
				validationLogger(`[INFO] 🛠️ Check data file structure schema`);
				validateDataFileJsonWithTemplate(pm.environment.get("data_base_tmp"));
				validationLogger("[DEBUG] 🪲 getScenarioData")

				parseScenarioData(jsonData);
			}
		});
	} else if (pm.environment.has('data_file')) {

		// Validate JSON with template
		validateDataFileJsonWithTemplate(JSON.parse(pm.environment.get("data_file")));

		// If data file is set, parse the scenario data from the file
		validationLogger("[INFO] Data file was set, expecting running in postman");
		parseScenarioData(JSON.parse(pm.environment.get("data_file")));
	} else {
		validationLogger("[INFO] Please specify using a data_file or data_base parameter in the environment used.");
	}
}

// Function to parse scenario data from JSON
parseScenarioData = function (jsonData) {

	//TODO implement data file date in scenario structure with departureDateFromToday ?
	//TODO implement data file date in scenario structure with departureTimeFromToday ?
	//const plusDays = parseInt(pm.environment.get("departureDateFromToday")) || 0;

	const plusDays = 2;
	const today = new Date();

	today.setDate(today.getDate() + plusDays);

	function pad(n) {
		return n.toString().padStart(2, '0');
	}

	const nextWeekdayString = today.getFullYear() + "-" +
		pad(today.getMonth() + 1) + "-" +
		pad(today.getDate());

	//TODO Keeper in environment ?					
	//pm.environment.set("calculated_date", nextWeekdayString);

	var dataFileIndex = 0;
	var dataFileLength = jsonData.scenarios.length;
	var foundCorrectDataSet = false;
	var scenarioCodes = [];

	// Loop through the scenarios to find the correct data set
	while (foundCorrectDataSet == false && dataFileIndex < dataFileLength) {
		validationLogger("[DEBUG] 🪲 DUMMYA " + jsonData.scenarios[dataFileIndex].code + " " + scenarioCode)


		// Check if the scenario code matches
		if (jsonData.scenarios[dataFileIndex].code == scenarioCode) {
			scenarioCodes.push(jsonData.scenarios[dataFileIndex].code);

			// Set global variables for the scenario
			pm.environment.set("loggingType", ["", "null"].includes(jsonData.scenarios[dataFileIndex].loggingType) ? null : jsonData.scenarios[dataFileIndex].loggingType);
			pm.environment.set("osdmVersion", ["", "null"].includes(jsonData.scenarios[dataFileIndex].osdmVersion) ? null : jsonData.scenarios[dataFileIndex].osdmVersion);
			pm.environment.set("scenarioType", ["", "null"].includes(jsonData.scenarios[dataFileIndex].scenarioType) ? null : jsonData.scenarios[dataFileIndex].scenarioType);
			pm.environment.set("scenarioAction", ["", "null"].includes(jsonData.scenarios[dataFileIndex].scenarioAction) ? null : jsonData.scenarios[dataFileIndex].scenarioAction);
			pm.environment.set("overruleCode", ["", "null"].includes(jsonData.scenarios[dataFileIndex].overruleCode) ? null : jsonData.scenarios[dataFileIndex].overruleCode);
			pm.environment.set("refundDate", ["", "null"].includes(jsonData.scenarios[dataFileIndex].refundDate) ? null : jsonData.scenarios[dataFileIndex].refundDate);
			pm.environment.set("desiredFlexibility", ["", "null"].includes(jsonData.scenarios[dataFileIndex].desiredFlexibility) ? null : jsonData.scenarios[dataFileIndex].desiredFlexibility);
			pm.environment.set("accommodationSelection", ["", "null"].includes(jsonData.scenarios[dataFileIndex].accommodationSelection) ? null : jsonData.scenarios[dataFileIndex].accommodationSelection);
			pm.environment.set("requiresPlaceSelection", ["", "null"].includes(jsonData.scenarios[dataFileIndex].requiresPlaceSelection) ? null : jsonData.scenarios[dataFileIndex].requiresPlaceSelection);
			pm.environment.set("scenarioCode", jsonData.scenarios[dataFileIndex].code);
			validationLogger("[DEBUG] 🪲 parseScenarioData2")

			// Loop through trip requirements to find the matching trip requirement ID
			jsonData.tripRequirements.some(function (tripRequirement) {
				if (tripRequirement.id == jsonData.scenarios[dataFileIndex].tripRequirementId) {

					// Set the trip type in global variables
					pm.environment.set("TripType", tripRequirement.tripType);

					// Process the trip type
					switch (tripRequirement.tripType) {
						case "SPECIFICATION":
							validationLogger('[INFO] ⏳ processing a specification');
							var legDefinitions = [];

							// Loop through the legs and set global variables for each leg
							tripRequirement.legs.forEach(function (leg, legIndex) {
								const legPrefix = `leg${legIndex + 1}`;
								const startDatetime = leg.startDatetime.replace("%TRIP_DATE%", nextWeekdayString);
								const endDatetime = leg.endDatetime.replace("%TRIP_DATE%", nextWeekdayString);

								pm.environment.set(`${legPrefix}StartStopPlaceRef`, leg.origin);
								pm.environment.set(`${legPrefix}EndStopPlaceRef`, leg.destination);
								pm.environment.set(`${legPrefix}StartDatetime`, startDatetime);
								pm.environment.set(`${legPrefix}EndDatetime`, endDatetime);
								pm.environment.set(`${legPrefix}VehicleNumber`, leg.vehicleNumber);
								pm.environment.set(`${legPrefix}OperatorCode`, leg.operatorCode);
								pm.environment.set(`${legPrefix}ProductCategoryRef`, leg.productCategoryRef || null);
								pm.environment.set(`${legPrefix}ProductCategoryName`, leg.productCategoryName || null);
								pm.environment.set(`${legPrefix}ProductCategoryShortName`, leg.productCategoryShortName || null);
								validationLogger("[DEBUG] 🪲 parseScenarioData1")

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
							pm.environment.set("tripStartStopPlaceRef", tripRequirement.trip.origin);
							pm.environment.set("tripEndStopPlaceRef", tripRequirement.trip.destination);
							pm.environment.set("tripStartDatetime", tripRequirement.trip.startDatetime.replace("%TRIP_DATE%", nextWeekdayString));
							pm.environment.set("tripEndDatetime", tripRequirement.trip.endDatetime.replace("%TRIP_DATE%", nextWeekdayString));
							pm.environment.set("tripVehicleNumber", tripRequirement.trip.vehicleNumber);
							pm.environment.set("tripOperatorCode", tripRequirement.trip.operatorCode);
							pm.environment.set("tripProductCategoryRef", tripRequirement.trip.productCategoryRef || null);
							pm.environment.set("tripProductCategoryName", tripRequirement.trip.productCategoryName || null);
							pm.environment.set("tripProductCategoryShortName", tripRequirement.trip.productCategoryShortName || null);
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

			// Purchaser details
			jsonData.purchaserList.some(function (purchaserList) {
				validationLogger('[INFO] Found number of purchaser: ' + purchaserList.purchaser.length);
				var purchaserSpecs = [];
				purchaserList.purchaser.forEach(function (purchaser) {
					var osdmVersion = pm.environment.get("osdmVersion");
					if (parseFloat(osdmVersion) >= 3.4) {
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

				validationLogger('[INFO] Pushed purchaserSpec to environment: ' + JSON.stringify(purchaserSpecs));
				pm.environment.set("bookingPurchaserSpecifications", JSON.stringify(purchaserSpecs[0]));
				return true;
			});

			// Loop through the passengers list to find the matching passengers list ID
			jsonData.passengersList.some(function (passengersList) {
				if (passengersList.id == jsonData.scenarios[dataFileIndex].passengersListId) {
					validationLogger('[INFO] Found number of passengers: ' + passengersList.passengers.length);
					pm.environment.set("offerPassengerNumber", passengersList.passengers.length);
					var offerPassengerSpecs = [];
					var passengerSpecs = [];
					var passengerReferences = [];
					var passengerAdditionalData = [];
					var passengerIndex = 0;
					// Loop through the passengers and set global variables for each passenger
					passengersList.passengers.forEach(function (passenger) {
						var passengerKey = "passengerSpecification%PASSENGER_COUNT%ExternalRef".replace("%PASSENGER_COUNT%", (passengerIndex + 1));
						pm.environment.set(passengerKey, uuid.v4());
						offerPassengerSpecs.push(new AnonymousPassengerSpec(
							//pm.environment.get(passengerKey),
							passenger.reference,
							passenger.type,
							passenger.dateOfBirth,
							passenger.gender || null,
						));

						var osdmVersion = pm.environment.get("osdmVersion");
						if (parseFloat(osdmVersion) > 3.4) {
							passengerSpecs.push(new PassengerSpec(
								//pm.environment.get(passengerKey),
								//TODO : Remove gender from passenger spec if not set
								passenger.reference,
								passenger.type,
								passenger.dateOfBirth,
								passenger.gender || null,
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
								//pm.environment.get(passengerKey),
								passenger.reference,
								passenger.type,
								passenger.dateOfBirth,
								passenger.gender || null,
								new Detail(
									passenger.firstName,
									passenger.lastName,
									passenger.email || null,
									passenger.phoneNumber || null
								)
							));
						}
						passengerReferences.push(passenger.reference);
						//passengerReferences.push(pm.environment.get(passengerKey));

						let passengerDataStruct = {
							updateFirstName: passenger.firstName,
							updateLastName: passenger.lastName,
							updateDateOfBirth: passenger.dateOfBirth,
							updateEmail: passenger.email,
							updatePhoneNumber: passenger.phoneNumber,
							updateGender: passenger.gender ?? "X",
						};

						let passengerAdditionalDataStruct = {
							updateFirstName: passenger.updateFirstName ?? passengerDataStruct.updateFirstName,
							updateLastName: passenger.updateLastName ?? passengerDataStruct.updateLastName,
							updateDateOfBirth: passenger.updateDateOfBirth ?? passengerDataStruct.updateDateOfBirth,
							updateEmail: passenger.updateEmail ?? passengerDataStruct.updateEmail,
							updatePhoneNumber: passenger.updatePhoneNumber ?? passengerDataStruct.updatePhoneNumber,
							updateGender: passenger.updateGender ?? passengerDataStruct.updateGender,
						};

						passengerAdditionalData.push(passengerAdditionalDataStruct);
						passengerIndex++;
					});

					validationLogger('[INFO] Pushed passengerSpec to environment: ' + JSON.stringify(passengerSpecs));
					pm.environment.set("offerPassengerSpecifications", JSON.stringify(offerPassengerSpecs));
					pm.environment.set("bookingPassengerSpecifications", JSON.stringify(passengerSpecs));
					pm.environment.set("bookingPassengerReferences", JSON.stringify(passengerReferences));
					pm.environment.set("passengerAdditionalData", JSON.stringify(passengerAdditionalData));
					let passengerData = pm.environment.get("passengerAdditionalData");
					passengerData = JSON.parse(passengerData);
					passengerData.forEach((data, index) => {
						Object.entries(data).forEach(([key, value]) => {
							pm.environment.set(`${key}_${index}`, value);
						});
					});
					return true;
				}
			});

			// Loop through the offer search criteria list to find the matching offer search criteria ID
			if (Array.isArray(jsonData.offerSearchCriteriaList) && jsonData.offerSearchCriteriaList.length > 0) {
				jsonData.offerSearchCriteriaList.some(function (offerSearchCriteriaItem) {
					if (offerSearchCriteriaItem.id === jsonData.scenarios[dataFileIndex].offerSearchCriteriaListId) {

						// Use the first offerSearchCriteria if the array exists and is not empty
						const criteriaList = offerSearchCriteriaItem.offerSearchCriteria;
						if (Array.isArray(criteriaList) && criteriaList.length > 0) {
							const criteria = criteriaList.find(c =>
								// Optional: refine condition to match a specific scenario if needed
								true // or some matching condition
							);

							if (criteria) {
								osdmOfferSearchCriteria(
									criteria.currency || null,
									criteria.offerMode || null,
									criteria.requestedOfferParts,
									criteria.flexibilities || null,
									criteria.serviceClass || null,
									criteria.travelClass || null,
									null
								);
							} else {
								validationLogger(`[WARN] No matching offerSearchCriteria found in list for ID '${offerSearchCriteriaItem.id}'`);
							}
						} else {
							validationLogger(`[WARN] No offerSearchCriteria array found or it's empty in offerSearchCriteriaItem with ID '${offerSearchCriteriaItem.id}'`);
						}

						return true; // break the .some() loop
					}
				});
			} else {
				validationLogger("[ERROR] offerSearchCriteriaList is empty or not an array.");
			}
			// Loop through the requested fulfillment options list to find the matching fulfillment options ID
			if (Array.isArray(jsonData.requestedFulfillmentOptionsList) && jsonData.requestedFulfillmentOptionsList.length > 0) {
				jsonData.requestedFulfillmentOptionsList.some(function (requestedFulfillmentOptionList) {
					if (requestedFulfillmentOptionList.id == jsonData.scenarios[dataFileIndex].requestedFulfillmentOptionsListId) {
						var requestedFulfillmentOptions = [];
						requestedFulfillmentOptionList.requestedFulfillmentOptions.forEach(function (requestedFulfillmentOption) {
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
			validationLogger("[INFO] ✅ Correct data set was found for this scenario : " + scenarioCode);
		}
		dataFileIndex++;
	}
	if (foundCorrectDataSet == false) {
		validationLogger("[ERROR] ⛔ Wrong scenario code. No data set found for this scenario : " + scenarioCode);
		validationLogger("[INFO] Stop execution");
		pm.setNextRequest(null);
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
			legDef.startDateTime.substring(0, legDef.startDateTime.length - 6),
			new StopPlaceRef(legDef.startStopPlaceRef),
			new StopPlaceRef(legDef.endStopPlaceRef),
			null
		);
	} else {
		var tripSearchCriteria = new TripSearchCriteria(
			legDef.startDateTime.substring(0, legDef.startDateTime.length - 6),
			new StopPlaceRef(legDef.startStopPlaceRef),
			new StopPlaceRef(legDef.endStopPlaceRef),
			tripParameters
		);
	}

	// Set trip search criteria in global variables
	pm.environment.set("offerTripSearchCriteria", JSON.stringify(tripSearchCriteria));
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
	pm.environment.set(TRIP.EXTERNAL_REF, uuid.v4());

	var legSpecs = [];

	// Loop through the leg definitions and set global variables for each leg
	for (let n = 1; n <= legDefinitions.length; n++) {
		var legKey = TRIP.LEG_SPECIFICATION_REF_PATTERN.replace("%LEG_COUNT%", n);
		var legDef = legDefinitions[n - 1];

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

		pm.environment.set(legKey, uuid.v4());

		// Add the leg specification to the array
		legSpecs.push(new TripLegSpecification(
			pm.environment.get(legKey),
			timedLegSpec
		));
	}

	var tripSpecification = new TripSpecification(
		pm.environment.get(TRIP.EXTERNAL_REF),
		legSpecs
	);

	// Set trip specifications in global variables
	pm.environment.set("offerTripSpecifications", JSON.stringify([tripSpecification]));
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
	if (offerMode != null && offerMode != '') {
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
	pm.environment.set("offerSearchCriteria", JSON.stringify(offerSearchCriteria));
};

// Function to set fulfillment options
osdmFulfillmentOptions = function (requestedFulfillmentOptions) {
	// Set fulfillment options in global variables if provided
	if (Array.isArray(requestedFulfillmentOptions) && requestedFulfillmentOptions.length > 0) {
		pm.environment.set("offerFulfillmentOptions", JSON.stringify(requestedFulfillmentOptions));
	}
};
let totalProvisionalOrBookingPrice = 0;

postCreateBookingResponse = function (selectedOffer, jsonData, expectedBookedOffersStatus, expectedFulfillmentStatus) {
    validationLogger("[INFO] ➤ postCreateBookingResponse");
    // Stop flow if booking invalid
    if (typeof jsonData.booking !== 'object' || jsonData.booking === null) {
        validationLogger("[ERROR] No booking found or 'booking' is not an object.");
        pm.execution.setNextRequest(null);
        return;
    }

    // Check booking exists
    pm.test(`'booking' object exists`, () => {
        pm.expect(jsonData.booking, "[ERROR] 'booking' is missing or empty").to.be.an("object").that.is.not.empty;
        validationLogger(`[INFO] 🔍 'booking' object exists`);
    });

    // Check booking id and booking code
    pm.test(`Booking Id : ${jsonData.booking.id} and Booking code : ${jsonData.booking.bookingCode} are returned`, () => {
        validationLogger(`[INFO] Booking Id : ${jsonData.booking.id} and Booking code : ${jsonData.booking.bookingCode} are returned`);
        pm.expect(jsonData.booking.id).to.be.a('string').and.not.be.empty;
        pm.expect(jsonData.booking.bookingCode).to.be.a('string').and.not.be.empty;
    });
    pm.environment.set("bookingId", jsonData.booking.id);

    //TODO passenger structure should be the same from data file, to compare ?
    // Passengers setup
    const passengerIdList = [];
    if (jsonData.booking?.passengers?.length > 0) {
        jsonData.booking.passengers.forEach((passenger, i) => {
            if (passenger.id) {
                passengerIdList.push(passenger.id);
            } else {
                validationLogger(`[WARNING] ⚠️ Passenger at index ${i} has no ID.`);
            }
        });
    } else {
        validationLogger("[ERROR] Passengers structure is invalid or empty.");
    }
    validationLogger(`[FULL] Passenger IDs: [${passengerIdList}]`);
    pm.environment.set("passengerIdList", passengerIdList);

    // Check booking.createdOn > offer.createdOn
    const bookingDate = new Date(jsonData.booking.createdOn);
    const offerDate = new Date(selectedOffer.createdOn);
    if (!isNaN(bookingDate.getTime()) && !isNaN(offerDate.getTime())) {
        pm.test(`booking.createdOn: ${bookingDate.toISOString()}, offer.createdOn: ${offerDate.toISOString()}`, () => {
            validationLogger(`[INFO] booking.createdOn: ${bookingDate.toISOString()}, offer.createdOn: ${offerDate.toISOString()}`);
            pm.expect(bookingDate.getTime()).to.be.above(offerDate.getTime());
        });
    } else {
        validationLogger(`[WARNING] Invalid date - bookingDate: ${jsonData.booking.createdOn}, offerDate: ${selectedOffer.createdOn}`);
    }

    // Check price structures exist
    const prov = jsonData.booking.provisionalPrice;
    const mini = selectedOffer.offerSummary.minimalPrice;
    const confirmed = jsonData.booking.confirmedPrice;
    pm.test(`provisionalPrice structure exists `, () => {
        pm.expect(prov, `provisionalPrice missing`).to.exist;
        validationLogger(`[INFO] provisionalPrice structure exists`);
    });

    pm.test(`confirmedPrice structure exists `, () => {
        pm.expect(confirmed, `confirmedPrice missing`).to.exist;
        validationLogger(`[INFO] confirmedPrice structure exists`);
    });

    // Check all price fields (amount, currency, scale) exist
    pm.test(`Price fields exist (currency, scale) in provisionalPrice and confirmedPrice`, () => {
        ['currency', 'scale'].forEach(field => {
            pm.expect(prov[field], `provisionalPrice.${field} missing`).to.exist;
            pm.expect(confirmed[field], `confirmedPrice.${field} missing`).to.exist;
        });
        pm.environment.set("provisionalPriceAmount", prov.amount);
        pm.environment.set("confirmedPriceAmount", confirmed.amount);
        validationLogger(`[INFO] provisionalPrice and confirmedPrice fields present`);
    });

    if (pm.info.requestName === "03. POST Create Booking" || pm.info.requestName === "07. GET Booking before Fulfillments") {
        // Verify provisionalPrice booking equals minimalPrice offer
        pm.test(`provisionalPrice matches minimalPrice: ${prov.amount} ${prov.currency} (scale: ${prov.scale})`, () => {
            pm.expect(prov.amount).to.eql(mini.amount);
            pm.expect(prov.currency).to.eql(mini.currency);
            pm.expect(prov.scale).to.eql(mini.scale);
            validationLogger(`[INFO] provisionalPrice matches minimalPrice: ${prov.amount} ${prov.currency} (scale: ${prov.scale})`);
        });
    }
    // Function to validate offer parts against booked parts
    const validateOfferParts = (offerParts, bookedParts, partType) => {
        offerParts.forEach((part, index) => {
            const admissionReservationAncillaryBookingPartsIds = pm.environment.get("admissionReservationAncillaryBookingPartsIds") || [];
            const bookedPart = bookedParts[index];

            // check bookedPart exists
            if (!bookedPart) {
                validationLogger(`[WARNING] No booked ${partType}[${index}] found for offer part id=${part.id}`);
                return;
            } else {
                admissionReservationAncillaryBookingPartsIds.push(bookedPart.id);
                pm.environment.set("admissionReservationAncillaryBookingPartsIds", admissionReservationAncillaryBookingPartsIds);
            }

            // check exchangeable, isReservationRequired, refundable, offerMode
            ['exchangeable', 'refundable'].forEach(field => {
                // Collect all values from offer and booking for this field
                const offerValues = offerParts.map(p => p[field]).filter(v => v != null);
                const bookingValues = bookedParts.map(p => p[field]).filter(v => v != null);

                if (offerValues.length > 0 && bookingValues.length > 0) {
                    pm.test(`${partType} ${field} values match between offer and booking (order-independent) offer=[${offerValues}] booking=[${bookingValues}]`, () => {
                        pm.expect(bookingValues).to.have.members(offerValues);
                        pm.expect(offerValues).to.have.members(bookingValues);
                        validationLogger(`[INFO] ${partType} ${field}: offer=[${offerValues}] booking=[${bookingValues}]`);
                    });
                } else if (offerValues.length === 0 && bookingValues.length === 0) {
                    validationLogger(`[INFO] ${partType}: '${field}' is empty in both offer and booking`);
                } else {
                    validationLogger(`[WARNING] ${partType}: '${field}' missing - offer has ${offerValues.length} values, booking has ${bookingValues.length} values`);
                }
            });

            // check isReservationRequired, offerMode (keep individual comparison)
            ['isReservationRequired', 'offerMode'].forEach(field => {
                if (part[field] != null && bookedPart[field] != null) {
                    pm.test(`${partType}[${index}].${field} matches between offer and booking : offer='${part[field]}' booking='${bookedPart[field]}'`, () => {
                        pm.expect(bookedPart[field]).to.eql(part[field]);
                        validationLogger(`[INFO] ${partType}[${index}].${field}: offer='${part[field]}' booking='${bookedPart[field]}'`);
                    });
                } else {
                    validationLogger(`[WARNING] ${partType}[${index}]: '${field}' missing in offer or booking`);
                }
            });

            // check status PREBOOKED, FULFILLED, CONFIRMED
            pm.test(`Status is ${expectedBookedOffersStatus} for ${partType}[${index}] - expected: ${expectedBookedOffersStatus}, actual: ${bookedPart.status}`, () => {
                if (Array.isArray(expectedBookedOffersStatus)) {
                    pm.expect(expectedBookedOffersStatus).to.include(bookedPart.status);
                } else {
                    pm.expect(bookedPart.status).to.eql(expectedBookedOffersStatus);
                }
                validationLogger(`[INFO] ${partType}[${index}]: status: ${bookedPart.status}`);
            });

            // check price - collect all prices and compare as arrays
            const offerPrices = offerParts
                .filter(p => p.price)
                .map(p => ({ amount: p.price.amount, currency: p.price.currency, scale: p.price.scale }));

            const bookingPrices = bookedParts
                .filter(p => p.price)
                .map(p => ({ amount: p.price.amount, currency: p.price.currency, scale: p.price.scale }));

            if (offerPrices.length > 0 && bookingPrices.length > 0) {
                pm.test(`${partType} prices match between offer and booking (order-independent)`, () => {
                    pm.expect(offerPrices.length).to.equal(bookingPrices.length);

                    // Compare each price field
                    ['amount', 'currency', 'scale'].forEach(field => {
                        const offerValues = offerPrices.map(p => p[field]);
                        const bookingValues = bookingPrices.map(p => p[field]);

                        pm.expect(bookingValues).to.have.members(offerValues);
                        pm.expect(offerValues).to.have.members(bookingValues);

                        validationLogger(`[INFO] ${partType} price.${field}: offer=[${offerValues}] booking=[${bookingValues}]`);
                    });
                });
            } else if (offerPrices.length === 0 && bookingPrices.length === 0) {
                validationLogger(`[INFO] ${partType}: 'price' is empty in both offer and booking`);
            } else {
                validationLogger(`[WARNING] ${partType}: 'price' missing - offer has ${offerPrices.length} prices, booking has ${bookingPrices.length} prices`);
            }

            // Validity dates
            ['validFrom', 'validUntil'].forEach(field => {
                if (part[field] && bookedPart[field]) {
                    const partDate = new Date(part[field]);
                    const bookedPartDate = new Date(bookedPart[field]);

                    if (!isNaN(partDate.getTime()) && !isNaN(bookedPartDate.getTime())) {
                        pm.test(`${partType}[${index}].${field} is present in both offer and booking`, () => {
                            pm.expect(part[field]).to.exist;
                            pm.expect(bookedPart[field]).to.exist;
                            validationLogger(`[INFO] ${partType}[${index}].${field}: offer='${part[field]}' booking='${bookedPart[field]}'`)
                        });
                    } else {
                        validationLogger(`[WARNING] ${partType}[${index}] ${field} has invalid date format`);
                    }
                } else {
                    validationLogger(`[WARNING] ${partType}[${index}] ${field} missing in offer or booking`);
                }
            });

            // After-sale conditions - Complete structure comparison
            if (Array.isArray(part.afterSalesConditions) && part.afterSalesConditions.length > 0) {
                pm.test(`${partType}[${index}] afterSalesConditions exist in both offer and booking`, () => {
                    pm.expect(bookedPart.afterSalesConditions, `afterSalesConditions missing in booking`).to.exist;
                    pm.expect(bookedPart.afterSalesConditions).to.be.an('array');
                    validationLogger(`[INFO] ${partType}[${index}] has ${part.afterSalesConditions.length} afterSalesCondition(s) in offer and ${bookedPart.afterSalesConditions.length} in booking`);
                });

                part.afterSalesConditions.forEach((condition, condIndex) => {
                    const condType = condition.condition;

                    // Find matching condition in booking by type
                    const bookedCondition = bookedPart.afterSalesConditions?.find(c => c.condition === condType);
                    pm.test(`${partType}[${index}] afterSalesConditions[${condIndex}] - ${condType} exists in booking`, () => {
                        pm.expect(bookedCondition, `Condition '${condType}' not found in booking`).to.exist;
                        validationLogger(`[INFO] ${partType}[${index}] afterSalesConditions[${condIndex}] - ${condType} found in booking`);
                    });

                    if (bookedCondition) {
                        // Compare condition type
                        pm.test(`${partType}[${index}] afterSalesConditions[${condIndex}].condition matches`, () => {
                            pm.expect(bookedCondition.condition).to.eql(condition.condition);
                            validationLogger(`[INFO] ${partType}[${index}] afterSalesConditions[${condIndex}].condition: offer='${condition.condition}' booking='${bookedCondition.condition}'`);
                        });

                        // Compare afterSaleFee structure
                        if (condition.afterSaleFee && bookedCondition.afterSaleFee) {
                            pm.test(`${partType}[${index}] afterSalesConditions[${condIndex}].afterSaleFee exists in both`, () => {
                                pm.expect(condition.afterSaleFee).to.exist;
                                pm.expect(bookedCondition.afterSaleFee).to.exist;
                                validationLogger(`[INFO] ${partType}[${index}] afterSalesConditions[${condIndex}].afterSaleFee exists in both offer and booking`);
                            });

                            // Compare afterSaleFee fields
                            ['currency', 'amount', 'scale'].forEach(field => {
                                pm.test(`${partType}[${index}] afterSalesConditions[${condIndex}].afterSaleFee.${field} matches`, () => {
                                    pm.expect(bookedCondition.afterSaleFee[field]).to.eql(condition.afterSaleFee[field]);
                                    validationLogger(`[INFO] ${partType}[${index}] afterSalesConditions[${condIndex}].afterSaleFee.${field}: offer='${condition.afterSaleFee[field]}' booking='${bookedCondition.afterSaleFee[field]}'`);
                                });
                            });

                            // Store environment variable for the current scenario type
                            const scenarioType = pm.environment.get("scenarioType");
                            if (scenarioType && (scenarioType.includes("EXCHANGE") && condType === "EXCHANGE" || scenarioType.includes("REFUND") && condType === "REFUND")) {
                                pm.environment.set(`afterSaleCondition_${condType}_amount`, condition.afterSaleFee.amount);
                                pm.environment.set(`afterSaleCondition_${condType}_currency`, condition.afterSaleFee.currency);
                                pm.environment.set(`afterSaleCondition_${condType}_scale`, condition.afterSaleFee.scale);
                                validationLogger(`[INFO] Stored afterSaleCondition_${condType}: amount=${condition.afterSaleFee.amount}, currency=${condition.afterSaleFee.currency}`);
                            }
                        } else {
                            validationLogger(`[WARNING] ${partType}[${index}] afterSalesConditions[${condIndex}].afterSaleFee missing in offer or booking`);
                        }
                    }
                });
            } else if (Array.isArray(bookedPart.afterSalesConditions) && bookedPart.afterSalesConditions.length > 0) {
                validationLogger(`[WARNING] ${partType}[${index}] afterSalesConditions exist in booking but not in offer`);
            }

            // Applied passenger types comparison
            if (Array.isArray(part.appliedPassengerTypes) && part.appliedPassengerTypes.length > 0) {
                pm.test(`${partType}[${index}] appliedPassengerTypes exist in both offer and booking`, () => {
                    pm.expect(bookedPart.appliedPassengerTypes, `appliedPassengerTypes missing in booking`).to.exist;
                    pm.expect(bookedPart.appliedPassengerTypes).to.be.an('array');
                    validationLogger(`[INFO] ${partType}[${index}] has ${part.appliedPassengerTypes.length} appliedPassengerType(s) in offer and ${bookedPart.appliedPassengerTypes.length} in booking`);
                });

                part.appliedPassengerTypes.forEach((passengerType, ptIndex) => {
                    validationLogger(`[INFO] Validating ${partType}[${index}] appliedPassengerTypes[${ptIndex}] - ${passengerType.passengerRef}/${passengerType.type}`);

                    // Find matching passenger type in booking by passengerRef and type
                    const bookedPassengerType = bookedPart.appliedPassengerTypes?.find(
                        pt => pt.passengerRef === passengerType.passengerRef && pt.type === passengerType.type
                    );

                    pm.test(`${partType}[${index}] appliedPassengerTypes[${ptIndex}] - ${passengerType.passengerRef}/${passengerType.type} exists in booking`, () => {
                        pm.expect(bookedPassengerType, `PassengerType '${passengerType.passengerRef}/${passengerType.type}' not found in booking`).to.exist;
                        validationLogger(`[INFO] ${partType}[${index}] appliedPassengerTypes[${ptIndex}] - ${passengerType.passengerRef}/${passengerType.type} found in booking`);
                    });

                    if (bookedPassengerType) {
                        // Compare passengerRef
                        pm.test(`${partType}[${index}] appliedPassengerTypes[${ptIndex}].passengerRef matches`, () => {
                            pm.expect(bookedPassengerType.passengerRef).to.eql(passengerType.passengerRef);
                            validationLogger(`[INFO] ${partType}[${index}] appliedPassengerTypes[${ptIndex}].passengerRef: offer='${passengerType.passengerRef}' booking='${bookedPassengerType.passengerRef}'`);
                        });

                        // Compare type
                        pm.test(`${partType}[${index}] appliedPassengerTypes[${ptIndex}].type matches`, () => {
                            pm.expect(bookedPassengerType.type).to.eql(passengerType.type);
                            validationLogger(`[INFO] ${partType}[${index}] appliedPassengerTypes[${ptIndex}].type: offer='${passengerType.type}' booking='${bookedPassengerType.type}'`);
                        });

                        // Compare description if present
                        if (passengerType.description && bookedPassengerType.description) {
                            pm.test(`${partType}[${index}] appliedPassengerTypes[${ptIndex}].description matches`, () => {
                                pm.expect(bookedPassengerType.description).to.eql(passengerType.description);
                                validationLogger(`[INFO] ${partType}[${index}] appliedPassengerTypes[${ptIndex}].description: offer='${passengerType.description}' booking='${bookedPassengerType.description}'`);
                            });
                        }

                        // Compare tripCoverage if present
                        if (passengerType.tripCoverage && bookedPassengerType.tripCoverage) {
                            pm.test(`${partType}[${index}] appliedPassengerTypes[${ptIndex}].tripCoverage exists in both`, () => {
                                pm.expect(passengerType.tripCoverage).to.exist;
                                pm.expect(bookedPassengerType.tripCoverage).to.exist;
                                validationLogger(`[INFO] ${partType}[${index}] appliedPassengerTypes[${ptIndex}].tripCoverage exists in both offer and booking`);
                            });

                            // Compare coveredTripId
                            if (passengerType.tripCoverage.coveredTripId && bookedPassengerType.tripCoverage.coveredTripId) {
                                pm.test(`${partType}[${index}] appliedPassengerTypes[${ptIndex}].tripCoverage.coveredTripId matches`, () => {
                                    pm.expect(bookedPassengerType.tripCoverage.coveredTripId).to.eql(passengerType.tripCoverage.coveredTripId);
                                    validationLogger(`[INFO] ${partType}[${index}] appliedPassengerTypes[${ptIndex}].tripCoverage.coveredTripId: offer='${passengerType.tripCoverage.coveredTripId}' booking='${bookedPassengerType.tripCoverage.coveredTripId}'`);
                                });
                            }

                            // Compare coveredLegIds if present
                            if (passengerType.tripCoverage.coveredLegIds && bookedPassengerType.tripCoverage.coveredLegIds) {
                                pm.test(`${partType}[${index}] appliedPassengerTypes[${ptIndex}].tripCoverage.coveredLegIds matches`, () => {
                                    pm.expect(bookedPassengerType.tripCoverage.coveredLegIds).to.have.members(passengerType.tripCoverage.coveredLegIds);
                                    validationLogger(`[INFO] ${partType}[${index}] appliedPassengerTypes[${ptIndex}].tripCoverage.coveredLegIds: offer=[${passengerType.tripCoverage.coveredLegIds}] booking=[${bookedPassengerType.tripCoverage.coveredLegIds}]`);
                                });
                            }
                        } else if (passengerType.tripCoverage || bookedPassengerType.tripCoverage) {
                            validationLogger(`[WARNING] ${partType}[${index}] appliedPassengerTypes[${ptIndex}].tripCoverage missing in ${passengerType.tripCoverage ? 'booking' : 'offer'}`);
                        }

                        // Compare appliedReductionCardTypes if present
                        if (Array.isArray(passengerType.appliedReductionCardTypes)) {
                            if (passengerType.appliedReductionCardTypes.length > 0) {
                                pm.test(`${partType}[${index}] appliedPassengerTypes[${ptIndex}].appliedReductionCardTypes exist in both`, () => {
                                    pm.expect(bookedPassengerType.appliedReductionCardTypes, `appliedReductionCardTypes missing in booking`).to.exist;
                                    pm.expect(bookedPassengerType.appliedReductionCardTypes).to.be.an('array');
                                    validationLogger(`[INFO] ${partType}[${index}] appliedPassengerTypes[${ptIndex}] has ${passengerType.appliedReductionCardTypes.length} appliedReductionCardType(s) in offer and ${bookedPassengerType.appliedReductionCardTypes.length} in booking`);
                                });

                                passengerType.appliedReductionCardTypes.forEach((cardType, cardIndex) => {
                                    const bookedCardType = bookedPassengerType.appliedReductionCardTypes?.find(c => c === cardType);

                                    pm.test(`${partType}[${index}] appliedPassengerTypes[${ptIndex}].appliedReductionCardTypes[${cardIndex}] matches`, () => {
                                        pm.expect(bookedCardType).to.eql(cardType);
                                        validationLogger(`[INFO] ${partType}[${index}] appliedPassengerTypes[${ptIndex}].appliedReductionCardTypes[${cardIndex}]: offer='${cardType}' booking='${bookedCardType}'`);
                                    });
                                });
                            } else {
                                pm.test(`${partType}[${index}] appliedPassengerTypes[${ptIndex}].appliedReductionCardTypes is empty in both`, () => {
                                    pm.expect(bookedPassengerType.appliedReductionCardTypes || []).to.be.an('array').with.length(0);
                                    validationLogger(`[INFO] ${partType}[${index}] appliedPassengerTypes[${ptIndex}].appliedReductionCardTypes is empty in both offer and booking`);
                                });
                            }
                        }
                    }
                });
            } else if (Array.isArray(bookedPart.appliedPassengerTypes) && bookedPart.appliedPassengerTypes.length > 0) {
                validationLogger(`[WARNING] ${partType}[${index}] appliedPassengerTypes exist in booking but not in offer`);
            }
        });
    };

    // Validate each section
    validateOfferParts(selectedOffer.admissionOfferParts || [], jsonData.booking.bookedOffers.flatMap(b => b.admissions || []), "admission");
    validateOfferParts(selectedOffer.reservationOfferParts || [], jsonData.booking.bookedOffers.flatMap(b => b.reservations || []), "reservation");
    validateOfferParts(selectedOffer.ancillaryOfferParts || [], jsonData.booking.bookedOffers.flatMap(b => b.ancillaries || []), "ancillary");

    // validate fulfillments
    validateFulfillments(jsonData.booking.fulfillments || [], 0, expectedFulfillmentStatus);

    // Passengers check
    pm.test(`Passengers in offer should exist in booking`, () => {
        (selectedOffer.anonymousPassengerSpecifications || []).forEach(p => {
            const match = (jsonData.booking.passengers || []).find(b => b.id === p.externalRef || b.externalRef === p.externalRef);
            validationLogger(`[INFO] Checking passenger externalRef=${p.externalRef} in booking`);
            pm.expect(match, `[ERROR] Passenger ${p.externalRef} missing in booking`).to.exist;
        });
    });
};


validateFulfillments = function (fulfillments, index, expectedFulfillmentStatus) {
    validationLogger("[INFO] ➤ validateFulfillments");
    if (!Array.isArray(fulfillments) || fulfillments.length === 0) {
        console.log("No fulfillments available in the response, continue execution");
    } else {
        const fulfillmentIds = [];
        const admissionReservationAncillaryBookingPartsIds = pm.environment.get("admissionReservationAncillaryBookingPartsIds") || [];
        pm.test(`Fulfillments exist at index ${index}`, () => {
            pm.expect(fulfillments).to.be.an("array").that.is.not.empty;
            validationLogger(`[INFO] Number of fulfillments: ${fulfillments.length}`);
        });

        // Check each fulfillment
        fulfillments.forEach((fulfillment, index) => {
            // Check fulfillment id exists
            pm.test(`Fulfillment[${index}] id exists`, () => {
                pm.expect(fulfillment.id).to.be.a("string").and.not.be.empty;
                validationLogger(`[INFO] Fulfillment[${index}] id exists: ${fulfillment.id}`);
                fulfillmentIds.push(fulfillment.id);
                pm.environment.set("fulfillmentIds", fulfillmentIds);
            });

            // Check bookingRef exists
            pm.test(`Fulfillment[${index}] bookingRef exists`, () => {
                pm.expect(fulfillment.bookingRef).to.be.a("string").and.not.be.empty;
                validationLogger(`[INFO] Fulfillment[${index}] bookingRef exists: ${fulfillment.bookingRef}`);
            });

            // Check createdOn for FULFILLED or CONFIRMED status
            console.log("Expected Fulfillment Status:", expectedFulfillmentStatus);
            if (expectedFulfillmentStatus.includes("FULFILLED") || expectedFulfillmentStatus.includes("CONFIRMED")) {
                const createdOnDate = new Date(fulfillment.createdOn);
                if (!isNaN(createdOnDate.getTime())) {
                    pm.test(`Fulfillment[${index}] createdOn exists`, () => {
                        pm.expect(fulfillment.createdOn).to.be.a("string").and.not.be.empty;
                        pm.expect(createdOnDate.getTime()).to.be.at.most(Date.now());
                        validationLogger(`[INFO] Fulfillment[${index}] createdOn exists: ${fulfillment.createdOn}`);
                    });
                } else {
                    validationLogger(`[WARNING] Fulfillment[${index}] createdOn has invalid date format: ${fulfillment.createdOn}`);
                }
            }

            // Check fulfillment status
            pm.test(`Fulfillment[${index}] status comparison - expected: ${expectedFulfillmentStatus}, actual: ${fulfillment.status}`, () => {
                validationLogger(`[INFO] Fulfillment[${index}] status comparison - expected: ${expectedFulfillmentStatus}, actual: ${fulfillment.status}`);
                if (Array.isArray(expectedFulfillmentStatus)) {
                    pm.expect(expectedFulfillmentStatus).to.include(fulfillment.status);
                } else {
                    pm.expect(fulfillment.status).to.eql(expectedFulfillmentStatus);
                }
            });

            // Check controlNumber exists
            if (fulfillment.controlNumber != null) {
                pm.test(`Fulfillment[${index}] controlNumber exists`, () => {
                    pm.expect(fulfillment.controlNumber).to.be.a("string").and.not.be.empty;
                });
            } else {
                validationLogger(`[INFO] Fulfillment[${index}] controlNumber is absent (expected for CONFIRMED without document issuance yet)`);
            }

            // Check bookingParts ids exist in admissionReservationAncillaryBookingPartsIds
            pm.test(`Fulfillment[${index}] bookingParts.id exist in admissionReservationAncillaryBookingPartsIds - expected: [${admissionReservationAncillaryBookingPartsIds}], actual: [${fulfillment.bookingParts.map(bp => bp.id)}]`, () => {
                pm.expect(fulfillment.bookingParts).to.be.an("array").that.is.not.empty;
                fulfillment.bookingParts.forEach(part => {
                    validationLogger(`[INFO] Fulfillment[${index}] bookingPart.id: ${part.id} exists in admissionReservationAncillaryBookingPartsIds`);
                    pm.expect(admissionReservationAncillaryBookingPartsIds).to.include(part.id);
                });
            });

            // Fulfillment documents is an array and not empty
            if (Array.isArray(fulfillment.fulfillmentDocuments) && fulfillment.fulfillmentDocuments.length > 0) {
                pm.test(`Fulfillment[${index}] documents exist and contain valid data`, () => {
                    pm.expect(fulfillment.fulfillmentDocuments).to.be.an("array").that.is.not.empty;
                    validationLogger(`[INFO] Fulfillment[${index}] number of documents: ${fulfillment.fulfillmentDocuments.length}`);
                    fulfillment.fulfillmentDocuments.forEach((doc, docIndex) => {
                        pm.test(`Fulfillment[${index}].document[${docIndex}] - fields exist`, () => {
                            pm.expect(doc.medium, "medium missing").to.be.a("string").and.not.be.empty;
                            pm.expect(doc.type, "type missing").to.be.a("string").and.not.be.empty;
                            pm.expect(doc.downloadLink, "downloadLink missing").to.be.a("string").and.not.be.empty;
                            //TODO: re-enable when downloadExpiry is provided by the API
                            //pm.expect(doc.downloadExpiry, "downloadExpiry missing").to.be.a("string").and.not.be.empty;
                            pm.expect(doc.format, "format missing").to.be.a("string").and.not.be.empty;
                            validationLogger(`[INFO] Fulfillment[${index}].document[${docIndex}] → medium=${doc.medium}, type=${doc.type}, link=${doc.downloadLink}`);
                        });
                    });
                });
            }
        });
    }
};
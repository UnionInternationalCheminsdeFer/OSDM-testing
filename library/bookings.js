let totalProvisionalOrBookingPrice = 0;


postCreateBookingResponse = function (selectedOffer, booking, state) {
    const jsonData = pm.response.json();

    // Validate HTTP response status
    pm.test("Status code is 200", () => {
        pm.expect(pm.response.code, "[ERROR] Wrong response status").to.eql(200);
    });

    if (pm.response.code !== 200) {
        validationLogger(`[ERROR] Wrong status: ${pm.response.code}`);
        pm.execution.setNextRequest(null);
        return;
    }

    // Check booking exists
    pm.test("Booking object exists", () => {
        pm.expect(jsonData.booking, "[ERROR] 'booking' is missing or empty").to.be.an("object").that.is.not.empty;
    });
    if (!jsonData.booking || typeof jsonData.booking !== "object") {
        validationLogger("[ERROR] No booking found or 'booking' is not an object.");
        pm.execution.setNextRequest(null);
        return;
    }

    pm.test("Booking Id and Booking code are returned", () => {
        validationLogger(`[INFO] Booking Id returned: ${booking.id}`);
        validationLogger(`[INFO] Booking code returned: ${booking.bookingCode}`);
        pm.expect(booking.id).to.be.a('string').and.not.be.empty;
        pm.expect(booking.bookingCode).to.be.a('string').and.not.be.empty;
    });
    pm.environment.set("bookingId", booking.id);

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
    pm.environment.set("passengerIdList", passengerIdList);

    // Helper to compare arrays safely (only compare values that exist in both sides)
    const compareArraysWithWarning = (offerArr, bookingArr, partType, partId, fieldName) => {
        if ((!offerArr || offerArr.length === 0) && (!bookingArr || bookingArr.length === 0)) {
            validationLogger(`[WARNING] ${partType} ${partId}: ${fieldName} missing in offer AND booking`);
            return;
        }
        pm.test(`${partType} ${partId} - compare array ${fieldName}`, () => {
            const toCompare = offerArr.filter(v => bookingArr.includes(v));
            validationLogger(`[INFO] Comparing ${fieldName}: offer=[${offerArr}] booking=[${bookingArr}]`);
            toCompare.forEach(v => {
                pm.expect(bookingArr, `[ERROR] ${fieldName} missing value: ${v}`).to.include(v);
            });
            if (toCompare.length !== offerArr.length) {
                validationLogger(`[WARNING] Some values from ${fieldName} in offer are missing in booking`);
            }
        });
    };


    // Function to validate offer parts against booked parts
    const validateOfferParts = (offerParts, bookedParts, partType) => {
        offerParts.forEach((part, index) => {
            const bookedPart = bookedParts[index];
            // check bookedPart exists
            if (!bookedPart) {
                validationLogger(`[WARNING] No booked ${partType}[${index}] found for offer part id=${part.id}`);
                return;
            }

            // check bookedPart.id exists
            pm.test(`${partType} part ${index} has id in booking`, () => {
                pm.expect(bookedPart.id, `[ERROR] ${partType}[${index}] has no id in booking`).to.exist;
                validationLogger(`[INFO] Booking ${partType}[${index}].id = ${bookedPart.id}`);
            });

            // check exchangeable, isReservationRequired, refundable, offerMode
            ['exchangeable', 'isReservationRequired', 'refundable', 'offerMode'].forEach(field => {
                if (part[field] !== undefined && bookedPart[field] !== undefined) {
                    pm.test(`${partType}[${index}].${field} matches`, () => {
                        pm.expect(bookedPart[field]).to.eql(part[field]);
                        validationLogger(`[INFO] ${partType}[${index}].${field}: offer='${part[field]}' booking='${bookedPart[field]}'`);
                    });
                } else {
                    validationLogger(`[WARNING] ${partType}[${index}]: '${field}' missing in offer or booking`);
                }
            });

            // check price
            if (part.price || bookedPart.price) {
                if (part.price && bookedPart.price) {
                    ['amount','currency','scale'].forEach(f => {
                        pm.test(`${partType}[${index}] price.${f} matches`, () => {
                            pm.expect(bookedPart.price[f]).to.eql(part.price[f]);
                            validationLogger(`[INFO] ${partType}[${index}] price.${f}: offer='${part.price[f]}' booking='${bookedPart.price[f]}'`);
                        });
                    });
                } else {
                    validationLogger(`[WARNING] ${partType}[${index}] price missing in offer or booking`);
                }
            }

            // Validity dates
            ['validFrom','validUntil'].forEach(field => {
                if (part[field] && bookedPart[field]) {
                    pm.test(`${partType}[${index}].${field} matches`, () => {
                        pm.expect(bookedPart[field]).to.eql(part[field]);
                        validationLogger(`[INFO] ${partType}[${index}].${field}: offer='${part[field]}' booking='${bookedPart[field]}'`)
                    });
                } else {
                    validationLogger(`[WARNING] ${partType}[${index}] ${field} missing in offer or booking`);
                }
            });

            // Arrays comparison with warnings
            compareArraysWithWarning(
                (part.appliedPassengerTypes || []).map(p => p.type),
                (bookedPart.appliedPassengerTypes || []).map(p => p.type),
                partType, index, "appliedPassengerTypes"
            );

            compareArraysWithWarning(
                (part.availableFulfillmentOptions || []).map(f => `${f.type}|${f.media}`),
                (bookedPart.availableFulfillmentOptions || []).map(f => `${f.type}|${f.media}`),
                partType, index, "availableFulfillmentOptions"
            );

            compareArraysWithWarning(
                (part.products || []).map(p => p.productId),
                (bookedPart.products || []).map(p => p.productId),
                partType, index, "products.productId"
            );

            compareArraysWithWarning(
                (part.reservationRefs || []).map(r => r.id),
                (bookedPart.reservationRefs || []).map(r => r.id),
                partType, index, "reservationRefs"
            );

            compareArraysWithWarning(
                part.tripCoverage?.coveredLegIds || [],
                bookedPart.tripCoverage?.coveredLegIds || [],
                partType, index, "tripCoverage.coveredLegIds"
            );
        });
    };


    // Validate each section
    validateOfferParts(selectedOffer.admissionOfferParts || [], booking.bookedOffers.flatMap(b => b.admissions || []), "admission");
    validateOfferParts(selectedOffer.reservationOfferParts || [], booking.bookedOffers.flatMap(b => b.reservations || []), "reservation");
    validateOfferParts(selectedOffer.ancillaryOfferParts || [], booking.bookedOffers.flatMap(b => b.ancillary || []), "ancillary");

    // Passengers check
    pm.test("Passengers in offer should exist in booking", () => {
        (selectedOffer.anonymousPassengerSpecifications || []).forEach(p => {
            const match = (booking.passengers || []).find(b => b.id === p.externalRef || b.externalRef === p.externalRef);
            pm.expect(match, `[ERROR] Passenger ${p.externalRef} missing in booking`).to.exist;
        });
    });
};


checkGenericBookedOfferPart = function (bookedOfferPart, state, textDescription) {
    validationLogger(`[INFO] ➤➤ checkGenericBookedOfferPart ${textDescription}`);

    const currentDate = new Date();
    const createdOn = new Date(bookedOfferPart.createdOn);
    const validUntil = new Date(bookedOfferPart.validUntil);
    const confirmableUntil = new Date(bookedOfferPart.confirmableUntil);

    // Date verification
    pm.test(`CreatedOn is returned for ${textDescription}`, () => {
        validationLogger(`[FULL] ${textDescription}: currentDate: ${currentDate.toDateString()}, createdOn: ${createdOn.toDateString()}`);
        pm.expect(createdOn.toDateString()).to.equal(currentDate.toDateString());
    });

    pm.test(`ValidUntil is set for ${textDescription}`, () => {
        validationLogger(`[FULL] ${textDescription}: validUntil: ${validUntil.toISOString()}, currentDate: ${currentDate.toISOString()}`);
        pm.expect(validUntil.getTime()).to.be.above(currentDate.getTime());
    });

    if (state === "PREBOOKED") {
        pm.test(`ConfirmableUntil is returned for ${textDescription}`, () => {
            validationLogger(`[FULL] ${textDescription}: confirmableUntil: ${confirmableUntil.toISOString()}, currentDate: ${currentDate.toISOString()}`);
            pm.expect(confirmableUntil.getTime()).to.be.above(currentDate.getTime());
        });

        pm.test(`Status is PREBOOKED for ${textDescription}`, () => {
            validationLogger(`[INFO] ${textDescription}: status: ${bookedOfferPart.status}`);
            pm.expect(["PREBOOKED"]).to.include(bookedOfferPart.status);
        });
    } else {
        pm.test(`Status is FULFILLED or CONFIRMED for ${textDescription}`, () => {
            validationLogger(`[INFO] ${textDescription}: status: ${bookedOfferPart.status}`);
            pm.expect(["FULFILLED", "CONFIRMED"]).to.include(bookedOfferPart.status);
        });
    }

    // Total price calculation
    totalProvisionalOrBookingPrice += calculateTotalAmount(bookedOfferPart);
    pm.environment.set("totalProvisionalOrBookingPrice", totalProvisionalOrBookingPrice);

    // After-sale fees extraction
    extractAfterSaleFees(bookedOfferPart, textDescription);
};

extractAfterSaleFees = function (bookedOfferPart, textDescription) {
    validationLogger("[INFO] ➤➤➤ extractAfterSaleFees");

    if (!Array.isArray(bookedOfferPart.afterSalesConditions)) {
        validationLogger(`[INFO] No afterSalesConditions for ${textDescription}`);
        return;
    }

    const scenarioType = pm.environment.get("scenarioType");
    const cond = scenarioType.includes("EXCHANGE") ? "EXCHANGE" : scenarioType.includes("REFUND") ? "REFUND" : null;
    if (!cond) return;

    bookedOfferPart.afterSalesConditions.forEach((condition, index) => {
        if (condition.condition === cond && condition.afterSaleFee && typeof condition.afterSaleFee.amount === "number") {
            const fee = condition.afterSaleFee;
            pm.environment.set(`afterSaleCondition_${textDescription}_amount`, fee.amount);
            pm.environment.set(`afterSaleCondition_${textDescription}_currency`, fee.currency);

            validationLogger(`[INFO] Set afterSaleCondition_${textDescription}_amount: ${fee.amount}, currency: ${fee.currency}`);
        }
    });
};

calculateTotalAmount = function (bookedOfferPart) {
    validationLogger("[INFO] ➤➤➤ calculateTotalAmount");
    const allowedTypes = ['Reservation', 'Admission', 'Fees', 'Fares', 'Ancillary'];

    const items = Array.isArray(bookedOfferPart) ? bookedOfferPart : [bookedOfferPart];
    let total = 0;

    items.forEach(item => {
        if (allowedTypes.includes(item.objectType)) {
            total += item.price?.amount || 0;
        }
    });

    validationLogger(`[INFO] Total amount for ${items.length} item(s): ${total}`);
    return total;
};
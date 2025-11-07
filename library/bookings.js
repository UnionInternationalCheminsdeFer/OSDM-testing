let totalProvisionalOrBookingPrice = 0;

postCreateBookingResponse = function (offers, offerId, booking, state) {

    // Validate HTTP response status
    pm.test("Status code is 200", () => {
        pm.expect(pm.response.code, "[ERROR] Wrong response status").to.eql(200);
    });

    if (pm.response.code !== 200) {
        validationLogger(`[ERROR] Wrong status: ${pm.response.code}`);
        pm.execution.setNextRequest(null);
        return;
    }

    pm.test("Booking object exists", () => {
        pm.expect(jsonData.booking, "[ERROR] 'booking' is missing or empty").to.be.an("object").that.is.not.empty;
    });

    if (!jsonData.booking || typeof jsonData.booking !== "object") {
        validationLogger("[ERROR] No booking found or 'booking' is not an object.");
        pm.execution.setNextRequest(null);
        return;
    }

    const bookingId = booking.id;
    pm.environment.set("bookingId", bookingId);

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

    pm.test("Booking Id is returned", () => {
        validationLogger(`[INFO] Booking Id: ${bookingId}`);
        pm.expect(bookingId).to.be.a('string').and.not.be.empty;
    });

    // Offer validation
    const offer = offers.find(internalOffer => internalOffer.offerId === offerId);

    if (!offer) {
        validationLogger("[INFO] No correct offer can be found, skipping rest of validation");
        return;
    }

    // bookedOfferIds check
    pm.test("bookedOfferIds should be returned and not empty", () => {
        const bookedOfferIds = booking.bookedOffers?.map(b => b.offerId);
        pm.expect(bookedOfferIds, "[ERROR] bookedOfferIds is missing or empty").to.be.an("array").that.is.not.empty;
        pm.environment.set("bookedOfferIds", JSON.stringify(bookedOfferIds));
        validationLogger(`[INFO] bookedOfferIds: ${bookedOfferIds.join(", ")}`);
    });

    // Consistency check with selected offer
    const foundOffers = booking.bookedOffers.some(bookedOffer => compareOffers(bookedOffer, offer, booking, state));
    pm.test(`Booked offers are consistent with selected offer ${offerId}`, () => {
        validationLogger(`[INFO] Booked offer matches selected offer: ${foundOffers}`);
        pm.expect(foundOffers).to.equal(true);
    });

    // Passengers validation per offer
    offer.passengerRefs.forEach(passenger => {
        const found = booking.passengers.some(bookedPassenger => bookedPassenger.externalRef === passenger);
        pm.test(`Passenger ${passenger} returned`, () => {
            validationLogger(`[INFO] passengerRef: ${passenger}, found: ${found}`);
            pm.expect(found).to.equal(true);
        });
    });

};


compareOffers = function (bookedOffer, offer, booking, state) {
    validationLogger("[INFO] ➤ compareOffers");

    const partRefs = [];
    let allMatched = true;

    const checkSection = (bookedItems, offeredItems, name, compareFn) => {
        if (!bookedItems?.length || !offeredItems?.length) {
            validationLogger(`[INFO] Skipping ${name}`);
            return;
        }

        bookedItems.forEach(item => {
            checkGenericBookedOfferPart(item, state, name);

            const found = offeredItems.some(offeredItem => compareFn(item, offeredItem, booking));

            pm.test(`Check ${name} for booked item ${item.id || item.productId || item.reservationReference}`, () => {
                validationLogger(`[INFO] ${name} match found: ${found}`);
                pm.expect(found).to.equal(true);
            });

            if (!found) allMatched = false;
        });
    };

    checkSection(bookedOffer.admissions, offer.admissionOfferParts, "admissions", compareAdmissions);
    checkSection(bookedOffer.ancillaries, offer.ancillaryOfferParts, "ancillaries", compareAncillaries);
    checkSection(bookedOffer.reservations, offer.reservationOfferParts, "reservations", compareReservations);

    bookedOffer.admissions?.forEach(item => partRefs.push(item.reservationReference));
    pm.environment.set("idsAdmissionAncillariesReservationReference", JSON.stringify(partRefs));

    return allMatched;
};


compareAdmissions = function (bookedAdmission, offeredAdmission, booking) {
    validationLogger("[INFO] ➤➤➤ compareAdmissions");

    // Price verification
    pm.test("Price of the admission should be set and similar to offer response", () => {
        const b = bookedAdmission.price;
        const o = offeredAdmission.price;
        validationLogger(`[INFO] Admission price: booked: ${b.amount}/${b.currency}/${b.scale} vs offered: ${o.amount}/${o.currency}/${o.scale}`);
        pm.expect(b.amount).to.equal(o.amount);
        pm.expect(b.currency).to.equal(o.currency);
        pm.expect(b.scale).to.equal(o.scale);
    });

    // Product verification
    pm.test("Products of the admission should be set and similar to offer response", () => {
        bookedAdmission.products.forEach(bp => {
            const found = offeredAdmission.products.some(op => bp.productId === op.productId);
            validationLogger(`[INFO] Booked Admission Product ID ${bp.productId}, match found: ${found}`);
            pm.expect(found).to.equal(true);
        });
    });

    // Common properties verification
    ["exchangeable", "isReservationRequired", "isReusable", "offerMode", "refundable"].forEach(prop => {
        if (bookedAdmission[prop] !== undefined) {
            pm.test(`Property ${prop} should match offer response`, () => {
                validationLogger(`[FULL] ${prop}: booked: ${bookedAdmission[prop]}, offered: ${offeredAdmission[prop]}`);
                pm.expect(bookedAdmission[prop]).to.equal(offeredAdmission[prop]);
            });
        }
    });

    // Passenger verification
    pm.test("Correct passengers are part of the admission", () => {
        bookedAdmission.passengerIds.forEach(pid => {
            const found = booking.passengers.some(p => pid === p.id);
            validationLogger(`[INFO] PassengerId: ${pid}, found: ${found}`);
            pm.expect(found).to.equal(true);
        });
    });
};


compareAncillaries = function (bookedAncillary, offeredAncillary, booking) {
    validationLogger("[INFO] ➤➤➤ compareAncillaries");

    // Price verification
    pm.test("Price of the ancillary should be set and similar to offer response", () => {
        const b = bookedAncillary.price;
        const o = offeredAncillary.price;
        validationLogger(`[INFO] Ancillary price: booked: ${b.amount}/${b.currency}/${b.scale} vs offered: ${o.amount}/${o.currency}/${o.scale}`);
        pm.expect(b.amount).to.equal(o.amount);
        pm.expect(b.currency).to.equal(o.currency);
        pm.expect(b.scale).to.equal(o.scale);
    });

    // Product verification
    pm.test("Products of the ancillary should be set and similar to offer response", () => {
        bookedAncillary.products.forEach(bp => {
            const found = offeredAncillary.products.some(op => bp.productId === op.productId);
            validationLogger(`[INFO] Booked Ancillary Product ID ${bp.productId}, match found: ${found}`);
            pm.expect(found).to.equal(true);
        });
    });

    // Common properties verification
    ["exchangeable", "isReservationRequired", "isReusable", "offerMode", "refundable"].forEach(prop => {
        if (bookedAncillary[prop] !== undefined) {
            pm.test(`Property ${prop} should match offer response`, () => {
                validationLogger(`[FULL] ${prop}: booked: ${bookedAncillary[prop]}, offered: ${offeredAncillary[prop]}`);
                pm.expect(bookedAncillary[prop]).to.equal(offeredAncillary[prop]);
            });
        }
    });

    // Passenger verification
    pm.test("Correct passengers are part of the ancillary", () => {
        bookedAncillary.passengerIds.forEach(pid => {
            const found = booking.passengers.some(p => pid === p.id);
            validationLogger(`[INFO] Ancillary PassengerId: ${pid}, found: ${found}`);
            pm.expect(found).to.equal(true);
        });
    });

    return true;
};


compareReservations = function (bookedReservation, offeredReservation, booking) {
    validationLogger("[INFO] ➤➤➤ compareReservations");

    // Price verification
    pm.test("Price of the reservation should be set and similar to offer response", () => {
        const b = bookedReservation.price;
        const o = offeredReservation.price;
        validationLogger(`[INFO] Reservation price: booked: ${b.amount}/${b.currency}/${b.scale} vs offered: ${o.amount}/${o.currency}/${o.scale}`);
        pm.expect(b.amount).to.equal(o.amount);
        pm.expect(b.currency).to.equal(o.currency);
        pm.expect(b.scale).to.equal(o.scale);
    });

    // Product verification
    pm.test("Products of the reservation should be set and similar to offer response", () => {
        bookedReservation.products.forEach(bp => {
            const found = offeredReservation.products.some(op => bp.productId === op.productId);
            validationLogger(`[INFO] Booked Reservation Product ID ${bp.productId}, match found: ${found}`);
            pm.expect(found).to.equal(true);
        });
    });

    // Common properties verification
    ["exchangeable", "isReservationRequired", "isReusable", "offerMode", "refundable"].forEach(prop => {
        if (bookedReservation[prop] !== undefined) {
            pm.test(`Property ${prop} should match offer response`, () => {
                validationLogger(`[FULL] ${prop}: booked: ${bookedReservation[prop]}, offered: ${offeredReservation[prop]}`);
                pm.expect(bookedReservation[prop]).to.equal(offeredReservation[prop]);
            });
        }
    });

    // Passenger verification
    pm.test("Correct passengers are part of the reservation", () => {
        bookedReservation.passengerIds.forEach(pid => {
            const found = booking.passengers.some(p => pid === p.id);
            validationLogger(`[INFO] Reservation PassengerId: ${pid}, found: ${found}`);
            pm.expect(found).to.equal(true);
        });
    });

    return true;
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


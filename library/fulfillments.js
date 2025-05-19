// Utility function to check and iterate over booked offer parts
function checkBookedOfferParts(bookedOffer, partType, bookingState) {
    const parts = bookedOffer[partType];
    if (Array.isArray(parts) && parts.length > 0) {
        parts.forEach(bookedOfferPart => {
            checkGenericBookedOfferPart(bookedOfferPart, bookingState, partType);
        });
    }
}

// Function to validate passengers
function validatePassengers(booking, offer) {
    offer.passengerRefs.forEach(passenger => {
        const found = booking.passengers.some(bookedPassenger => {
            return bookedPassenger.externalRef === passenger;
        });

        pm.test(`Passenger ${passenger} with correct externalRef returned`, () => {
            pm.expect(found).to.equal(true);
        });
    });
}

// Function to validate purchaser details
function validatePurchaserDetails(purchaserDetail) {
    if (purchaserDetail) {
        pm.test("Correct Purchaser is returned", () => {
            pm.expect(purchaserDetail.firstName).not.to.be.empty;
            pm.expect(purchaserDetail.lastName).not.to.be.empty;
            pm.expect(purchaserDetail.contact.email).not.to.be.empty;
            pm.expect(purchaserDetail.contact.phoneNumber).not.to.be.empty;
        });
    }
}

// Function to validate fulfillment IDs
function validateFulfillmentId(booking) {
    const fulfillmentsIdRaw = pm.globals.get("fulfillmentsIds");
    if (fulfillmentsIdRaw) {
        const expectedIds = JSON.parse(fulfillmentsIdRaw);
        let actualIds = [];

        if (booking.fulfillments && booking.fulfillments.length > 0) {
            actualIds = booking.fulfillments.map(f => f.id);
            actualIds.forEach((id, index) => {
                pm.test(`booking.fulfillments[${index}].id (${id}) should be one of expected fulfillments`, () => {
                    pm.expect(id).to.be.oneOf(expectedIds);
                });
            });
        }
    }
}

// Function to validate prices
function validatePrices(booking, fulfillmentState, totalPrice) {
    if (fulfillmentState !== undefined) {
        pm.globals.set("bookingConfirmedPrice", booking.confirmedPrice.amount);
        const bookingConfirmedPrice = pm.globals.get("bookingConfirmedPrice");
        const provisionalPrice = pm.globals.get("provisionalPrice");

        pm.test(`Compare provisionalPrice = ${provisionalPrice} with bookingConfirmedPrice = ${bookingConfirmedPrice}`, () => {
            pm.expect(provisionalPrice).to.eql(bookingConfirmedPrice);
        });
        pm.test(`Compare bookingConfirmedPrice = ${bookingConfirmedPrice} with Booking Admission + Reservation + Ancillaries + Fees + Fares = ${totalPrice}`, () => {
            pm.expect(bookingConfirmedPrice).to.eql(totalPrice);
        });
    } else {
        pm.globals.set("provisionalPrice", booking.provisionalPrice.amount);
        const provisionalPrice = pm.globals.get("provisionalPrice");

        pm.test(`Compare provisionalPrice = ${provisionalPrice} with Booking Admission + Reservation + Ancillaries + Fees + Fares = ${totalPrice}`, () => {
            pm.expect(provisionalPrice).to.eql(totalPrice);
        });
    }
}

// Function to check fulfillment details
function checkFulfillment(booking, fulfillment) {
    const currentDate = new Date();
    const createdOn = new Date(fulfillment.createdOn);

    pm.test("Correct booking reference is returned on fulfillment", () => {
        pm.expect(fulfillment.bookingRef).to.equal(booking.id);
    });

	pm.test(`CreatedOn is returned on fulfillment`, () => {
		pm.expect(currentDate.toDateString()).to.equal(createdOn.toDateString());
	});

    pm.test(`Correct state ON_HOLD, FULFILLED or CONFIRMED is returned on fulfillment: ${fulfillment.status}`, () => {
        pm.expect(["FULFILLED", "CONFIRMED", "ON_HOLD"]).to.include(fulfillment.status);
    });

    const refundPartRefs = JSON.parse(pm.globals.get("idsAdmissionAncillariesReservationReference") || "[]");
    let bookingPartIds = [];

    if (fulfillment.bookingParts && fulfillment.bookingParts.length > 0) {
        bookingPartIds = fulfillment.bookingParts.map(bp => bp.id);
        pm.test(`Each bookingPart id is included in idsAdmissionAncillariesReservationReference: ${refundPartRefs}`, () => {
            bookingPartIds.forEach(bpId => {
                pm.expect(refundPartRefs, `Expected refundPartRefs to contain bookingPart id: ${bpId}`).to.include.oneOf([bpId]);
            });
        });
    }


}

// Main function to check fulfilled booking
function checkFulFilledBooking(booking, offer, bookingState, fulfillmentState = undefined) {
    booking.bookedOffers.forEach(bookedOffer => {
        validationLogger(`[INFO] Checking bookedOffer ${bookedOffer.offerId}`);

        // Check different parts of the booked offer
        ['admissions', 'reservations', 'ancillaries', 'fees', 'fares'].forEach(partType => {
            checkBookedOfferParts(bookedOffer, partType, bookingState);
        });

        // Check fulfillments
        //TODO : Check if we keep ON_HOLD status to check
        //if (fulfillmentState !== undefined && booking.fulfillments && Array.isArray(booking.fulfillments) && booking.fulfillments.length > 0) {
            //}
            

    });

    // Check if the booking has fulfillments
    if (booking.fulfillments && Array.isArray(booking.fulfillments) && booking.fulfillments.length > 0) {
        booking.fulfillments.forEach(fulfillment => {
            checkFulfillment(booking, fulfillment);
        });
    }

    // Validate passengers
    validatePassengers(booking, offer);

    // Validate purchaser details
    validatePurchaserDetails(booking.purchaser?.detail);

    // Validate fulfillment ID
    //TODO : Check if fulfillmentId[0] injected in POST refund, only the first one is correct
    validateFulfillmentId(booking);

    // Validate prices
    const totalPrice = totalProvisionalOrBookingPrice;
    validatePrices(booking, fulfillmentState, totalPrice);
}

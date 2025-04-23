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

        pm.test(`Passenger ${passenger} returned`, () => {
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
        });
    }
}

// Function to validate fulfillment ID
function validateFulfillmentId(booking) {
    const fulfillmentsId = pm.globals.get("fulfillmentsId");
    if (fulfillmentsId !== undefined) {
        pm.test("Verify fulfillment ID", () => {
            pm.expect(booking.fulfillments[0].id).to.eql(fulfillmentsId);
        });
    }
}

// Function to validate prices
function validatePrices(booking, fulfillmentState, totalPrice) {
    if (fulfillmentState === "FULFILLED") {
        pm.globals.set("bookingConfirmedPrice", booking.confirmedPrice.amount);
        const bookingConfirmedPrice = pm.globals.get("bookingConfirmedPrice");
        const provisionalPrice = pm.globals.get("provisionalPrice");

        pm.test(`Check bookingConfirmedPrice = ${totalPrice} with Admission + Reservation + Ancillaries + Fees + Fares = ${bookingConfirmedPrice}`, () => {
            pm.expect(totalPrice).to.eql(bookingConfirmedPrice);
        });
        pm.test(`Check provisionalPrice = ${provisionalPrice} with bookingConfirmedPrice = ${bookingConfirmedPrice}`, () => {
            pm.expect(provisionalPrice).to.eql(bookingConfirmedPrice);
        });
    } else if (fulfillmentState === undefined) {
        pm.globals.set("provisionalPrice", booking.provisionalPrice.amount);
        const provisionalPrice = pm.globals.get("provisionalPrice");

        pm.test(`Check provisionalPrice = ${totalPrice} with Admission + Reservation + Ancillaries + Fees + Fares = ${provisionalPrice}`, () => {
            pm.expect(totalPrice).to.eql(provisionalPrice);
        });
    }
}

// Function to check fulfillment details
function checkFulfillment(booking, fulfillment, state) {
    pm.test("Correct booking reference is returned on fulfillment", () => {
        pm.expect(fulfillment.bookingRef).to.equal(booking.id);
    });

    const currentDate = new Date();
    const createdOn = new Date(fulfillment.createdOn);

    pm.test("Correct createdOn is returned on fulfillment", () => {
        pm.expect(currentDate.getDate()).to.equal(createdOn.getDate());
        pm.expect(currentDate.getMonth()).to.equal(createdOn.getMonth());
        pm.expect(currentDate.getFullYear()).to.equal(createdOn.getFullYear());
    });

	var sandbox = pm.environment.get("api_base");
	if (sandbox.includes("paxone") && state !== "PREBOOKED") {
        pm.test(`Correct state is returned on fulfillment: ${state}`, () => {
			pm.expect(["FULFILLED", "CONFIRMED"]).to.include(fulfillment.status);
		});
	} else {
		pm.test(`Correct status is returned on fulfillment: ${state}`, () => {
            pm.expect(fulfillment.status).to.equal(state);
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
        validationLogger("[DEBUG] 🪲 checkFulFilledBooking method 1");

        // Check fulfillments
        if (fulfillmentState !== undefined && booking.fulfillments && Array.isArray(booking.fulfillments) && booking.fulfillments.length > 0) {
            booking.fulfillments.forEach(fulfillment => {
                checkFulfillment(booking, fulfillment, fulfillmentState);
            });
        }
        validationLogger("[DEBUG] 🪲 checkFulFilledBooking method 2");

        // Validate passengers
        validatePassengers(booking, offer);

        // Validate purchaser details
        validatePurchaserDetails(booking.purchaser?.detail);
    });

    // Validate fulfillment ID
    validateFulfillmentId(booking);

    // Validate prices
    const totalPrice = totalProvisionalOrBookingPrice;
    validatePrices(booking, fulfillmentState, totalPrice);
}

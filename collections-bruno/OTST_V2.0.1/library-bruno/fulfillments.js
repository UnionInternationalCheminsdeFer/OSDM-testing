// Import needed library files
const display = require('./displays.js');
const { bruTest: test } = require('./testCapture.js');

module.exports = {
  checkBookedOfferParts,
  validatePassengers,
  validatePurchaserDetails,
  validateFulfillmentId,
  validatePrices,
  checkFulfillment,
  getBookingFulfillmentResponse
};

function checkGenericBookedOfferPart(bookedOfferPart, bookingState, partType) {
  test(`${partType} booked offer part is an object`, () => {
    expect(bookedOfferPart).to.be.an("object").that.is.not.empty;
  });

  test(`${partType} booked offer part has id`, () => {
    expect(bookedOfferPart.id).to.be.a("string").and.not.be.empty;
  });

  if (bookingState != null) {
    test(`${partType} booked offer part status is valid`, () => {
      expect(bookedOfferPart.status).to.be.a("string").and.not.be.empty;
    });
  }
}

// Utility function to check and iterate over booked offer parts
function checkBookedOfferParts(bookedOffer, partType, bookingState) {
  const parts = bookedOffer[partType];
  if (Array.isArray(parts) && parts.length > 0) {
    parts.forEach(bookedOfferPart => {
      // checkGenericBookedOfferPart is expected to be globally available (from bookings.js)
      checkGenericBookedOfferPart(bookedOfferPart, bookingState, partType);
    });
  }
}

// Function to validate passengers
function validatePassengers(booking, offer) {
  validationLogger("[INFO] ➤ validatePassengers");
  offer.passengerRefs.forEach(passenger => {
    const found = booking.passengers.some(bookedPassenger => {
      return bookedPassenger.externalRef === passenger;
    });

    test(`Passenger ${passenger} with correct externalRef returned`, () => {
      expect(found).to.equal(true);
    });
  });
}

// Function to validate purchaser details
function validatePurchaserDetails(purchaserDetail) {
  validationLogger("[INFO] ➤ validatePurchaserDetails");
  if (purchaserDetail) {
    // Some sandboxes (e.g. Turnit OSDM < 3.4) use flat detail.email/phoneNumber;
    // others (Paxone, Bileto, Sqills OSDM >= 3.4) use detail.contact.email/phoneNumber
    const email = purchaserDetail.contact?.email || purchaserDetail.email;
    const phoneNumber = purchaserDetail.contact?.phoneNumber || purchaserDetail.phoneNumber;
    test("Correct Purchaser is returned", () => {
      expect(purchaserDetail.firstName).to.not.be.empty;
      expect(purchaserDetail.lastName).to.not.be.empty;
      expect(email, "purchaser email should exist").to.not.be.empty;
      expect(phoneNumber, "purchaser phoneNumber should exist").to.not.be.empty;
    });
  }
}

// Function to validate fulfillment IDs
function validateFulfillmentId(booking) {
  validationLogger("[INFO] ➤ validateFulfillmentId");
  const fulfillmentsIdRaw = bru.getEnvVar("fulfillmentIds");
  if (fulfillmentsIdRaw) {
    const expectedIds = Array.isArray(fulfillmentsIdRaw) ? fulfillmentsIdRaw : JSON.parse(fulfillmentsIdRaw);
    let actualIds = [];

    if (booking.fulfillments && booking.fulfillments.length > 0) {
      actualIds = booking.fulfillments.map(f => f.id);
      actualIds.forEach((id, index) => {
        test(`booking.fulfillments[${index}].id (${id}) should be one of expected fulfillments`, () => {
          expect(id).to.be.oneOf(expectedIds);
        });
      });
    }
  }
}

// Function to validate prices
function validatePrices(booking, fulfillmentState, totalPrice) {
  validationLogger("[INFO] ➤ validatePrices");
  if (fulfillmentState != null) {
    bru.setEnvVar("bookingConfirmedPrice", booking.confirmedPrice.amount);
    const bookingConfirmedPrice = Number(bru.getEnvVar("bookingConfirmedPrice"));
    const provisionalPrice = Number(bru.getEnvVar("provisionalPrice"));

    test(`Compare provisionalPrice = ${provisionalPrice} with bookingConfirmedPrice = ${bookingConfirmedPrice}`, () => {
      expect(provisionalPrice).to.eql(bookingConfirmedPrice);
    });
    test(`Compare bookingConfirmedPrice = ${bookingConfirmedPrice} with Booking Admission + Reservation + Ancillaries + Fees + Fares = ${totalPrice}`, () => {
      expect(bookingConfirmedPrice).to.eql(Number(totalPrice));
    });
  } else {
    bru.setEnvVar("provisionalPrice", booking.provisionalPrice.amount);
    const provisionalPrice = Number(bru.getEnvVar("provisionalPrice"));

    test(`Compare provisionalPrice = ${provisionalPrice} with Booking Admission + Reservation + Ancillaries + Fees + Fares = ${totalPrice}`, () => {
      expect(provisionalPrice).to.eql(Number(totalPrice));
    });
  }
}

// Function to check fulfillment details
function checkFulfillment(booking, fulfillment) {
  validationLogger("[INFO] ➤ checkFulfillment");
  const currentDate = new Date();
  const createdOn = new Date(fulfillment.createdOn);

  test("Correct booking reference is returned on fulfillment", () => {
    validationLogger(`[INFO] Booking reference in fulfillments : ${fulfillment.bookingRef}, expected booking id : ${booking.id}`);
    expect(fulfillment.bookingRef).to.equal(booking.id);
  });

  test("ControlNumber is returned on fulfillment", () => {
    validationLogger(`[INFO] Fulfillment controlNumber : ${fulfillment.controlNumber}`);
    expect(fulfillment.controlNumber).to.exist;
  });

  test(`CreatedOn is returned on fulfillment`, () => {
    validationLogger(`[INFO] Fulfillment createdOn : ${fulfillment.createdOn}`);
    expect(currentDate.toDateString()).to.equal(createdOn.toDateString());
  });

  test(`Correct state AVAILABLE, ON_HOLD, FULFILLED or CONFIRMED is returned on fulfillment: ${fulfillment.status}`, () => {
    validationLogger(`[INFO] Fulfillment status : ${fulfillment.status}`);
    expect(["FULFILLED", "CONFIRMED", "ON_HOLD", "AVAILABLE"]).to.include(fulfillment.status);
  });

  const _refundPartRefsRaw = bru.getEnvVar("admissionReservationAncillaryBookingPartsIds");
  const refundPartRefs = Array.isArray(_refundPartRefsRaw) ? _refundPartRefsRaw : JSON.parse(_refundPartRefsRaw || "[]");
  let bookingPartIds = [];

  if (fulfillment.bookingParts && fulfillment.bookingParts.length > 0) {
    bookingPartIds = fulfillment.bookingParts.map(bp => bp.id);
    test(`Each bookingPart id is included in idsAdmissionAncillariesReservationReference: ${refundPartRefs}`, () => {
      bookingPartIds.forEach(bpId => {
        expect(refundPartRefs, `Expected refundPartRefs to contain bookingPart id: ${bpId}`).to.include(bpId);
      });
    });
  }
}

// Main function to check fulfilled booking
function getBookingFulfillmentResponse(booking, offer, bookingState, fulfillmentState = undefined) {
  booking.bookedOffers.forEach(bookedOffer => {
    validationLogger(`[INFO] Checking bookedOffer ${bookedOffer.offerId}`);

    // Check different parts of the booked offer
    ['admissions', 'reservations', 'ancillaries', 'fees', 'fares'].forEach(partType => {
      checkBookedOfferParts(bookedOffer, partType, bookingState);
    });

    // Fulfillment checks are performed after the loop below
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
  // TODO : Check if fulfillmentId[0] injected in POST refund, only the first one is correct
  validateFulfillmentId(booking);

  // Validate prices
  // totalProvisionalOrBookingPrice is never set externally → compute it from offer part prices stored by offers.js
  const _admissionPrice  = Number(bru.getEnvVar("admissionPartsPrice")  || 0);
  const _reservationPrice = Number(bru.getEnvVar("reservationPartsPrice") || 0);
  const _ancillaryPrice   = Number(bru.getEnvVar("ancillaryPartsPrice")   || 0);
  const totalPrice = _admissionPrice + _reservationPrice + _ancillaryPrice;
  validatePrices(booking, fulfillmentState, totalPrice);
}

// Expose to global for convenience in eval/require loader flows
try {
  Object.assign(globalThis, module.exports);
} catch (e) {
  // no-op
}

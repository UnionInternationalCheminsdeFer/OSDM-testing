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
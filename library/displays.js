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
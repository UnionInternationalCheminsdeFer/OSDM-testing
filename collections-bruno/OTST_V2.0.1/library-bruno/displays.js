module.exports = {
  validationLogger,
  displayOfferResponse,
  displayBookingResponse,
  displayFulFilledBooking
};

// Function to log validation messages based on logging type (env-scoped)
function validationLogger(message) {
  var loggingType = bru.getEnvVar("loggingType") || "INFO";
  var shouldLog = false;
  
  switch (loggingType) {
    case "FULL":
      shouldLog = true;
      break;
    case "INFO":
      if (
        message.includes("[INFO]") ||
        message.includes("[WARN]") ||
        message.includes("[WARNING]") ||
        message.includes("[ERROR]")
      ) {
        shouldLog = true;
      }
      break;
    case "WARN":
      if (
        message.includes("[WARN]") ||
        message.includes("[WARNING]") ||
        message.includes("[ERROR]")
      ) {
        shouldLog = true;
      }
      break;
    case "ERROR":
      if (message.includes("[ERROR]")) {
        shouldLog = true;
      }
      break;
    case "DEBUG":
      if (message.includes("[DEBUG]") || message.includes("[INFO]")) {
        shouldLog = true;
      }
      break;
    default:
      if (message.includes("[INFO]")) {
        shouldLog = true;
      }
      break;
  }
  
  if (shouldLog) {
    // Print to console
    console.log(message);
    
    // ALSO capture to report logs (for HTML report)
    try {
      var existing = JSON.parse(bru.getVar('__rptLogs') || '[]');
      // Extract log level from message if possible
      var level = 'log';
      if (message.includes('[ERROR]')) level = 'error';
      else if (message.includes('[WARN]')) level = 'warn';
      else if (message.includes('[WARNING]')) level = 'warn';
      else if (message.includes('[INFO]')) level = 'info';
      
      existing.push({ level: level, message: message });
      bru.setVar('__rptLogs', JSON.stringify(existing));
    } catch (_e) {}
  }
}

function displayOfferResponse(response) {
  try {
    if (!response || !response.offers || response.offers.length === 0) {
      validationLogger("[FULL] Error: No offers found in the response.");
      return;
    }
    let includedReservations = null;
    let isTrainBound = false;

    response.offers.forEach((offer, index) => {
      validationLogger(`[FULL] Offer ${index + 1} Details:`);
      validationLogger(
        `[FULL]   Minimal Price amount: ${offer.offerSummary?.minimalPrice?.amount || "Not available"}`
      );
      validationLogger(
        `[FULL]   Overall Flexibility: ${offer.offerSummary?.overallFlexibility || "Not available"}`
      );
      validationLogger(
        `[FULL]   Overall ServiceClass: ${offer.offerSummary?.overallServiceClass?.name || "Not available"}`
      );
      validationLogger(
        `[FULL]   Overall TravelClass: ${offer.offerSummary?.overallTravelClass || "Not available"}`
      );
      validationLogger(
        `[FULL]   Overall AccommodationType: ${offer.offerSummary?.overallAccommodationType || "Not available"}`
      );
      validationLogger(
        `[FULL]   Overall AccommodationSubType: ${offer.offerSummary?.overallAccommodationSubType || "Not available"}`
      );

      (offer.admissionOfferParts || []).forEach((admissionPart, partIndex) => {
        validationLogger(`[FULL]   Admission Offer Part ${partIndex + 1}:`);
        validationLogger(
          `[FULL]       Summary: ${admissionPart?.summary || "Not available"}`
        );
        validationLogger(
          `[FULL]       Price: ${
            admissionPart?.price?.amount
              ? `${admissionPart.price.amount} ${admissionPart.price.currency || "Unknown currency"}`
              : "Not available"
          }`
        );

        if (admissionPart?.includedReservations?.length > 0) {
          includedReservations = admissionPart.includedReservations;
          admissionPart.includedReservations.forEach((reservation, reservationIndex) => {
            validationLogger(`[FULL]     Included Reservation ${reservationIndex + 1}:`);
            validationLogger(`[FULL]       ID: ${reservation?.id || "Not available"}`);
            validationLogger(`[FULL]       Summary: ${reservation?.summary || "Not available"}`);
            validationLogger(`[FULL]       Created On: ${reservation?.createdOn || "Not available"}`);
            validationLogger(`[FULL]       Valid From: ${reservation?.validFrom || "Not available"}`);
            validationLogger(`[FULL]       Valid Until: ${reservation?.validUntil || "Not available"}`);
            validationLogger(
              `[FULL]       Price: ${
                reservation?.price?.amount
                  ? `${reservation.price.amount} ${reservation.price.currency || "Unknown currency"}`
                  : "Not available"
              }`
            );
          });
        } else {
          validationLogger(`[FULL]   No included reservations.`);
        }
      });

      (offer.products || []).forEach((product, productIndex) => {
        isTrainBound = product?.isTrainBound || false;
        validationLogger(`[FULL]   Product ${productIndex + 1}:`);
        validationLogger(`[FULL]       Product Summary: ${product?.summary || "Not available"}`);
        validationLogger(`[FULL]       Product Type: ${product?.type || "Not available"}`);
        validationLogger(`[FULL]       Train is bound: ${isTrainBound}`);
      });

      if (!isTrainBound && !includedReservations) {
        validationLogger(`[FULL]       NRT: Train is not bound, and no included reservations.`);
      } else if (isTrainBound && !includedReservations) {
        validationLogger(`[FULL]       TLT: Train is bound, but no included reservations.`);
      } else if (isTrainBound && Array.isArray(includedReservations)) {
        validationLogger(`[FULL]       IRT: Train is bound, and included reservations present.`);
      }

      validationLogger(
        `[FULL]   Number of passengers: ${response.anonymousPassengerSpecifications?.length || 0}`
      );
      validationLogger(
        `[FULL]       Type: ${
          response.anonymousPassengerSpecifications
            ?.map((spec) => spec?.type || "Unknown")
            .join(", ") || "None"
        }`
      );
      validationLogger(
        `[FULL]       Cards: ${
          response.anonymousPassengerSpecifications
            ?.map((spec) => (spec?.cards ? spec.cards.join(", ") : "None"))
            .join(", ") || "None"
        }`
      );

      (response.trips || []).forEach((trip, tripIndex) => {
        validationLogger(`[FULL]   Trip ${tripIndex + 1} Summary: ${trip?.summary || "Not available"}`);
        validationLogger(`[FULL]   Number of trip legs: ${trip?.legs?.length || 0}`);
        validationLogger(`[FULL]   Start Time: ${trip?.startTime || "Not available"}`);
        validationLogger(`[FULL]   End Time: ${trip?.endTime || "Not available"}`);

        (trip?.legs || []).forEach((leg, legIndex) => {
          validationLogger(`[FULL]     Leg ${legIndex + 1} Details:`);
          validationLogger(
            `[FULL]         Start Stop Place Name: ${leg?.timedLeg?.start?.stopPlaceName || "Not available"}`
          );
          validationLogger(
            `[FULL]         End Stop Place Name: ${leg?.timedLeg?.end?.stopPlaceName || "Not available"}`
          );
          validationLogger(
            `[FULL]         Vehicle Numbers: ${
              leg?.timedLeg?.service?.vehicleNumbers
                ? leg.timedLeg.service.vehicleNumbers.join(", ")
                : "None"
            }`
          );
          validationLogger(
            `[FULL]         Line Numbers: ${
              leg?.timedLeg?.service?.lineNumbers
                ? leg.timedLeg.service.lineNumbers.join(", ")
                : "None"
            }`
          );
        });
      });
    });
  } catch (error) {
    validationLogger(`[FULL] Error processing the offer response: ${error.message}`);
  }
}

function displayBookingResponse(response) {
  try {
    const booking = response?.booking;
    if (!booking) { validationLogger("[FULL] displayBookingResponse: no booking in response"); return; }

    validationLogger(`[FULL] Booking ID: ${booking.id ?? "N/A"}`);
    validationLogger(`[FULL] Booking Code: ${booking.bookingCode ?? "N/A"}`);
    validationLogger(`[FULL] External Reference: ${booking.externalRef ?? "N/A"}`);
    validationLogger(`[FULL] Created On: ${booking.createdOn ?? "N/A"}`);
    validationLogger(`[FULL] Provisional Price: ${booking.provisionalPrice?.amount ?? "N/A"} ${booking.provisionalPrice?.currency ?? ""}`);
    validationLogger(`[FULL] Number of Passengers: ${booking.passengers?.length ?? 0}`);

    (booking.passengers || []).forEach((passenger, passengerIndex) => {
      validationLogger(`[FULL] Passenger ${passengerIndex + 1} Details:`);
      validationLogger(`[FULL]   Passenger ID: ${passenger?.id ?? "N/A"}`);
      validationLogger(`[FULL]   Type: ${passenger?.type ?? "N/A"}`);
      validationLogger(`[FULL]   Date of Birth: ${passenger?.dateOfBirth ?? "N/A"}`);
      validationLogger(`[FULL]   Cards: ${passenger?.cards?.join(", ") ?? "None"}`);
    });

    (booking.trips || []).forEach((trip, tripIndex) => {
      validationLogger(`[FULL] Trip ${tripIndex + 1} Summary: ${trip?.summary ?? "N/A"}`);
      validationLogger(`[FULL]   Trip ID: ${trip?.id ?? "N/A"}`);
      validationLogger(`[FULL]   Direction: ${trip?.direction ?? "N/A"}`);
      validationLogger(`[FULL]   Start Time: ${trip?.startTime ?? "N/A"}`);
      validationLogger(`[FULL]   End Time: ${trip?.endTime ?? "N/A"}`);
      validationLogger(`[FULL]   Duration: ${trip?.duration ?? "N/A"}`);
      validationLogger(`[FULL]   Distance: ${trip?.distance ?? "N/A"} meters`);

      (trip?.legs || []).forEach((leg, legIndex) => {
        validationLogger(`[FULL]     Leg ${legIndex + 1} Details:`);
        validationLogger(`[FULL]       Leg ID: ${leg?.id ?? "N/A"}`);
        validationLogger(`[FULL]       Start Stop Place Name: ${leg?.timedLeg?.start?.stopPlaceName ?? "N/A"}`);
        validationLogger(`[FULL]       End Stop Place Name: ${leg?.timedLeg?.end?.stopPlaceName ?? "N/A"}`);
        validationLogger(`[FULL]       Start Time: ${leg?.timedLeg?.start?.serviceDeparture?.timetabledTime ?? "N/A"}`);
        validationLogger(`[FULL]       End Time: ${leg?.timedLeg?.end?.serviceArrival?.timetabledTime ?? "N/A"}`);
        validationLogger(`[FULL]       Vehicle Numbers: ${leg?.timedLeg?.service?.vehicleNumbers?.join(", ") ?? "None"}`);
        validationLogger(`[FULL]       Line Numbers: ${leg?.timedLeg?.service?.lineNumbers?.join(", ") ?? "None"}`);
      });
    });

    (booking.bookedOffers || []).forEach((offer, offerIndex) => {
      validationLogger(`[FULL] Offer ${offerIndex + 1} Details:`);
      validationLogger(`[FULL]   Offer ID: ${offer?.offerId ?? "N/A"}`);
      validationLogger(`[FULL]   Reservations: ${offer?.reservations?.length ?? 0} reservation(s)`);

      (offer?.reservations || []).forEach((reservation, reservationIndex) => {
        validationLogger(`[FULL]     Reservation ${reservationIndex + 1} Details:`);
        validationLogger(`[FULL]       Object Type: ${reservation?.objectType ?? "N/A"}`);
        validationLogger(`[FULL]       Status: ${reservation?.status ?? "N/A"}`);
        validationLogger(`[FULL]       Valid From: ${reservation?.validFrom ?? "N/A"}`);
        validationLogger(`[FULL]       Valid Until: ${reservation?.validUntil ?? "N/A"}`);
        validationLogger(`[FULL]       Price: ${reservation?.price?.amount ?? "N/A"} ${reservation?.price?.currency ?? ""}`);
        validationLogger(`[FULL]       Refundable: ${reservation?.refundable ?? "N/A"}`);
        validationLogger(`[FULL]       Exchangeable: ${reservation?.exchangeable ?? "N/A"}`);
      });
    });
  } catch (error) {
    validationLogger(`[FULL] Error in displayBookingResponse: ${error.message}`);
  }
}

function displayFulFilledBooking(response) {
  try {
    if (!response?.booking) {
      validationLogger("[FULL] Error: Booking information is missing from the response.");
      return;
    }

    validationLogger(`[FULL] Booking ID: ${response.booking?.id ?? "Not available"}`);
    validationLogger(`[FULL] Booking Code: ${response.booking?.bookingCode ?? "Not available"}`);
    validationLogger(`[FULL] External Reference: ${response.booking?.externalRef ?? "Not available"}`);
    validationLogger(`[FULL] Created On: ${response.booking?.createdOn ?? "Not available"}`);
    validationLogger(
      `[FULL] Provisional Price: ${
        response.booking?.provisionalPrice
          ? response.booking.provisionalPrice.amount + " " + response.booking.provisionalPrice.currency
          : "Not available"
      }`
    );
    validationLogger(
      `[FULL] Confirmed Price: ${
        response.booking?.confirmedPrice
          ? response.booking.confirmedPrice.amount + " " + response.booking.confirmedPrice.currency
          : "Not available"
      }`
    );
    validationLogger(
      `[FULL] Number of Passengers: ${response.booking?.passengers?.length ?? "Not available"}`
    );

    response.booking?.passengers?.forEach((passenger, passengerIndex) => {
      validationLogger(`[FULL] Passenger ${passengerIndex + 1} Details:`);
      validationLogger(`[FULL]   Passenger ID: ${passenger?.id ?? "Not available"}`);
      validationLogger(`[FULL]   Type: ${passenger?.type ?? "Not available"}`);
      validationLogger(`[FULL]   Date of Birth: ${passenger?.dateOfBirth ?? "Not available"}`);
      validationLogger(
        `[FULL]   Cards: ${passenger?.cards?.join(", ") ?? "None"}`
      );
    });

    response.booking?.trips?.forEach((trip, tripIndex) => {
      validationLogger(`[FULL] Trip ${tripIndex + 1} Summary: ${trip?.summary ?? "Not available"}`);
      validationLogger(`[FULL]   Trip ID: ${trip?.id ?? "Not available"}`);
      validationLogger(`[FULL]   Direction: ${trip?.direction ?? "Not available"}`);
      validationLogger(`[FULL]   Start Time: ${trip?.startTime ?? "Not available"}`);
      validationLogger(`[FULL]   End Time: ${trip?.endTime ?? "Not available"}`);
      validationLogger(`[FULL]   Duration: ${trip?.duration ?? "Not available"}`);
      validationLogger(
        `[FULL]   Distance: ${trip?.distance ?? "Not available"} meters`
      );

      trip?.legs?.forEach((leg, legIndex) => {
        validationLogger(`[FULL]     Leg ${legIndex + 1} Details:`);
        validationLogger(`[FULL]       Leg ID: ${leg?.id ?? "Not available"}`);
        validationLogger(
          `[FULL]       Start Stop Place Name: ${leg?.timedLeg?.start?.stopPlaceName ?? "Not available"}`
        );
        validationLogger(
          `[FULL]       End Stop Place Name: ${leg?.timedLeg?.end?.stopPlaceName ?? "Not available"}`
        );
        validationLogger(
          `[FULL]       Start Time: ${leg?.timedLeg?.start?.serviceDeparture?.timetabledTime ?? "Not available"}`
        );
        validationLogger(
          `[FULL]       End Time: ${leg?.timedLeg?.end?.serviceArrival?.timetabledTime ?? "Not available"}`
        );
        validationLogger(
          `[FULL]       Vehicle Numbers: ${
            leg?.timedLeg?.service?.vehicleNumbers?.join(", ") ?? "None"
          }`
        );
        validationLogger(
          `[FULL]       Line Numbers: ${
            leg?.timedLeg?.service?.lineNumbers?.join(", ") ?? "None"
          }`
        );
      });
    });

    response.booking?.bookedOffers?.forEach((offer, offerIndex) => {
      validationLogger(`[FULL] Offer ${offerIndex + 1} Details:`);
      validationLogger(`[FULL]   Offer ID: ${offer?.offerId ?? "Not available"}`);
      validationLogger(
        `[FULL]   Reservations: ${offer?.reservations?.length ?? 0} reservation(s)`
      );

      offer?.reservations?.forEach((reservation, reservationIndex) => {
        validationLogger(`[FULL]     Reservation ${reservationIndex + 1} Details:`);
        validationLogger(`[FULL]       Object Type: ${reservation?.objectType ?? "Not available"}`);
        validationLogger(`[FULL]       Status: ${reservation?.status ?? "Not available"}`);
        validationLogger(`[FULL]       Valid From: ${reservation?.validFrom ?? "Not available"}`);
        validationLogger(`[FULL]       Valid Until: ${reservation?.validUntil ?? "Not available"}`);
        validationLogger(
          `[FULL]       Price: ${
            reservation?.price
              ? reservation.price.amount + " " + reservation.price.currency
              : "Not available"
          }`
        );
        validationLogger(
          `[FULL]       Refundable: ${
            reservation?.refundable != null ? reservation.refundable : "Not available"
          }`
        );
        validationLogger(
          `[FULL]       Exchangeable: ${
            reservation?.exchangeable != null ? reservation.exchangeable : "Not available"
          }`
        );
      });
    });

    if (response.booking?.fulfillments?.length > 0) {
      validationLogger(
        `[FULL] Number of Fulfillments: ${response.booking.fulfillments.length}`
      );
      response.booking.fulfillments.forEach((fulfillment, fulfillmentIndex) => {
        validationLogger(`[FULL] Fulfillment ${fulfillmentIndex + 1} Details:`);
        validationLogger(
          `[FULL]   Fulfillment ID: ${fulfillment?.id ?? "Not available"}`
        );
        validationLogger(`[FULL]   Status: ${fulfillment?.status ?? "Not available"}`);
        validationLogger(
          `[FULL]   Booking Reference: ${fulfillment?.bookingRef ?? "Not available"}`
        );
        validationLogger(`[FULL]   Created On: ${fulfillment?.createdOn ?? "Not available"}`);
        validationLogger(
          `[FULL]   Control Number: ${fulfillment?.controlNumber ?? "Not available"}`
        );

        fulfillment?.bookingParts?.forEach((part, partIndex) => {
          validationLogger(`[FULL]     Booking Part ${partIndex + 1} Details:`);
          validationLogger(`[FULL]       Part ID: ${part?.id ?? "Not available"}`);
          validationLogger(`[FULL]       Summary: ${part?.summary ?? "Not available"}`);
        });

        validationLogger(
          `[FULL]   Fulfillment Documents: ${
            fulfillment?.fulfillmentDocuments?.length ?? "None"
          }`
        );
      });
    } else {
      validationLogger(`[FULL] No fulfillments found.`);
    }
  } catch (error) {
    validationLogger(`[FULL] Error processing the booking data: ${error.message}`);
  }
}

// Optionally attach to global for convenience
try {
  Object.assign(globalThis, module.exports);
} catch (e) {
  // no-op
}

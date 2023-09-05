setAuthToken = function () {
    let jsonData = JSON.parse(responseBody);
    
    pm.globals.set(GV.ACCESS_TOKEN, jsonData.access_token);
}

osdmAnonymousPassengerSpecifications = function(passengerNumber) {
    pm.globals.set(OFFER.PASSENGER_NUMBER, passengerNumber);

    var passengerSpecs = [];

    for (let n = 1; n <= passengerNumber; n++) {
        var passengerKey = OFFER.PASSENGER_SPECIFICATION_EXTERNAL_REF_PATTERN.replace("%PASSENGER_COUNT%", n);

        var birthDate = new Date();
        birthDate.setFullYear(birthDate.getFullYear() - 26);
        birthDate.setDate(birthDate.getDate() -1);

        pm.globals.set(passengerKey, uuid.v4());

        passengerSpecs.push(new AnonymousPassengerSpec(
            pm.globals.get(passengerKey),
            PassengerType.PERSON,
            birthDate.toISOString().substring(0,10),
        ));
    }

    pm.globals.set(OFFER.PASSENGER_SPECIFICATIONS, JSON.stringify(passengerSpecs));
};

osdmOfferSearchCriteria = function (
    currency,
    offerMode,
    offerParts,
    flexibilities,
    serviceClassTypes,
    travelClasses,
    productTags,
) {
    var offerSearchCriteria = new Object();

    if (currency != null && currency != '') {
        offerSearchCriteria.currency = currency;

        pm.globals.set(OFFER.SEARCH_CRITERIA_CURRENCY, currency);
    }

    if (Array.isArray(offerParts) && offerParts.length > 0) {
        offerSearchCriteria.requestedOfferParts = offerParts;
    }

    if (Array.isArray(serviceClassTypes) && serviceClassTypes.length > 0) {
        offerSearchCriteria.serviceClassTypes = serviceClassTypes;
    }

    if (Array.isArray(travelClasses) && travelClasses.length > 0) {
        offerSearchCriteria.travelClasses = travelClasses;
    }

    pm.globals.set(OFFER.SEARCH_CRITERIA, JSON.stringify(offerSearchCriteria));
};

osdmFulfillmentOptions = function(requestedFulfillmentOptions) {
    if (Array.isArray(requestedFulfillmentOptions) && requestedFulfillmentOptions.length > 0) {
        pm.globals.set(OFFER.FULFILLMENT_OPTIONS, JSON.stringify(requestedFulfillmentOptions));
    }
};

validateOfferConformsToOfferSearchCriteria = function (offer) {
};

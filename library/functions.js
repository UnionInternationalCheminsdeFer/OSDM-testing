setAuthToken = function () {
    let jsonData = JSON.parse(responseBody);
    
    pm.globals.set(GV.ACCESS_TOKEN, jsonData.access_token);
}

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
    console.log(requestedFulfillmentOptions);

    if (Array.isArray(requestedFulfillmentOptions) && requestedFulfillmentOptions.length > 0) {
        pm.globals.set(OFFER.FULFILLMENT_OPTIONS, JSON.stringify(requestedFulfillmentOptions));
    }
};

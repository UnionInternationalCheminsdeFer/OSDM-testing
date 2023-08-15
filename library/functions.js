setAuthToken = function () {
    let jsonData = JSON.parse(responseBody);
    
    pm.globals.set(GV.ACCESS_TOKEN, jsonData.access_token);
}

osdmOfferSearchCriteria = function (
    currency,
    offerParts,
    serviceClassTypes,
    comfortClasses,
) {
    var offerSearchCriteria = new Object();

    if (!currency) {
        offerSearchCriteria.currency = currency;
    }

    pm.globals.set('offer_search_criteria', offerSearchCriteria);
};

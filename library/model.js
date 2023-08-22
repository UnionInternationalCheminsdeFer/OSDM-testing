var GV = {
    ACCESS_TOKEN : "access_token",
}

var OFFER = {
    SEARCH_CRITERIA_CURRENCY : "offer_search_criteria_currency",
    SEARCH_CRITERIA : "offer_search_criteria",
    FULFILLMENT_OPTIONS : "offer_fulfillment_options",
}

var OfferPartType = {
    ADMISSION: "ADMISSION",
    RESERVATION: "RESERVATION",
    ANCILLARY: "ANCILLARY",
    FARE_ADMISSION: "FARE_ADMISSION",
    FARE_RESERVATION: "FARE_RESERVATION",
    FARE_ANCILLARY: "FARE_ANCILLARY",
    ALL: "ALL",
}

var ServiceClassType = {
    BEST: "BEST",
    HIGH: "HIGH",
    STANDARD: "STANDARD",
    BASIC: "BASIC",
    ANY_CLASS: "ANY_CLASS",
}

var TravelClass = {
    FIRST: "FIRST",
    SECOND: "SECOND",
    ANY_CLASS: "ANY_CLASS",
}

var FulfillmentOptionType = {
    ETICKET: "ETICKET",
    CIT_PAPER: "CIT_PAPER",
    PASS_CHIP: "PASS_CHIP",
    PASS_REFERENCE: "PASS_REFERENCE",
};

var FulfillmentMediaType = {
    ALLOCATOR_APP: "ALLOCATOR_APP",
    PDF_A4: "PDF_A4",
    PKPASS: "PKPASS",
    RCCST: "RCCST",
    RCT2: "RCT2",
    UIC_PDF: "UIC_PDF",
    TICKETLESS: "TICKETLESS",
};

var FulfillmentOption = class {
    constructor(type, media) {
        this.type = type;
        this.media = media;
    }
}

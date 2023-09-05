var GV = {
    ACCESS_TOKEN : "access_token",
}

var TRIP = {
    EXTERNAL_REF: "trip_external_ref",
    LEG_SPECIFICATION_REF_PATTERN: "trip_leg_%LEG_COUNT%_external_ref",
};

var OFFER = {
    PASSENGER_NUMBER : "offer_passenger_number",
    PASSENGER_SPECIFICATIONS : "offer_passenger_specifications",
    PASSENGER_SPECIFICATION_EXTERNAL_REF_PATTERN: "passenger_specification_%PASSENGER_COUNT%_external_ref",
    TRIP_SPECIFICATIONS : "offer_trip_specifications",
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

var PassengerType = {
    PERSON: "PERSON",
    DOG: "DOG",
    PET: "PET",
    LUGGAGE: "LUGGAGE",
    PRM: "PRM",
    BICYCLE: "BICYCLE",
    PRAM: "PRAM",
    COMPANION_DOG: "COMPANION_DOG",
    CAR: "CAR",
    MOTORCYCLE: "MOTORCYCLE",
    TRAILER: "TRAILER",
    FAMILY_CHILD: "FAMILY_CHILD",
    WHEELCHAIR: "WHEELCHAIR"
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

var AnonymousPassengerSpec = class {
    constructor(externalRef, type, dateOfBirth) {
        this.externalRef = externalRef;
        this.type = type;
        this.dateOfBirth = dateOfBirth;
    }
}

var TripLegDefinition = class {
    constructor(startStopPlaceRef, startDateTime, endStopPlaceRef, endDateTime, vehicleNumber, carrier) {
        this.startStopPlaceRef = startStopPlaceRef;
        this.startDateTime = startDateTime;
        this.endStopPlaceRef = endStopPlaceRef;
        this.endDateTime = endDateTime;
        this.vehicleNumber = vehicleNumber;
        this.carrier = carrier;
    }
}

var TripSpecification = class {
    constructor(externalRef, legs) {
        this.externalRef = externalRef;
        this.legs = legs;
    }
};

var TripLegSpecification = class {
    constructor(externalRef, timedLeg) {
        this.externalRef = externalRef;
        this.timedLeg = timedLeg;
    }
};

var TimedLegSpecification = class {
    constructor(start, end, service) {
        this.start = start;
        this.end = end;
        this.service = service;
    }
}

var DatedJourney = class {
    constructor(vehicleNumbers, carriers) {
        this.productCategory = new ProductCategory();
        this.vehicleNumbers = vehicleNumbers;
        this.carriers = carriers;
    }
};

var NamedCompany = class {
    constructor(ref) {
        this.ref = ref;
    }
};

var ProductCategory = class {
    constructor() {
        this.productCategoryRef = "urn:uic:sbc:37";
        this.name = "Normal Train";
        this.shortName = "Train";
    }
};

var BoardSpecification = class {
    constructor(stopPlaceRef, serviceDeparture) {
        this.stopPlaceRef = stopPlaceRef;
        this.serviceDeparture = serviceDeparture;
    }
};

var AlignSpecification = class {
    constructor(stopPlaceRef, serviceArrival) {
        this.stopPlaceRef = stopPlaceRef;
        this.serviceArrival = serviceArrival;
    }
}

var StopPlaceRef = class {
    constructor(stopPlaceRef) {
        this.objectType = "StopPlaceRef";
        this.stopPlaceRef = stopPlaceRef;
    }
};

var ServiceTime = class {
    constructor(timetabledTime) {
        this.timetabledTime = timetabledTime;
    }
};

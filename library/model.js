/*
Copyright UIC, Union Internationale des Chemins de fer
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

No reproduction nor distribution shall be allowed without the following notice
“This material is copyrighted by UIC, Union Internationale des Chemins de fer © 2023  – 2024 , OSDM is a trademark belonging to UIC, and any use of this trademark is strictly prohibited unless otherwise agreed by UIC.”
*/

var GV = {
    ACCESS_TOKEN : "access_token",
}

var TRIP = {
    EXTERNAL_REF: "tripExternalRef",
    LEG_SPECIFICATION_REF_PATTERN: "tripLeg%LEG_COUNT%ExternalRef",
};

var OFFER = {
    PASSENGER_NUMBER : "offerPassengerNumber",
    PASSENGER_SPECIFICATIONS : "offerPassengerSpecifications",
    PASSENGER_SPECIFICATION_EXTERNAL_REF_PATTERN: "passengerSpecification%PASSENGER_COUNT%ExternalRef",
    TRIP_SPECIFICATIONS : "offerTripSpecifications",
    TRIP_SEARCH_CRITERIA : "offerTripSearchCriteria",
    SEARCH_CRITERIA_CURRENCY : "offerSearchCriteriaCurrency",
    SEARCH_CRITERIA_SERVICE_CLASS : "offerSearchCriteriaServiceClass",
    SEARCH_CRITERIA_TRAVEL_CLASS : "offerSearchCriteriaTravelClass",
    SEARCH_CRITERIA : "offerSearchCriteria",
    FULFILLMENT_OPTIONS : "offerFulfillmentOptions",
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

var BOOKING = {
	PASSENGER_SPECIFICATIONS : "bookingPassengerSpecifications",
	PASSENGER_REFERENCES : "bookingPassengerReferences"
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

var PassengerSpec = class {
    constructor(externalRef, type, dateOfBirth) {
        this.externalRef = externalRef;
        this.type = type;
        this.dateOfBirth = dateOfBirth;
    }
}

var Purchaser = class {
    constructor(detail) {
        this.detail = detail;
    }
}

var Detail = class {
	constructor(firstName, lastName, email, phoneNumber) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.email = email;
        this.phoneNumber = phoneNumber;
    }
}

var PurchaserContact = class {
    constructor(detail) {
        this.detail = detail;
    }
}

var DetailContact = class {
	constructor(firstName, lastName, contact) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.contact = contact;
    }
}

class Contact {
    constructor(email, phoneNumber) {
        this.email = email;
        this.phoneNumber = phoneNumber;
    }
}

var TripLegDefinition = class {
    constructor(startStopPlaceRef, startDateTime, endStopPlaceRef, endDateTime, productCategoryRef, productCategoryName, productCategoryShortName,vehicleNumber, carrier) {
        this.startStopPlaceRef = startStopPlaceRef;
        this.startDateTime = startDateTime;
        this.endStopPlaceRef = endStopPlaceRef;
        this.endDateTime = endDateTime;
        this.productCategoryRef = productCategoryRef;
        this.productCategoryName = productCategoryName;
        this.productCategoryShortName = productCategoryShortName;
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
    constructor(productCategory, vehicleNumbers, carriers) {
        this.productCategory = productCategory;
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
    constructor(productCategoryRef, name, shortName) {
        this.productCategoryRef = productCategoryRef;
        this.name = name;
        this.shortName = shortName;
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

var TripSearchCriteria = class {
    constructor(departureTime, origin, destination, parameters) {
        this.departureTime = departureTime;
        this.origin = origin;
        this.destination = destination;
        this.parameters = parameters;
    }
};

var TripParameters = class {
    constructor(dataFilter) {
        this.dataFilter = dataFilter;
    }
};

var TripDataFilter = class {
    constructor(carrierFilter, vehicleFilter) {
        this.carrierFilter = carrierFilter;
        this.vehicleFilter = vehicleFilter;
    }
};

var CarrierFilter = class {
    constructor(carriers, exclude = true) {
        this.carriers = carriers;
        this.exclude = exclude;
    }
}

var VehicleFilter = class {
    constructor(vehicleNumbers, lineNumbers = null, exclude = true) {
        this.vehicleNumbers = vehicleNumbers;
        this.lineNumbers = lineNumbers;
        this.exclude = exclude;
    }
}
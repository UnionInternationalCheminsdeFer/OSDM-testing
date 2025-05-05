Templates :

benerail_datafile :
```{
    "scenarios": [
        {
			"loggingType": "INFO",
            "code": "OTST_TS_OB_RFND",
            "osdmVersion": "3.4",
            "currency": "EUR",
            "refundOverruleCode": "DISRUPTION",
            "tripRequirementId": 1,
            "passengersListId": 1,
            "desiredFlexibility": "FULL_FLEXIBLE"
        }
    ],
	"offerSearchCriteria": [
        {
			"requestedOfferParts": ["ADMISSION"],
            "currency": "EUR",
            "serviceClass": "STANDARD",
            "travelClass": "SECOND",
            "requiresPlaceSelection": false,
            "flexibilities": ["FULL_FLEXIBLE", "NON_FLEXIBLE"]
        }
    ],
	"requestedFulfillmentOptions": [
        {
            "fulfillmentMedia": "UIC_PDF",
            "fulfillmentType": "ETICKET"
        }
    ],
    "tripRequirements": [
        {
            "id": 1,
            "tripType": "SEARCH",
            "trip": 
                {
                    "origin": "urn:uic:stn:8814001",
                    "destination": "urn:uic:stn:8892007",
                    "startDatetime": "%TRIP_DATE%T07:00:00+02:00",
                    "endDatetime": "%TRIP_DATE%T10:20:00+02:00",
                    "productCategoryRef": "",
                    "productCategoryName": "",
                    "productCategoryShortName": ""
                }
        }
    ],
    "passengersList": [
        {
            "id": 1,
            "passengers": [
                {
                    "reference": "12345",
                    "dateOfBirth": "1999-01-01",
					"updateFirstName": "John",
					"updateLastName": "Doe",
                    "updateDateOfBirth": "1999-01-02",
					"updatePhoneNumber": "+33612345678",
					"updateEmail": "email@email.com",
                    "type": "PERSON"
                }
            ]
        }
    ]
}```

bileto_datafile
```{
    "scenarios": [
        {
			"loggingType": "INFO",
            "code": "OTST_TS_OB_RFND",
            "osdmVersion": "3",
            "refundOverruleCode": "PAYMENT_FAILURE",
			"refundDate": "null",
            "tripRequirementId": 1,
            "passengersListId": 1,
            "desiredFlexibility": "NON_FLEXIBLE"
        },
        {
			"loggingType": "INFO",
            "code": "OTST_TS_OB_RFND_5_Multileg",
            "osdmVersion": "3",
            "refundOverruleCode": "PAYMENT_FAILURE",
			"refundDate": "null",
            "tripRequirementId": 2,
            "passengersListId": 1,
            "desiredFlexibility": "NON_FLEXIBLE"
        }
    ],
	"offerSearchCriteria": [
        {
			"requestedOfferParts": ["RESERVATION", "ADMISSION"],
            "currency": "EUR",
            "serviceClass": "STANDARD",
            "travelClass": "SECOND",
            "requiresPlaceSelection": false,
            "flexibilities": ["FULL_FLEXIBLE", "NON_FLEXIBLE"]
        }
    ],
	"requestedFulfillmentOptions": [
        {
            "fulfillmentMedia": "PDF_A4",
            "fulfillmentType": "ETICKET"
        }
    ],
    "tripRequirements": [
        {
            "id": 1,
            "tripType": "SEARCH",
            "trip": 
                {
                    "origin": "urn:uic:stn:5457076",
                    "destination": "urn:uic:stn:5454300",
                    "startDatetime": "%TRIP_DATE%T07:00:00+02:00",
                    "endDatetime": "%TRIP_DATE%T10:20:00+02:00",
                    "productCategoryRef": "",
                    "productCategoryName": "",
                    "productCategoryShortName": "",
                    "vehicleNumber": "1140",
                    "operatorCode": "urn:uic:rics:3189"
                }
        },
        {
            "id": 2,
            "tripType": "SPECIFICATION",
            "legs": [
                {
                    "origin": "urn:uic:stn:5457076",
                    "destination": "urn:uic:stn:5454300",
                    "startDatetime": "%TRIP_DATE%T09:10:00+01:00",
                    "endDatetime": "%TRIP_DATE%T09:30:00+01:00",
                    "productCategoryRef": "",
                    "productCategoryName": "",
                    "productCategoryShortName": "",
                    "vehicleNumber": "1140",
                    "operatorCode": "urn:uic:rics:3189"
                },
                {
                    "origin": "urn:uic:stn:5454300",
                    "destination": "urn:uic:stn:5454212",
                    "startDatetime": "%TRIP_DATE%T09:53:00+01:00",
                    "endDatetime": "%TRIP_DATE%T10:20:00+01:00",
                    "productCategoryRef": "",
                    "productCategoryName": "",
                    "productCategoryShortName": "",
                    "vehicleNumber": "1140",
                    "operatorCode": "urn:uic:rics:3189"
                }
            ]
        }
    ],
    "passengersList": [
        {
            "id": 1,
            "passengers": [
                {
                    "reference": "12345",
                    "dateOfBirth": "1999-01-01",
					"updateFirstName": "John",
					"updateLastName": "Doe",
                    "updateDateOfBirth": "1999-01-02",
					"updatePhoneNumber": "+33612345678",
					"updateEmail": "email@email.com",
                    "type": "PERSON"
                }
            ]
        }
    ]
}```

paxone_datafile
```{
    "scenarios": [
        {
			"loggingType": "INFO",
            "code": "OTST_TS_OB_RFND",
            "osdmVersion": "3.4",
            "currency": "EUR",
            "refundOverruleCode": "DISRUPTION",
			"refundDate": null,
            "tripRequirementId": 1,
            "passengersListId": 1
        }
    ],
	"offerSearchCriteria": [
        {
            "currency": "EUR",
            "requiresPlaceSelection": false,
            "offerMode": "INDIVIDUAL"

        }
    ],
	"requestedFulfillmentOptions": [],
    "tripRequirements": [
        {
            "id": 1,
            "tripType": "SEARCH",
            "trip": 
                {
                    "origin": "urn:uic:stn:0088140010",
                    "destination": "urn:uic:stn:0070154005",
                    "startDatetime": "%TRIP_DATE%T07:00:00Z+02:00",
                    "endDatetime": "%TRIP_DATE%T10:20:00Z+02:00"
                }
        }
    ],
    "passengersList": [
        {
            "id": 1,
            "passengers": [
                {
                    "reference": "12345",
                    "dateOfBirth": "1999-01-01",
					"updateFirstName": "John",
					"updateLastName": "Doe",
                    "updateDateOfBirth": "1999-01-02",
					"updatePhoneNumber": "+33612345678",
					"updateEmail": "email@email.com",
                    "type": "PERSON"
                }
            ]
        }
    ]
}```

sqills_datafile
```{
    "scenarios": [
        {
			"loggingType": "INFO",
            "code": "OTST_TS_OB_RFND",
            "osdmVersion": "3",
            "currency": "EUR",
            "refundOverruleCode": "PAYMENT_FAILURE",
			"refundDate": "null",
            "tripRequirementId": 1,
            "passengersListId": 1,
            "desiredFlexibility": "NON_FLEXIBLE"
        }
    ],
	"offerSearchCriteria": [
        {
			"requestedOfferParts": ["RESERVATION", "ADMISSION"],
            "currency": "EUR",
            "serviceClass": "STANDARD",
            "travelClass": "SECOND",
            "requiresPlaceSelection": false,
            "flexibilities": ["FULL_FLEXIBLE", "NON_FLEXIBLE"]
        }
    ],
	"requestedFulfillmentOptions": [
        {
            "fulfillmentMedia": "PDF_A4",
            "fulfillmentType": "ETICKET"
        }
    ],
    "tripRequirements": [
        {
            "id": 1,
            "tripType": "SEARCH",
            "trip": 
                {
                    "origin": "urn:uic:stn:8400058",
                    "destination": "urn:uic:stn:8727100",
                    "startDatetime": "%TRIP_DATE%T07:00:00+02:00",
                    "endDatetime": "%TRIP_DATE%T10:20:00+02:00",
                    "productCategoryRef": "",
                    "productCategoryName": "",
                    "productCategoryShortName": "",
                    "vehicleNumber": "OSDM_101",
                    "operatorCode": "urn:uic:rics:1"
                }
        }
    ],
    "passengersList": [
        {
            "id": 1,
            "passengers": [
                {
                    "reference": "12345",
                    "dateOfBirth": "1999-01-01",
					"updateFirstName": "John",
					"updateLastName": "Doe",
                    "updateDateOfBirth": "1999-01-02",
					"updatePhoneNumber": "+33612345678",
					"updateEmail": "email@email.com",
                    "type": "PERSON"
                }
            ]
        }
    ]
}```
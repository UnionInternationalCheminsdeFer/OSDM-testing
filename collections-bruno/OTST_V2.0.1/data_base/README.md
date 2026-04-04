# Data Base – OTSTS Data Files

This folder contains the **data files** used by the OTSTS test collections.  
Each data file corresponds to a specific **implementor sandbox** and defines the business scenarios, trip routes, passengers, and offer search criteria to use during testing.

> **Data file = "What business scenario do I want to validate, and with what data?"**

---

## Files in This Folder

| File | Implementor | OSDM Version | Currency |
|------|------|------|------|
| `benerail_datafile.json` | Benerail | 3.4 | EUR |
| `bileto_datafile.json` | Bileto | 3.4 | CZK |
| `paxone_datafile.json` | Paxone | 3.5 | EUR |
| `sqills_datafile.json` | Sqills | 3.4 | EUR |
| `turnit_datafile.json` | Turnit | 3.0.5 | EUR |
| `datafile_template.md` | — | — | Template reference |

---

## Data File Structure

Each data file is a JSON object with the following top-level sections:

| Section | Description |
|------|------|
| `scenarios` | List of test scenarios with business rules |
| `offerSearchCriteriaList` | Offer search criteria referenced by scenarios |
| `requestedFulfillmentOptionsList` | Fulfilment options referenced by scenarios |
| `tripRequirements` | Trip definitions (OND search or trip specification) |
| `purchaserList` | Purchaser contact data |
| `passengersList` | Passenger data (one or multiple passengers per list) |

---

## Scenario Fields

Each scenario entry contains:

| Field | Description |
|------|------|
| `code` | Unique scenario code used in `scenario_code` env variable |
| `scenarioType` | `REFUND`, `EXCHANGE`, or empty (ticketing only) |
| `scenarioAction` | `PATCH`, `DELETE`, or empty |
| `osdmVersion` | OSDM version targeted |
| `desiredFlexibility` | `FULL_FLEXIBLE`, `SEMI_FLEXIBLE`, `NON_FLEXIBLE` |
| `overruleCode` | e.g. `PAYMENT_FAILURE`, `DISRUPTION` |
| `refundDate` | Specific refund date or `null` |
| `tripRequirementId` | References a trip in `tripRequirements` |
| `passengersListId` | References a passenger list in `passengersList` |
| `offerSearchCriteriaListId` | References offer criteria in `offerSearchCriteriaList` |
| `requestedFulfillmentOptionsListId` | References fulfillment options |
| `accommodationSelection` | *(Turnit only)* `SEAT` or `COUCHETTE` |

---

## Implementor Details

### Benerail

| Property | Value |
|------|------|
| OSDM Version | 3.4 |
| Currency | EUR |
| Fulfillment | `UIC_PDF` / `ETICKET` |
| Offer modes | `INDIVIDUAL`, `COLLECTIVE` |
| Travel class | SECOND |

**Trip routes**

| ID | Type | Origin → Destination |
|------|------|------|
| 1 | `SEARCH` | BRUXELLES-MIDI (8814001) → GENT-SINT-PIETERS (8892007) |
| 2 | `SEARCH` | LIEGE-GUILLEMINS (8841004) → MOUSCRON (8821121), train 429 |
| 3 | `SPECIFICATION` | LIEGE-GUILLEMINS → BRUXELLES-NORD → MOUSCRON (2 legs) |

**Scenarios**

| Scenario Code | Type | Action | Passengers | Legs |
|------|------|------|------|------|
| `OTST_RFND_PATCH_SRCH_CRIT_1ADT_1LEG` | REFUND | PATCH | 1 adult | 1 |
| `OTST_RFND_DEL_SRCH_CRIT_1ADT_1LEG` | REFUND | DELETE | 1 adult | 1 |
| `OTST_RFND_SRCH_CRIT_2ADT_1LEG` | REFUND | — | 2 adults | 1 |
| `OTST_RFND_SRCH_CRIT_2ADT_1CHD_1LEG` | REFUND | — | 2 adults + 1 child | 1 |
| `OTST_RFND_SRCH_CRIT_1ADT_2LEG` | REFUND | — | 1 adult | 2 |
| `OTST_RFND_TRIP_SPEC_2ADT_2LEG` | REFUND | — | 2 adults | 2 (specification) |
| `OTST_EXCH_SRCH_CRIT_1ADT_1LEG` | EXCHANGE | — | 1 adult | 1 |

---

### Bileto

| Property | Value |
|------|------|
| OSDM Version | 3.4 |
| Currency | CZK |
| Fulfillment | `PDF_A4` / `ETICKET` |
| Offer modes | `INDIVIDUAL`, `COLLECTIVE` |
| Travel class | SECOND |
| Offer parts | RESERVATION, ADMISSION, ANCILLARY |

**Trip routes**

| ID | Type | Origin → Destination | Train / Operator |
|------|------|------|------|
| 1 | `SEARCH` | 5457076 → 5454300 | train 1140 / rics:3189 |
| 2 | `SEARCH` | 5457076 → 5454212 | train 1140 / rics:3189 |
| 3 | `SPECIFICATION` | 5457076 → 5454300 → 5454212 (2 legs) | trains 1140 & 1062 |

**Scenarios**

| Scenario Code | Type | Action | Passengers | Legs |
|------|------|------|------|------|
| `OTST_RFND_PATCH_SRCH_CRIT_1ADT_1LEG` | REFUND | PATCH | 1 adult | 1 |
| `OTST_RFND_DEL_SRCH_CRIT_1ADT_1LEG` | REFUND | DELETE | 1 adult | 1 |
| `OTST_RFND_SRCH_CRIT_2ADT_1LEG` | REFUND | — | 2 adults | 1 |
| `OTST_RFND_SRCH_CRIT_2ADT_1CHD_1LEG` | REFUND | — | 2 adults + 1 child | 1 |
| `OTST_RFND_SRCH_CRIT_1ADT_2LEG` | REFUND | — | 1 adult | 2 |
| `OTST_RFND_TRIP_SPEC_2ADT_2LEG` | REFUND | — | 2 adults | 2 (specification) |
| `OTST_EXCH_SRCH_CRIT_1ADT_1LEG` | EXCHANGE | — | 1 adult | 1 |

---

### Paxone

| Property | Value |
|------|------|
| OSDM Version | 3.5 |
| Currency | EUR |
| Fulfillment | *(none)* |
| Offer modes | `INDIVIDUAL` |

**Trip routes**

| ID | Type | Origin → Destination |
|------|------|------|
| 1 | `SEARCH` | 0088140010 → 0070154005 |
| 2 | `SEARCH` | 0080334524 → 0071718010 |

**Scenarios**

| Scenario Code | Type | Action | Passengers | Legs |
|------|------|------|------|------|
| `OTST_RFND_PATCH_SRCH_CRIT_1ADT_1LEG` | REFUND | PATCH | 1 adult | 1 |
| `OTST_RFND_DEL_SRCH_CRIT_1ADT_1LEG` | REFUND | DELETE | 1 adult | 1 |
| `OTST_RFND_SRCH_CRIT_2ADT_1LEG` | REFUND | — | 2 adults | 1 |
| `OTST_RFND_SRCH_CRIT_2ADT_1CHD_1LEG` | REFUND | — | 2 adults + 1 child | 1 |
| `OTST_RFND_SRCH_CRIT_1ADT_2LEG` | REFUND | — | 1 adult | 2 |
| `OTST_RFND_SRCH_CRIT_2ADT_2LEG` | REFUND | — | 2 adults | 2 |
| `OTST_EXCH_SRCH_CRIT_1ADT_1LEG` | EXCHANGE | — | 1 adult | 1 |

---

### Sqills

| Property | Value |
|------|------|
| OSDM Version | 3.4 |
| Currency | EUR |
| Fulfillment | `PDF_A4` / `ETICKET` |
| Offer modes | `INDIVIDUAL`, `COLLECTIVE` |
| Travel class | FIRST |
| Offer parts | RESERVATION, ADMISSION |

**Trip routes**

| ID | Type | Origin → Destination | Train / Operator |
|------|------|------|------|
| 1 | `SEARCH` | 8500010 → 8400058 | OSDM_202 / rics:1 |
| 2 | `SEARCH` | 8500010 → 8727100 | OSDM_202 / rics:1 |
| 3 | `SPECIFICATION` | 2-leg trip | OSDM_202 / rics:1 |

**Scenarios**

| Scenario Code | Type | Action | Passengers | Legs |
|------|------|------|------|------|
| `OTST_TKT_SRCH_CRIT_1ADT_1LEG` | *(ticketing)* | — | 1 adult | 1 |
| `OTST_RFND_PATCH_SRCH_CRIT_1ADT_1LEG` | REFUND | PATCH | 1 adult | 1 |
| `OTST_RFND_DEL_SRCH_CRIT_1ADT_1LEG` | REFUND | DELETE | 1 adult | 1 |
| `OTST_RFND_SRCH_CRIT_2ADT_1LEG` | REFUND | — | 2 adults | 1 |
| `OTST_RFND_SRCH_CRIT_2ADT_1CHD_1LEG` | REFUND | — | 2 adults + 1 child | 1 |
| `OTST_RFND_SRCH_CRIT_1ADT_2LEG` | REFUND | — | 1 adult | 2 |
| `OTST_RFND_TRIP_SPEC_2ADT_2LEG` | REFUND | — | 2 adults | 2 (specification) |
| `OTST_EXCH_SRCH_CRIT_1ADT_1LEG` | EXCHANGE | — | 1 adult | 1 |

---

### Turnit

| Property | Value |
|------|------|
| OSDM Version | 3.0.5 |
| Currency | EUR |
| Fulfillment | *(defined in file)* |
| Offer modes | `INDIVIDUAL`, `COLLECTIVE` |
| Travel class | SECOND |
| Offer parts | RESERVATION, ADMISSION, ANCILLARY |
| Specific field | `accommodationSelection` (`SEAT` or `COUCHETTE`) |

**Trip routes**

| ID | Type | Route | Notes |
|------|------|------|------|
| 1 | `SEARCH` | München → Hannover | Night train route |
| 2 | `SEARCH` | Amsterdam → Hannover | Night train route |
| 3 | `SPECIFICATION` | Single leg | 1-leg trip spec |

**Scenarios**

| Scenario Code | Type | Action | Passengers | Accommodation |
|------|------|------|------|------|
| `OTST_RFND_PATCH_SRCH_CRIT_1ADT_2LEG_Muenchen_Hannover` | REFUND | PATCH | 1 adult | COUCHETTE |
| `OTST_RFND_DEL_SRCH_CRIT_1ADT_2LEG_Muenchen_Hannover` | REFUND | DELETE | 1 adult | SEAT |
| `OTST_RFND_SRCH_CRIT_2ADT_2LEG` | REFUND | — | 2 adults | — |
| `OTST_RFND_SRCH_CRIT_2ADT_1CHD_2LEG` | REFUND | — | 2 adults + 1 child | — |
| `OTST_RFND_SRCH_CRIT_1ADT_2LEG_Amsterdam_Hannover` | REFUND | — | 1 adult | — |
| `OTST_RFND_TRIP_SPEC_2ADT_2LEG` | REFUND | — | 2 adults | — |
| `OTST_EXCH_SRCH_CRIT_1ADT_2LEG_Amsterdam_Hannover` | EXCHANGE | — | 1 adult | COUCHETTE |
| `OTST_EXCH_SRCH_CRIT_1ADT_1LEG_SEAT` | EXCHANGE | — | 1 adult | SEAT |
| `OTST_EXCH_SRCH_CRIT_1ADT_1LEG_COUCHETTE` | EXCHANGE | — | 1 adult | COUCHETTE |

---

## How to Use a Data File

1. Open your Bruno environment file (from `collections-bruno/.../environments/`)
2. Set the `data_file_path` variable to point to the relevant JSON file in this folder
3. Set `scenario_code` to the code of the scenario you want to run

Example:
```
data_file_path = /path/to/data_base/benerail_datafile.json
scenario_code  = OTST_RFND_SRCH_CRIT_1ADT_1LEG
```

> **Important:** Adapt the data file values (trip dates, station codes, passenger data) to match your sandbox environment before running the tests.  
> The `%TRIP_DATE%` placeholder in `startDatetime` / `endDatetime` fields is replaced at runtime by the environment variable `trip_date`.


## Appendix – Data File Templates

---

### benerail_datafile.json

```json
{
    "scenarios": [
        {
            "loggingType": "INFO",
            "code": "OTST_TS_OB_RFND",
            "osdmVersion": "3.4",
            "currency": "EUR",
            "overruleCode": "DISRUPTION",
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
            "trip": {
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
}
```

---

### bileto_datafile.json

```json
{
    "scenarios": [
        {
            "loggingType": "INFO",
            "code": "OTST_TS_OB_RFND",
            "osdmVersion": "3",
            "overruleCode": "PAYMENT_FAILURE",
            "refundDate": "null",
            "tripRequirementId": 1,
            "passengersListId": 1,
            "desiredFlexibility": "NON_FLEXIBLE"
        },
        {
            "loggingType": "INFO",
            "code": "OTST_TS_OB_RFND_5_Multileg",
            "osdmVersion": "3",
            "overruleCode": "PAYMENT_FAILURE",
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
            "trip": {
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
}
```

---

### paxone_datafile.json

```json
{
    "scenarios": [
        {
            "loggingType": "INFO",
            "code": "OTST_TS_OB_RFND",
            "osdmVersion": "3.4",
            "currency": "EUR",
            "overruleCode": "DISRUPTION",
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
            "trip": {
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
}
```

---

### sqills_datafile.json

```json
{
    "scenarios": [
        {
            "loggingType": "INFO",
            "code": "OTST_TS_OB_RFND",
            "osdmVersion": "3",
            "currency": "EUR",
            "overruleCode": "PAYMENT_FAILURE",
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
            "trip": {
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
}
```
# Developer Guide

To develop new test scenarios, developer must have experience with the Postman application, basic proficiency in Javascript language and understand concepts of the OSDM specification itself as the structures and functions used to build the request and validate the result are mostly identical with objects from OSDM.

## Postman Infrastructure

The test scenarios utilize **global variables** to configure the run and retain request parameter both between request and result, and between each request call in the workflow sequence.

Each request should validate if all required variables are set before it builds and executes the request.

### Globally Used Variables

- `api_base`: OSDM API location
- `access_token`: OAuth access token

## Building a Trip

OSDM supports both journey planning (using Open Journey Planner compliant interface) and direct specification of a trip if a journey planner outside the API found the trip and want the API to skip the journey planning/only verify existence of the trip in the inventory.

In both cases, **data file** must be provided in the format below and `osdmSpecification()` function is defined to take selected data file row. It generates OSDM structure for either _Trip Search Criteria_ or _Trip Specification_.

### Example: How to build one-leg trip specification

```javascript
osdmTripSpecification([
    new TripLegDefinition(
        pm.globals.get("leg_1_start_stop_place_ref"),
        pm.globals.get("leg_1_start_datetime"),
        pm.globals.get("leg_1_end_stop_place_ref"),
        pm.globals.get("leg_1_end_datetime"),
        pm.globals.get("leg_1_product_category_ref"),
        pm.globals.get("leg_1_product_category_name"),
        pm.globals.get("leg_1_product_category_short_name"),
        pm.globals.get("leg_1_vehicle_number"),
        pm.globals.get("leg_1_operator_code"),
    ),
]);
```



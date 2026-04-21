/**
 * osdmEnums.js — Single source of truth for OSDM enum values used by
 * assertion helpers across the collection.
 *
 * Before this module the PassengerType allow-list was duplicated in two
 * places that had drifted out of sync:
 *   - passengers.js (20 values — matches the OSDM PassengerType enum)
 *   - offers.js     (6 values — narrower, rejected valid OSDM types like
 *                    YOUNG_CHILD, DOG, BICYCLE as if they were unknown)
 * Importing from here prevents that class of drift from coming back.
 */

// OSDM PassengerType enum (covers human categories, PRM variants, and
// non-human payload types such as pets, bikes, and vehicles used for
// auto-train / combined-transport offers). Mirror the OpenAPI spec —
// keep sorted alphabetically inside each logical group for readability.
const OSDM_PASSENGER_TYPES = [
  // Human passengers
  'YOUNG_CHILD', 'CHILD', 'YOUTH', 'ADULT', 'SENIOR',
  'FAMILY_CHILD', 'PERSON',
  // Persons with Reduced Mobility and companions
  'PRM', 'PRM_CHILD', 'WHEELCHAIR', 'ACCOMP_PRM', 'COMPANION_DOG',
  // Non-human payload types
  'DOG', 'PET', 'LUGGAGE',
  'BICYCLE', 'PRAM',
  'CAR', 'MOTORCYCLE', 'TRAILER',
];

module.exports = {
  OSDM_PASSENGER_TYPES,
};

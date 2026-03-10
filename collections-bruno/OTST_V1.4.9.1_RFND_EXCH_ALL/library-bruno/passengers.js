const { validationLogger } = require('./displays.js');

module.exports = {
  patchMultiPassengerResponse
};

// Function to validate passenger data
function patchMultiPassengerResponse(response, passengerIndex) {
  const { firstName, lastName } = response.passenger?.detail || {};
  const dateOfBirth = response.passenger?.dateOfBirth;
  const gender      = response.passenger?.gender;

  const isV34Plus = parseFloat(bru.getEnvVar("osdmVersion")) > 3.4;
  const contact   = response.passenger?.detail;
  const phoneNumber = isV34Plus ? (contact?.contact?.phoneNumber || "") : (contact?.phoneNumber || "");
  const email       = isV34Plus ? (contact?.contact?.email       || "") : (contact?.email       || "");

  const totalPassengers = Number(bru.getEnvVar("offerPassengerNumber"));
  const passengerDataRaw = bru.getEnvVar("passengerAdditionalData") || "[]";
  const passenger = (typeof passengerDataRaw === "string" ? JSON.parse(passengerDataRaw) : passengerDataRaw)[passengerIndex];

  if (passengerIndex >= totalPassengers) {
    validationLogger("[INFO] ✅ All passengers already processed. Skipping further validation.");
    return;
  }

  validationLogger(`[INFO] Comparing passenger ${passengerIndex} values with expected values from data file.`);

  test(`Passenger ${passengerIndex} - First name is correct (expected: ${passenger.updateFirstName}, actual: ${firstName})`, () => {
    validationLogger(`[INFO] Passenger ${passengerIndex} - First name is correct (expected: ${passenger.updateFirstName}, actual: ${firstName})`);
    expect(firstName).to.equal(passenger.updateFirstName);
  });

  test(`Passenger ${passengerIndex} - Last name is correct (expected: ${passenger.updateLastName}, actual: ${lastName})`, () => {
    validationLogger(`[INFO] Passenger ${passengerIndex} - Last name is correct (expected: ${passenger.updateLastName}, actual: ${lastName})`);
    expect(lastName).to.equal(passenger.updateLastName);
  });

  test(`Passenger ${passengerIndex} - Date of birth is correct (expected: ${passenger.updateDateOfBirth}, actual: ${dateOfBirth})`, () => {
    validationLogger(`[INFO] Passenger ${passengerIndex} - Date of birth is correct (expected: ${passenger.updateDateOfBirth}, actual: ${dateOfBirth})`);
    expect(dateOfBirth).to.equal(passenger.updateDateOfBirth);
  });

  test(`Passenger ${passengerIndex} - Phone number is correct (expected: ${passenger.updatePhoneNumber}, actual: ${phoneNumber})`, () => {
    validationLogger(`[INFO] Passenger ${passengerIndex} - Phone number is correct (expected: ${passenger.updatePhoneNumber}, actual: ${phoneNumber})`);
    expect(phoneNumber).to.equal(passenger.updatePhoneNumber);
  });

  test(`Passenger ${passengerIndex} - Email is correct (expected: ${passenger.updateEmail}, actual: ${email})`, () => {
    validationLogger(`[INFO] Passenger ${passengerIndex} - Email is correct (expected: ${passenger.updateEmail}, actual: ${email})`);
    expect(email).to.equal(passenger.updateEmail);
  });

  if (gender != null) {
    test(`Passenger ${passengerIndex} - Gender is correct (expected: ${passenger.updateGender}, actual: ${gender})`, () => {
      validationLogger(`[INFO] Passenger ${passengerIndex} - Gender is correct (expected: ${passenger.updateGender}, actual: ${gender})`);
      expect(gender).to.equal(passenger.updateGender);
    });
  }
}

// Expose to global for convenience in eval/require loader flows
try {
  Object.assign(globalThis, module.exports);
} catch (e) {
  // no-op
}

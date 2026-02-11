// Import needed library files
const display = require('./displays.js');

module.exports = {
  patchMultiPassengerResponse
};

// Function to validate passenger data
function patchMultiPassengerResponse(response, passengerIndex) {
  const { firstName, lastName } = response.passenger?.detail || {};
  const dateOfBirth = response.passenger?.dateOfBirth;
  const gender = response.passenger?.gender;

  const osdmVersion = bru.getEnvVar("osdmVersion");
  let phoneNumber = "";
  let email = "";

  if (parseFloat(osdmVersion) > 3.4) {
    phoneNumber = response.passenger?.detail?.contact?.phoneNumber || "";
    email = response.passenger?.detail?.contact?.email || "";
  } else {
    phoneNumber = response.passenger?.detail?.phoneNumber || "";
    email = response.passenger?.detail?.email || "";
  }

  const totalPassengers = Number(bru.getEnvVar("offerPassengerNumber"));
  const passengerDataString = bru.getEnvVar("passengerAdditionalData") || "[]";
  const passengerDataArray = typeof passengerDataString === "string" ? JSON.parse(passengerDataString) : passengerDataString;
  const passenger = passengerDataArray[passengerIndex];

  if (passengerIndex >= totalPassengers) {
    validationLogger("[INFO] ✅ All passengers already processed. Skipping further validation.");
    return;
  } else {
    validationLogger(`[INFO] Comparing passenger ${passengerIndex} values with expected values from data file.`);

    test(`Passenger ${passengerIndex} - First name is correct (expected: ${passenger.updateFirstName}, actual: ${firstName})`, function () {
      validationLogger(`[INFO] Passenger ${passengerIndex} - First name is correct (expected: ${passenger.updateFirstName}, actual: ${firstName})`);
      expect(firstName).to.equal(passenger.updateFirstName);
    });

    test(`Passenger ${passengerIndex} - Last name is correct (expected: ${passenger.updateLastName}, actual: ${lastName})`, function () {
      validationLogger(`[INFO] Passenger ${passengerIndex} - Last name is correct (expected: ${passenger.updateLastName}, actual: ${lastName})`);
      expect(lastName).to.equal(passenger.updateLastName);
    });

    test(`Passenger ${passengerIndex} - Date of birth is correct (expected: ${passenger.updateDateOfBirth}, actual: ${dateOfBirth})`, function () {
      validationLogger(`[INFO] Passenger ${passengerIndex} - Date of birth is correct (expected: ${passenger.updateDateOfBirth}, actual: ${dateOfBirth})`);
      expect(dateOfBirth).to.equal(passenger.updateDateOfBirth);
    });

    test(`Passenger ${passengerIndex} - Phone number is correct (expected: ${passenger.updatePhoneNumber}, actual: ${phoneNumber})`, function () {
      validationLogger(`[INFO] Passenger ${passengerIndex} - Phone number is correct (expected: ${passenger.updatePhoneNumber}, actual: ${phoneNumber})`);
      expect(phoneNumber).to.equal(passenger.updatePhoneNumber);
    });

    test(`Passenger ${passengerIndex} - Email is correct (expected: ${passenger.updateEmail}, actual: ${email})`, function () {
      validationLogger(`[INFO] Passenger ${passengerIndex} - Email is correct (expected: ${passenger.updateEmail}, actual: ${email})`);
      expect(email).to.equal(passenger.updateEmail);
    });

    if (response.passenger?.gender != null) {
      test(`Passenger ${passengerIndex} - Gender is correct (expected: ${passenger.updateGender}, actual: ${gender})`, function () {
        validationLogger(`[INFO] Passenger ${passengerIndex} - Gender is correct (expected: ${passenger.updateGender}, actual: ${gender})`);
        expect(gender).to.equal(passenger.updateGender);
      });
    }
  }
}

// Expose to global for convenience in eval/require loader flows
try {
  Object.assign(globalThis, module.exports);
} catch (e) {
  // no-op
}

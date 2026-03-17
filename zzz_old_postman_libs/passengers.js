// Function to validate passenger data
function patchMultiPassengerResponse(response, passengerIndex) {

    const { firstName, lastName } = response.passenger?.detail || {};
    const dateOfBirth = response.passenger?.dateOfBirth;
    const gender = response.passenger?.gender;
    let phoneNumber = "";
    let email = "";
    var osdmVersion = pm.environment.get("osdmVersion");
    if (parseFloat(osdmVersion) > 3.4) {
        phoneNumber = response.passenger?.detail?.contact?.phoneNumber || "";
        email = response.passenger?.detail?.contact?.email || "";
    } else {
        phoneNumber = response.passenger?.detail?.phoneNumber || "";
        email = response.passenger?.detail?.email || "";
    }

    const totalPassengers = Number(pm.environment.get("offerPassengerNumber"));
    const passengerDataString = pm.environment.get("passengerAdditionalData") || "[]";
    const passengerDataArray = JSON.parse(passengerDataString);
    const passenger = passengerDataArray[passengerIndex];

    if (passengerIndex >= totalPassengers) {
        validationLogger("[INFO] ✅ All passengers already processed. Skipping further validation.");
        return;
    } else {
        validationLogger(`[INFO] Comparing passenger ${passengerIndex} values with expected values from data file.`);

        pm.test(`Passenger ${passengerIndex} - First name is correct (expected: ${passenger.updateFirstName}, actual: ${firstName})`, function () {
            validationLogger(`[INFO] Passenger ${passengerIndex} - First name is correct (expected: ${passenger.updateFirstName}, actual: ${firstName})`);
            pm.expect(firstName).to.equal(passenger.updateFirstName);
        });

        pm.test(`Passenger ${passengerIndex} - Last name is correct (expected: ${passenger.updateLastName}, actual: ${lastName})`, function () {
            validationLogger(`[INFO] Passenger ${passengerIndex} - Last name is correct (expected: ${passenger.updateLastName}, actual: ${lastName})`);
            pm.expect(lastName).to.equal(passenger.updateLastName);
        });

        pm.test(`Passenger ${passengerIndex} - Date of birth is correct (expected: ${passenger.updateDateOfBirth}, actual: ${dateOfBirth})`, function () {
            validationLogger(`[INFO] Passenger ${passengerIndex} - Date of birth is correct (expected: ${passenger.updateDateOfBirth}, actual: ${dateOfBirth})`);
            pm.expect(dateOfBirth).to.equal(passenger.updateDateOfBirth);
        });

        pm.test(`Passenger ${passengerIndex} - Phone number is correct (expected: ${passenger.updatePhoneNumber}, actual: ${phoneNumber})`, function () {
            validationLogger(`[INFO] Passenger ${passengerIndex} - Phone number is correct (expected: ${passenger.updatePhoneNumber}, actual: ${phoneNumber})`);
            pm.expect(phoneNumber).to.equal(passenger.updatePhoneNumber);
        });

        pm.test(`Passenger ${passengerIndex} - Email is correct (expected: ${passenger.updateEmail}, actual: ${email})`, function () {
            validationLogger(`[INFO] Passenger ${passengerIndex} - Email is correct (expected: ${passenger.updateEmail}, actual: ${email})`);
            pm.expect(email).to.equal(passenger.updateEmail);
        });

        if (response.passenger?.gender != null) {
            pm.test(`Passenger ${passengerIndex} - Gender is correct (expected: ${passenger.updateGender}, actual: ${gender})`, function () {
                validationLogger(`[INFO] Passenger ${passengerIndex} - Gender is correct (expected: ${passenger.updateGender}, actual: ${gender})`);
                pm.expect(gender).to.equal(passenger.updateGender);
            });
        }
    }
}

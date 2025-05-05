// Function to validate passenger data
function validatePassengerData(response, passengerIndex) {
    const { firstName, lastName } = response.passenger?.detail || {};
    const dateOfBirth = response.passenger?.dateOfBirth;
    const { phoneNumber, email } = response.passenger?.detail?.contact || {};

    const passengerDataString = pm.globals.get("passengerAdditionalData");
    const passengerDataArray = JSON.parse(passengerDataString);
    const passenger = passengerDataArray[passengerIndex];

    validationLogger(`Comparing passenger ${passengerIndex} values after PATCH passenger infos`);
    validationLogger(`[INFO] Passenger firstName data to patch : ${passenger.updateFirstName} ⇔ found : ${firstName}`);
    validationLogger(`[INFO] Passenger lastName data to patch : ${passenger.updateLastName} ⇔ found : ${lastName}`);
    validationLogger(`[INFO] Passenger dateOfBirth data to patch : ${passenger.updateDateOfBirth} ⇔ found : ${dateOfBirth}`);
    validationLogger(`[INFO] Passenger phoneNumber data to patch : ${passenger.updatePhoneNumber} ⇔ found : ${phoneNumber}`);
    validationLogger(`[INFO] Passenger email data to patch : ${passenger.updateEmail} ⇔ found : ${email}`);	

    pm.test(`Passenger ${passengerIndex} - First name is correct (expected: ${passenger.updateFirstName}, actual: ${firstName})`, function () {
        pm.expect(firstName).to.equal(passenger.updateFirstName);
    });
    pm.test(`Passenger ${passengerIndex} - Last name is correct (expected: ${passenger.updateLastName}, actual: ${lastName})`, function () {
        pm.expect(lastName).to.equal(passenger.updateLastName);
    });
    pm.test(`Passenger ${passengerIndex} - Date of birth is correct (expected: ${passenger.updateDateOfBirth}, actual: ${dateOfBirth})`, function () {
        pm.expect(dateOfBirth).to.equal(passenger.updateDateOfBirth);
    });
    pm.test(`Passenger ${passengerIndex} - Phone number is correct (expected: ${passenger.updatePhoneNumber}, actual: ${phoneNumber})`, function () {
        pm.expect(phoneNumber).to.equal(passenger.updatePhoneNumber);
    });
    pm.test(`Passenger ${passengerIndex} - Email is correct (expected: ${passenger.updateEmail}, actual: ${email})`, function () {
        pm.expect(email).to.equal(passenger.updateEmail);
    });
}
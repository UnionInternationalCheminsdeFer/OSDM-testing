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

    pm.test(`Passenger ${passengerIndex} data is valid`, function () {
        pm.expect(firstName, `First name for passenger ${passengerIndex}`).to.equal(passenger.updateFirstName);
        pm.expect(lastName, `Last name for passenger ${passengerIndex}`).to.equal(passenger.updateLastName);
        pm.expect(dateOfBirth, `Date of birth for passenger ${passengerIndex}`).to.equal(passenger.updateDateOfBirth);
        pm.expect(phoneNumber, `Phone number for passenger ${passengerIndex}`).to.equal(passenger.updatePhoneNumber);
        pm.expect(email, `Email for passenger ${passengerIndex}`).to.equal(passenger.updateEmail);
    });
}
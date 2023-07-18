setAuthToken = function () {
    let response = JSON.parse(responseBody);
    
    pm.globals.set(GV.AUTHTOKEN, response.access_token);
}

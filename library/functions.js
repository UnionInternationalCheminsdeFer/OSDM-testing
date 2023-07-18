setAuthToken = function () {
    let response = JSON.parse(responseBody);
    
    pm.globals.set(GV.ACCESS_TOKEN, response.access_token);
}

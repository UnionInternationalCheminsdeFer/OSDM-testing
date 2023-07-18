setAuthToken = function () {
    let jsonData = JSON.parse(responseBody);
    
    pm.globals.set(GV.ACCESS_TOKEN, jsonData.access_token);
}

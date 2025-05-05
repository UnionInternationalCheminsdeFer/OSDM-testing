/*
Copyright UIC, Union Internationale des Chemins de fer
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
No reproduction nor distribution shall be allowed without the following notice
“This material is copyrighted by UIC, Union Internationale des Chemins de fer © 2023  – 2024 , OSDM is a trademark belonging to UIC, and any use of this trademark is strictly prohibited unless otherwise agreed by UIC.”
*/

// Import the uuid module for generating unique identifiers
var uuid = require('uuid');

// Function to set the authentication token
setAuthToken = function () {
	let jsonData = JSON.parse(responseBody);
	pm.globals.set(GV.ACCESS_TOKEN, jsonData.access_token);
}

function captureSwaggerSchemaValidator() {
    validationLogger("[INFO] ⏳ swaggerSchemaValidator");

    // Sends a GET request to the URL stored in the environment variable "swaggerSchema"
    pm.sendRequest({
        url: pm.environment.get("swaggerSchema"),  // URL of the Swagger JSON schema from the environment variable
        method: 'GET',
        proxy: false
    }, function (err, res) {
        if (err) {
            console.log("❌ Error during Swagger request:", err);
            return;
        }

        // Convert the response JSON to a string and store it in the global variable
        const swaggerJsonString = JSON.stringify(res.json());
        pm.globals.set("swaggerJson", swaggerJsonString);
    });
}

function swaggerSchemaValidatorContent() {
    pm.sendRequest({
        url: pm.environment.get("ajvMinified"),
        method: 'GET',
        proxy: false
    }, function (err, res) {
        if (err) {
            console.log("❌ Error while loading AJV:", err);
            return;
        }

        if (res.status === "OK" && res.text().length > 0) {
            try {
                console.log("✅ AJV script successfully loaded");
                const scriptContent = res.text();
				pm.globals.set("scriptContent", scriptContent)
                // Injection de la lib AJV dans le scope global


                // Lecture et parsing du Swagger
                const swaggerJsonString = pm.globals.get("swaggerJson");
                const swaggerSchema = JSON.parse(swaggerJsonString);

                // Appel à la fonction de validation
                swaggerSchemaValidator({
                    schema: swaggerSchema,
                    requestHeaders: pm.globals.get("requestHeaders"),
                    requestBody: pm.globals.get("OfferCollectionRequest"),
                    responseHeaders: pm.globals.get("responseHeaders"),
                    responseBody: pm.globals.get("responseBody"),
                    method: pm.globals.get("method"),
                    url: pm.globals.get("url")
                });

            } catch (e) {
                console.error("❌ Error during AJV script evaluation:", e);
            }
        } else {
            console.error(`❌ Failed to load AJV script. Status: ${res.status}`);
        }
    });
}



function swaggerSchemaValidator({schema, requestHeaders, requestBody, responseHeaders, responseBody, method, url }) {
    function resolveRef(ref, rootSchema) {
        if (!ref.startsWith('#/')) return null;
        const path = ref.slice(2).split('/');
        return path.reduce((obj, key) => obj && obj[key], rootSchema);
    }

    const baseUrlPattern = /{{\s*api_base\s*}}/g;
    const cleanedUrl = url.replace(baseUrlPattern, "");
    const urlParts = cleanedUrl.split('?')[0];
    const pathList = Object.keys(schema.paths);

    let matchedPath = null;
    for (let path of pathList) {
        const regex = new RegExp("^" + path.replace(/{[^}]+}/g, "[^/]+") + "$");
        if (regex.test(urlParts)) {
            matchedPath = path;
            break;
        }
    }

    if (!matchedPath) {
        console.error(`❌ No matching path found in Swagger for URL: ${url}`);
        return;
    }

    const pathSchema = schema.paths[matchedPath]?.[method.toLowerCase()];
    if (!pathSchema) {
        console.error(`❌ No matching method '${method}' for path '${matchedPath}'`);
        return;
    }

    // ✅ Validation du body de la requête
    if (pathSchema.requestBody?.content?.["application/json"]) {
        let bodySchema = pathSchema.requestBody.content["application/json"].schema;
        if (bodySchema.$ref) {
            bodySchema = resolveRef(bodySchema.$ref, schema);
        }

        try {
			scriptContent = pm.globals.get("scriptContent")
			eval(scriptContent);
			const ajv = new Ajv();
            const validateBody = ajv.compile(bodySchema);
            const valid = validateBody(JSON.parse(requestBody));
            if (!valid) {
                console.error(`❌ Invalid request body for ${method} ${matchedPath}:`, validateBody.errors);
            } else {
                console.log(`✅ Request body is valid for ${method} ${matchedPath}`);
            }
        } catch (e) {
            console.error("❌ Failed to validate request body:", e);
        }
    }

    // ✅ Validation du body de la réponse
    let responseSchema = pathSchema.responses?.["200"]?.content?.["application/json"]?.schema;
    if (responseSchema) {
        if (responseSchema.$ref) {
            responseSchema = resolveRef(responseSchema.$ref, schema);
        }

        try {
			scriptContent = pm.globals.get("scriptContent")
			eval(scriptContent);
			const ajv = new Ajv();			
            const validateResponse = ajv.compile(responseSchema);
            const valid = validateResponse(JSON.parse(responseBody));
            if (!valid) {
                console.error(`❌ Invalid response body for ${method} ${matchedPath}:`, validateResponse.errors);
            } else {
                console.log(`✅ Response body is valid for ${method} ${matchedPath}`);
            }
        } catch (e) {
            console.error("❌ Failed to validate response body:", e);
        }
    }
}




  





// Function to validate JSON with a template
function validateJsonWithTemplate(jsonData) {
    pm.sendRequest({
        url: pm.environment.get("json_schema"),
        method: 'GET',
        proxy: false
    }, function (err, res) {
        if (err) {
            console.error("Error loading the schema: ", err);
            pm.test("Schema load failed", function () {
                throw new Error("Schema load failed: " + err);
            });
            return;
        }

        const schema = res.json();

        function validateType(type, value) {
            if (type === "string") return typeof value === "string";
            if (type === "integer") return Number.isInteger(value);
            if (type === "boolean") return typeof value === "boolean";
            if (type === "object") return value !== null && typeof value === "object";
            if (type === "array") return Array.isArray(value);
            if (type === "null") return value === null;
            return false;
        }

        function validateJson(jsonData, schema) {
            const requiredFields = schema.required || [];

            for (let key in schema.properties) {
                const propertySchema = schema.properties[key];

                if (!(key in jsonData)) {
                    if (!requiredFields.includes(key)) {
                        continue;
                    }
                    console.error(`The property '${key}' is required.`);
                    pm.test(`Validation of '${key}' failed`, function () {
                        throw new Error(`The property '${key}' is required.`);
                    });
                    return false;
                }

                const value = jsonData[key];
                const expectedTypes = Array.isArray(propertySchema.type) ? propertySchema.type : [propertySchema.type];
                if (propertySchema.nullable && !expectedTypes.includes("null")) {
                    expectedTypes.push("null");
                }

                const isValidType = expectedTypes.some(type => validateType(type, value));
                if (!isValidType) {
                    console.error(`The type of '${key}' is invalid. Expected: ${expectedTypes.join(', ')}.`);
                    pm.test(`Validation of '${key}' failed`, function () {
                        throw new Error(`The type of '${key}' is invalid. Expected: ${expectedTypes.join(', ')}.`);
                    });
                    return false;
                }

                if (propertySchema.type === "object" && value !== null && typeof value === "object" && propertySchema.properties) {
                    if (!validateJson(value, propertySchema)) {
                        console.error(`The object '${key}' is invalid.`);
                        pm.test(`Validation of '${key}' failed`, function () {
                            throw new Error(`The object '${key}' is invalid.`);
                        });
                        return false;
                    }
                }

                if (propertySchema.type === "array" && Array.isArray(value) && propertySchema.items) {
                    for (let item of value) {
                        if (!validateJson(item, propertySchema.items)) {
                            console.error(`The item in '${key}' is invalid.`);
                            pm.test(`Item in '${key}' failed`, function () {
                                throw new Error(`The item in '${key}' is invalid.`);
                            });
                            return false;
                        }
                    }
                }
            }
            return true;
        }

        const isValid = validateJson(jsonData, schema);
        if (isValid) {
            validationLogger("[INFO] ✅ Valid JSON Datafile structure !");
            pm.test("JSON validation passed", function () {
                pm.expect(true).to.eql(true);
            });
        } else {
            pm.globals.set("loggingType", "ERROR");
            validationLogger("[INFO] ⛔ Invalid JSON Datafile structure !");
            pm.test("JSON validation failed", function () {
                throw new Error("The provided JSON is invalid");
            });
        }
    });
}




















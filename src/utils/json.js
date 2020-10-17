"use strict";
exports.__esModule = true;
exports.makeJSONWarning = exports.makeJSONSuccess = exports.makeJSONError = void 0;
/**
 * @param message the error message you wish to include in the API's responce
 * @return JSON error message
 */
function makeJSONError(message) {
    return ({ status: "error", message: message });
}
exports.makeJSONError = makeJSONError;
/**
 * @param message the success message you wish to include in the API's responce
 * @return JSON success message
 */
function makeJSONSuccess(message) {
    return ({ status: "success", message: message });
}
exports.makeJSONSuccess = makeJSONSuccess;
/**
 * @param message the warning message you wish to include in the API's responce
 * @return JSON success message
 */
function makeJSONWarning(message) {
    return ({ status: "warning", message: message });
}
exports.makeJSONWarning = makeJSONWarning;

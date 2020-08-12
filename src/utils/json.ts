/**
 * @param message the error message you wish to include in the API's responce
 * @return JSON error message
 */
export function makeJSONError(message: string): object {
    return ({ status: "error", message: message });
}

/**
 * @param message the success message you wish to include in the API's responce
 * @return JSON success message
 */
export function makeJSONSuccess(message: string): object {
    return ({ status: "success", message: message });
}

/**
 * @param message the warning message you wish to include in the API's responce
 * @return JSON success message
 */
export function makeJSONWarning(message: string): object {
    return ({ status: "warning", message: message });
}

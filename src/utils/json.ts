/**
 * @param message the error message you wish to include in the API's responce
 * @return JSON error message
 */
export function makeJSONError(message: string | any): object {
    return ({ status: "error", message: message });
}

/**
 * @param message the success message you wish to include in the API's responce
 * @return JSON success message
 */
export function makeJSONSuccess(message: string | any): object {
    return ({ status: "success", message: message });
}

/**
 * @param message the warning message you wish to include in the API's responce
 * @return JSON success message
 */
export function makeJSONWarning(message: string | any): object {
    return ({ status: "warning", message: message });
}

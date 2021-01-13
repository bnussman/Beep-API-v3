import { APIStatus } from "../utils/Error";

/**
 * Public User Result
 *
 * @example {
 *   "capacity": 4,
 *   "first": "Test",
 *   "groupRate": "2",
 *   "isBeeping": false,
 *   "isStudent": false,
 *   "last": "User",
 *   "masksRequired": true,
 *   "queueSize": 0,
 *   "singlesRate": "3",
 *   "venmo": "testuser"
 * }
*/
export interface PublicUser {
    first: string;
    last: string;
    capacity: number;
    isStudent: boolean;
    masksRequired: boolean;
    queueSize: number;
    singlesRate: number | string;
    groupRate: number | string;
    venmo: string;
    isBeeping: boolean;
    photoUrl: string | null;
}

/**
 * Public User Result
 *
 * @example {
 *   "status": "success",
 *   "user": {
 *     "capacity": 4,
 *     "first": "Test",
 *     "groupRate": "2",
 *     "isBeeping": false,
 *     "isStudent": false,
 *     "last": "User",
 *     "masksRequired": true,
 *     "queueSize": 0,
 *     "singlesRate": "3",
 *     "venmo": "testuser"
 *   }
 * }
*/
export interface UserResult {
    status: APIStatus;
    user: PublicUser;
}

//TODO: example data
export interface DetailedUser {
    first: string;
    last: string;
    capacity: number;
    isStudent: boolean;
    masksRequired: boolean;
    queueSize: number;
    singlesRate: number | string;
    groupRate: number | string;
    venmo: string;
    isBeeping: boolean;
    photoUrl: string | null;
    id: string;
    email: string;
    inQueueOfUserID: string | null;
    isEmailVerified: boolean;
    phone: string;
    pushToken: string;
    username: string;
    userLevel: number;
}

//TODO: example data
export interface UsersResult {
    status: APIStatus;
    total: number,
    users: DetailedUser[];
}

/**
 * Edit User Params
 *
 * @example {
 *     "venmo": "bankstestvenmo",
 *     "first": "Banks"
 * }
*/
export interface EditUserParams {
    first?: string;
    last?: string;
    capacity?: number;
    isStudent?: boolean;
    masksRequired?: boolean;
    queueSize?: number;
    singlesRate?: number | string;
    groupRate?: number | string;
    venmo?: string;
    isBeeping?: boolean;
    photoUrl?: string | null;
    id?: string;
    email?: string;
    inQueueOfUserID?: string | null;
    isEmailVerified?: boolean;
    phone?: string;
    pushToken?: string | null;
    username?: string;
    userLevel?: number;
}

/**
 * Example Location Entry
 *
 * @example {
 *   "accuracy": 5,
 *    "altitude": 963.446349948066,
 *    "altitudeAccuracy": 3,
 *    "heading": 41.47227478027344,
 *    "id": "03770e5f-c2a9-4134-a724-0d5bb6ac2865",
 *    "latitude": 36.206469442729095,
 *    "longitude": -81.668430576177,
 *    "speed": 14.369999885559082,
 *    "timestamp": 1609808229233
 *  }
 */
export interface LocationEntry {
    id: string;
    accuracy: number;
    altitude: number;
    altitudeAccuracy: number;
    heading: number;
    latitude: number;
    longitude: number;
    speed: number;
    timestamp: number;
}

/**
 * Example User's Location Response
 *
 * @example {
 *    "status": "success",
 *    "locations": [
 *        {
 *            "accuracy": 5,
 *            "altitude": 963.446349948066,
 *            "altitudeAccuracy": 3,
 *            "heading": 41.47227478027344,
 *            "id": "03770e5f-c2a9-4134-a724-0d5bb6ac2865",
 *            "latitude": 36.206469442729095,
 *            "longitude": -81.668430576177,
 *            "speed": 14.369999885559082,
 *            "timestamp": 1609808229233
 *        }
 *     ]
 *  }
 */
export interface LocationResponse {
    status: APIStatus;
    total: number;
    locations: LocationEntry[];
}

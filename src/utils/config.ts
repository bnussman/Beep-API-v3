export const withouts = {
    capacity: true,
    email: true,
    groupRate: true,
    inQueueOfUserID: true,
    isBeeping: true,
    isEmailVerified: true,
    isStudent: true,
    masksRequired: true,
    password: true,
    phone: true,
    pushToken: true,
    queueSize: true,
    singlesRate: true,
    userLevel: true,
    venmo: true
};

export const defaultBeeperInfo = ['id', 'first', 'last', 'singlesRate', 'groupRate', 'queueSize', 'userLevel', 'isStudent', 'capacity', 'masksRequired', 'photoUrl', 'isBeeping'];

export const acceptedBeeperInfo = [...defaultBeeperInfo, 'phone', 'venmo'];

/*
import { User, UserPluckResult } from "../types/beep";

export default class MockUser {
    
    private user: User | null;
    private foundBeeperId: string | null;
    private details: UserPluckResult;

    constructor(type: string) {
        this.user = null;
        this.foundBeeperId = null;
        this.details = this.getDefaultUserDetails(type);
    }

    public getUserResponse(): User {
        if (!this.user) {
            throw new Error("User should not be null by now");
        }
        return this.user;
    }
    
    public setUserResponse(user: User): void {
        this.user = user;
    }

    public getUserDetails(): UserPluckResult {
        return this.details;
    }

    public setFoundBeeperId(id: string): void {
        this.foundBeeperId = id;
    }

    public getFoundBeeperId(): string {
        if (!this.foundBeeperId) {
            throw new Error("BeeperId should not be null by now");
        }
        return this.foundBeeperId;
    }

    private getDefaultUserDetails(type: string): UserPluckResult {
        if (type == "rider") {
            return {
                first: "Rider",
                last: "Tester",
                email: "rider@example.com",
                phone: "7048414949",
                venmo: "ridertester",
                username: "ridertester",
                password: "password"
            };
        }

        return {
            first: "Beeper",
            last: "Tester",
            email: "beeper@example.com",
            phone: "7048414949",
            venmo: "beepertester",
            username: "beepertester",
            password: "password"
        };
    }
}
*/

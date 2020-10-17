export class APIError {
    
    public status: string;
    public statusCode: number;
    public message: unknown;

    constructor(statusCode: number, message: unknown) {
        this.status = "error";
        console.log(message);
        this.message = message;
        this.statusCode = statusCode;
    }
}

export class APIWarning {
    
    public status: string;
    public statusCode: number;
    public message: unknown;

    constructor(statusCode: number, message: unknown) {
        this.status = "warning";
        this.message = message;
        this.statusCode = statusCode;
    }
}

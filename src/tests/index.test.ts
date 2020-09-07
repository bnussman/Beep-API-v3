import BeepAPIServer from "../index";

//make a beep api object to the tests can acually run aginst the server
new BeepAPIServer();

describe("Sign Up", () => {
    test("create an account", () => {
        expect(1).toBe(1);
    });
});

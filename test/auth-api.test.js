const test = require("node:test");
const assert = require("node:assert/strict");
const {
    passwordHash,
    passwordMatches,
    validateLogin,
    validateSignup
} = require("../lib/auth-api");

test("signup validation normalizes emails and accepts a valid password", () => {
    assert.deepEqual(validateSignup({
        email: "  PERSON@example.com ",
        password: "a-long-password"
    }), {
        email: "person@example.com",
        password: "a-long-password"
    });
});

test("signup validation rejects invalid email addresses and short passwords", () => {
    assert.equal(validateSignup({
        email: "not-an-email",
        password: "a-long-password"
    }).error, "Enter a valid email address.");

    assert.equal(validateSignup({
        email: "person@example.com",
        password: "too-short"
    }).error, "Use a password between 12 and 128 characters long.");
});

test("login accepts valid emails and checks stored password hashes", async () => {
    const password = "a-long-password";
    const hash = await passwordHash(password);

    assert.deepEqual(validateLogin({ email: "person@example.com", password }), {
        email: "person@example.com",
        password
    });
    assert.equal(await passwordMatches(password, hash), true);
    assert.equal(await passwordMatches("a-different-password", hash), false);
});

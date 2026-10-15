const { neon } = require("@neondatabase/serverless");
const {
    createHash,
    randomBytes,
    scrypt: scryptCallback,
    timingSafeEqual
} = require("node:crypto");
const { promisify } = require("node:util");

const scrypt = promisify(scryptCallback);
const sessionCookieName = "__Host-myworld_session";
const sessionMaxAge = 60 * 60 * 24 * 30;
const passwordSaltBytes = 16;
const passwordKeyBytes = 64;
const passwordCost = 16384;
const passwordBlockSize = 8;
const passwordParallelization = 1;
const dummyPasswordHash = `scrypt$${passwordCost}$${passwordBlockSize}$${passwordParallelization}$6f99b823dd90ae82b58f4cc1c37bd72a$${"0".repeat(passwordKeyBytes * 2)}`;

let sqlClient;

const database = () => {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is not configured.");
    }

    sqlClient ??= neon(process.env.DATABASE_URL);
    return sqlClient;
};

const sessionHash = (token) => createHash("sha256").update(token).digest("hex");

const derivePasswordKey = (password, salt) => scrypt(password, salt, passwordKeyBytes, {
    N: passwordCost,
    r: passwordBlockSize,
    p: passwordParallelization,
    maxmem: 64 * 1024 * 1024
});

const passwordHash = async (password) => {
    const salt = randomBytes(passwordSaltBytes);
    const key = await derivePasswordKey(password, salt);
    return `scrypt$${passwordCost}$${passwordBlockSize}$${passwordParallelization}$${salt.toString("hex")}$${key.toString("hex")}`;
};

const passwordMatches = async (password, storedHash) => {
    const [algorithm, cost, blockSize, parallelization, saltHex, keyHex] = storedHash.split("$");
    if (
        algorithm !== "scrypt" ||
        cost !== String(passwordCost) ||
        blockSize !== String(passwordBlockSize) ||
        parallelization !== String(passwordParallelization) ||
        !new RegExp(`^[\\da-f]{${passwordSaltBytes * 2}}$`).test(saltHex) ||
        !new RegExp(`^[\\da-f]{${passwordKeyBytes * 2}}$`).test(keyHex)
    ) {
        throw new Error("Stored password hash has an invalid format.");
    }

    const actual = await derivePasswordKey(password, Buffer.from(saltHex, "hex"));
    return timingSafeEqual(actual, Buffer.from(keyHex, "hex"));
};

const isValidEmail = (email) =>
    email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const validateEmail = (value) => {
    if (typeof value !== "string") {
        return { error: "Enter a valid email address." };
    }

    const email = value.trim().toLowerCase();
    if (!isValidEmail(email)) {
        return { error: "Enter a valid email address." };
    }

    return { email };
};

const validateSignup = (body) => {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { error: "Enter an email address and password." };
    }

    const emailResult = validateEmail(body.email);
    if (emailResult.error) {
        return emailResult;
    }
    if (typeof body.password !== "string" || [...body.password].length < 12 || [...body.password].length > 128) {
        return { error: "Use a password between 12 and 128 characters long." };
    }

    return { email: emailResult.email, password: body.password };
};

const validateLogin = (body) => {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { error: "Enter an email address and password." };
    }

    const emailResult = validateEmail(body.email);
    if (emailResult.error) {
        return emailResult;
    }
    if (typeof body.password !== "string" || body.password.length === 0 || [...body.password].length > 128) {
        return { error: "Enter your password." };
    }

    return { email: emailResult.email, password: body.password };
};

const parseBody = (req) => {
    if (typeof req.body === "string") {
        return JSON.parse(req.body);
    }
    return req.body;
};

const setSessionCookie = (res, token) => {
    res.setHeader(
        "Set-Cookie",
        `${sessionCookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${sessionMaxAge}`
    );
};

const clearSessionCookie = (res) => {
    res.setHeader(
        "Set-Cookie",
        `${sessionCookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
    );
};

const getSessionToken = (req) => {
    const cookies = (req.headers.cookie || "").split(";");
    const sessionCookie = cookies.find((cookie) => cookie.trim().startsWith(`${sessionCookieName}=`));
    return sessionCookie ? sessionCookie.trim().slice(sessionCookieName.length + 1) : "";
};

const withApi = (methods, handler) => async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const frontendOrigin = process.env.FRONTEND_ORIGIN;
    if (!frontendOrigin) {
        console.error("Authentication API configuration error: FRONTEND_ORIGIN is not set.");
        return res.status(500).json({ error: "The account service is not configured yet." });
    }

    if (req.headers.origin !== frontendOrigin) {
        return res.status(403).json({ error: "This request is not allowed." });
    }

    res.setHeader("Access-Control-Allow-Origin", frontendOrigin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Vary", "Origin");

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    if (!methods.includes(req.method)) {
        res.setHeader("Allow", [...methods, "OPTIONS"].join(", "));
        return res.status(405).json({ error: "Method not allowed." });
    }

    if (req.method === "POST" && !req.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
        return res.status(415).json({ error: "Send account details as JSON." });
    }

    try {
        return await handler(req, res);
    } catch (error) {
        if (error && error.code === "23505") {
            return res.status(409).json({ error: "That email may already be registered. Try signing in." });
        }

        console.error("Authentication API request failed:", error);
        return res.status(500).json({ error: "The account service could not complete the request." });
    }
};

const getValidatedBody = (req, res, validate) => {
    let body;
    try {
        body = parseBody(req);
    } catch {
        res.status(400).json({ error: "The request body must be valid JSON." });
        return null;
    }

    const credentials = validate(body);
    if (credentials.error) {
        res.status(400).json({ error: credentials.error });
        return null;
    }

    return credentials;
};

module.exports = {
    database,
    dummyPasswordHash,
    getSessionToken,
    getValidatedBody,
    passwordHash,
    passwordMatches,
    sessionHash,
    setSessionCookie,
    clearSessionCookie,
    validateLogin,
    validateSignup,
    withApi
};

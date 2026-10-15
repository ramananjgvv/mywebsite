const { randomBytes } = require("node:crypto");
const {
    database,
    getValidatedBody,
    passwordHash,
    sessionHash,
    setSessionCookie,
    validateSignup,
    withApi
} = require("../../lib/auth-api");

module.exports = withApi(["POST"], async (req, res) => {
    const credentials = getValidatedBody(req, res, validateSignup);
    if (!credentials) {
        return;
    }

    const hashedPassword = await passwordHash(credentials.password);
    const token = randomBytes(32).toString("base64url");
    const rows = await database()`
        WITH created_user AS (
            INSERT INTO app_users (email, password_hash)
            VALUES (${credentials.email}, ${hashedPassword})
            ON CONFLICT (email) DO NOTHING
            RETURNING id, email
        ), created_session AS (
            INSERT INTO auth_sessions (token_hash, user_id, expires_at)
            SELECT ${sessionHash(token)}, id, now() + interval '30 days'
            FROM created_user
        )
        SELECT id, email FROM created_user
    `;

    if (rows.length !== 1) {
        return res.status(409).json({ error: "That email may already be registered. Try signing in." });
    }

    setSessionCookie(res, token);
    return res.status(201).json({ user: { id: rows[0].id, email: rows[0].email } });
});

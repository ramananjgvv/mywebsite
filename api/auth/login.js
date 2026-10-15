const { randomBytes } = require("node:crypto");
const {
    database,
    dummyPasswordHash,
    getValidatedBody,
    passwordMatches,
    sessionHash,
    setSessionCookie,
    validateLogin,
    withApi
} = require("../../lib/auth-api");

module.exports = withApi(["POST"], async (req, res) => {
    const credentials = getValidatedBody(req, res, validateLogin);
    if (!credentials) {
        return;
    }

    const rows = await database()`
        SELECT id, email, password_hash
        FROM app_users
        WHERE email = ${credentials.email}
        LIMIT 1
    `;
    const user = rows[0];
    const matches = await passwordMatches(credentials.password, user?.password_hash || dummyPasswordHash);

    if (!user || !matches) {
        return res.status(401).json({ error: "Email or password is incorrect." });
    }

    const token = randomBytes(32).toString("base64url");
    await database()`
        INSERT INTO auth_sessions (token_hash, user_id, expires_at)
        VALUES (${sessionHash(token)}, ${user.id}, now() + interval '30 days')
    `;

    setSessionCookie(res, token);
    return res.status(200).json({ user: { id: user.id, email: user.email } });
});

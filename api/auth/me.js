const {
    database,
    getSessionToken,
    sessionHash,
    clearSessionCookie,
    withApi
} = require("../../lib/auth-api");

module.exports = withApi(["GET"], async (req, res) => {
    const token = getSessionToken(req);
    if (!token) {
        return res.status(401).json({ error: "You are not signed in." });
    }

    const rows = await database()`
        SELECT app_users.id, app_users.email
        FROM auth_sessions
        JOIN app_users ON app_users.id = auth_sessions.user_id
        WHERE auth_sessions.token_hash = ${sessionHash(token)}
          AND auth_sessions.expires_at > now()
        LIMIT 1
    `;

    if (rows.length !== 1) {
        clearSessionCookie(res);
        return res.status(401).json({ error: "You are not signed in." });
    }

    return res.status(200).json({ user: { id: rows[0].id, email: rows[0].email } });
});

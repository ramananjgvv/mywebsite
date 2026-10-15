const {
    database,
    getSessionToken,
    sessionHash,
    clearSessionCookie,
    withApi
} = require("../../lib/auth-api");

module.exports = withApi(["POST"], async (req, res) => {
    const token = getSessionToken(req);
    if (token) {
        await database()`
            DELETE FROM auth_sessions
            WHERE token_hash = ${sessionHash(token)}
        `;
    }

    clearSessionCookie(res);
    return res.status(200).json({ message: "You are signed out." });
});

// Local auth simulator for UI verification, never a production auth service.
import { createServer } from "node:http";
const accounts = [
  { id: "00000000-0000-0000-0000-000000000011", email: "artist@example.test" },
  { id: "00000000-0000-0000-0000-000000000012", email: "admin@example.test" }
].map(account => ({ ...account, aud: "authenticated", role: "authenticated", email_confirmed_at: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z", app_metadata: {}, user_metadata: {}, identities: [] }));
function token(user) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600, iss: "http://127.0.0.1:55440/auth/v1" })}.local-fixture-only`;
}
const sessions = new Map();
createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  const send = (status, body) => { response.statusCode = status; response.end(JSON.stringify(body)); };
  const path = new URL(request.url, "http://127.0.0.1").pathname;
  if (path === "/auth/v1/token" && request.method === "POST") {
    let body = "";
    for await (const chunk of request) body += chunk;
    let input;
    try { input = JSON.parse(body); } catch { return send(400, { message: "Invalid request" }); }
    const user = accounts.find(account => account.email === input.email);
    if (!user || input.password !== "Local-fixture-only-123!") return send(400, { error: "invalid_grant", message: "Invalid credentials" });
    const accessToken = token(user);
    sessions.set(accessToken, user);
    return send(200, { access_token: accessToken, refresh_token: "fixture-refresh", token_type: "bearer", expires_in: 3600, user });
  }
  if (path === "/auth/v1/user") {
    const user = sessions.get((request.headers.authorization || "").replace(/^Bearer /, ""));
    return user ? send(200, user) : send(401, { message: "No fixture session" });
  }
  if (path === "/auth/v1/logout") return send(200, {});
  if (path.startsWith("/auth/v1/admin/users/")) {
    const user = accounts.find(account => account.id === path.split("/").at(-1));
    return user ? send(200, user) : send(404, { message: "No fixture identity" });
  }
  send(404, { message: "Fixture endpoint unavailable" });
}).listen(55440, "127.0.0.1", () => console.log("Local-only auth simulator listening on 55440"));

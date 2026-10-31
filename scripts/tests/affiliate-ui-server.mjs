// Test-only custom server; production continues using the existing Next CLI.
import { createServer } from "node:http";
import next from "next";
const dbUrl = new URL(process.env.DATABASE_URL || "http://invalid");
if (!['localhost', '127.0.0.1'].includes(dbUrl.hostname) || dbUrl.pathname !== "/gvh_affiliate_test" ||
    process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:55440") {
  throw new Error("UI server requires isolated local database and auth simulator");
}
console.log("Preparing isolated Next UI test server");
// Keep preview cookies local even when the workspace has production URL defaults.
process.env.NEXT_PUBLIC_PORTAL_URL = "http://127.0.0.1:3008";
process.env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3008";
const app = next({ dev: true, hostname: "127.0.0.1", port: 3008 });
await app.prepare();
if (process.env.DATABASE_URL !== dbUrl.href || process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:55440") {
  throw new Error("Preview environment isolation changed during startup");
}
createServer(app.getRequestHandler()).listen(3008, "127.0.0.1", () => console.log("Isolated UI test server ready on 3008"));

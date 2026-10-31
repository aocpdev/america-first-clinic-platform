// Read current Admin catalog without moving the application's write connection.
import nextEnv from "@next/env";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const source = process.env.DATABASE_URL;
const company = process.argv.find(arg => arg.startsWith("--company="))?.slice(10);
if (!source || !company || process.env.NODE_ENV === "production" || process.env.VERCEL) throw new Error("Explicit local preview source required");
const destination = "postgresql://axel@127.0.0.1:55439/gvh_affiliate_test";
if (new URL(source).hostname === "127.0.0.1") throw new Error("Source must be the configured Admin database");
Object.assign(process.env, {
  LOCAL_CATALOG_SOURCE_URL: source, LOCAL_CATALOG_SOURCE_COMPANY: company,
  DATABASE_URL: destination, DIRECT_URL: destination,
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55440", NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-fixture-anon",
  SUPABASE_SERVICE_ROLE_KEY: "local-fixture-service", AFFILIATE_ADMIN_ENABLED: "true",
  AFFILIATE_PORTAL_ENABLED: "true", AFFILIATE_COMPANY_SLUG: "affiliate-ui-fixture",
  RX_STOREFRONT_ENABLED: "true", RX_COMPANY_SLUG: "affiliate-ui-fixture", RX_REFERRALS_ENABLED: "true",
  AFFILIATE_APPLICATIONS_ENABLED: "true", AFFILIATE_APPLICATION_SECRET: randomBytes(32).toString("hex"),
  CUSTOMER_PORTAL_ENABLED: "false", AFFILIATE_PAYOUT_SETUP_ENABLED: "false", NEXT_TELEMETRY_DISABLED: "1"
});
// A fresh process prevents Next's cached initial env from restoring production defaults.
const child = spawn(process.execPath, [fileURLToPath(new URL("./affiliate-ui-server.mjs", import.meta.url))], { env: { ...process.env }, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => { process.exitCode = code ?? 1; });

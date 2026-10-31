import { headers } from "next/headers";

/** Only the isolated developer server may emit localhost links. Never trust arbitrary Host. */
export async function affiliateLinkBase() {
  if (!process.env.LOCAL_CATALOG_SOURCE_URL || process.env.NODE_ENV === "production" || process.env.VERCEL) return undefined;
  const host = (await headers()).get("host");
  return host === "127.0.0.1:3008" || host === "localhost:3008" ? `http://${host}/rx` : undefined;
}

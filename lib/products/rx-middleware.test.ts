import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";

test("RX rewrite retains referral query without changing existing portal routing", () => {
  const previous = process.env.RX_STOREFRONT_ENABLED;
  process.env.RX_STOREFRONT_ENABLED = "true";
  try {
    const request = (host: string, path: string) => new NextRequest(`https://${host}${path}`, { headers: { host } });
    const response = middleware(request("rx.govirtualhealth.com", "/?ref=AF-EXAMPLE-CODE"));
    assert.equal(response.headers.get("x-middleware-rewrite"), "https://rx.govirtualhealth.com/rx?ref=AF-EXAMPLE-CODE");
    assert.equal(middleware(request("rx.govirtualhealth.com", "/catalog?category=weight&page=2&ref=AF-EXAMPLE-CODE")).headers.get("x-middleware-rewrite"), "https://rx.govirtualhealth.com/rx/catalog?category=weight&page=2&ref=AF-EXAMPLE-CODE");
    assert.equal(middleware(request("govirtualhealth.com", "/login")).headers.get("location"), "https://portal.govirtualhealth.com/login");
    assert.equal(middleware(request("portal.govirtualhealth.com", "/sales")).headers.get("x-middleware-next"), "1");
    assert.equal(middleware(request("rx.govirtualhealth.com", "/sales")).headers.get("x-middleware-rewrite"), "https://rx.govirtualhealth.com/rx/unavailable");
  } finally {
    if (previous === undefined) delete process.env.RX_STOREFRONT_ENABLED;
    else process.env.RX_STOREFRONT_ENABLED = previous;
  }
});

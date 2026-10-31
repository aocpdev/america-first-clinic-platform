# Go Virtual Health brand assets

Approved reference supplied by the user on October 30, 2026:
`go-virtual-health-source-2026.png`. Retain this unmodified source.

Use the transparent `go-virtual-health-2026.png` through `lib/brand.ts` for
navigation, login, affiliate pages, customer records and order documents.
Do not restore the previous wordmark or add a white tile behind the RX logo.
Preserve the image aspect ratio. Browser icons use the versioned icon assets;
the Apple touch icon intentionally has a white background.

The transparent derivative was produced with the built-in image generation tool
using this prompt:

> Background-extraction of supplied Go Virtual Health emblem, faithful shape preservation. Deliver a pristine transparent PNG logo with NO stray pixels, NO red speckles, NO noise, NO texture outside the solid emblem, NO white haze, NO gradient, NO shadow. The white paper background including every enclosed white region must become fully transparent alpha=0. The red emblem itself should be clean continuous solid red with smoothly antialiased edges. Preserve original outer almost-circular open arc, G letter, connected angled V heartbeat and small terminal circle EXACTLY. Do not add letters/text. Crop canvas closely to emblem, small even margin. Commercial production-ready logo extraction, no redesign.

The PNG has real alpha transparency. Sizes/formats for browser icons and legacy
URLs are derived mechanically from it. Legacy `/go-virtual-health-logo.jpeg`,
`/go-virtual-health-emblem.png`, `/america-first-clinic-logo.jpeg` and
`/rx/wellness/logo-v1.webp` also contain the new emblem so existing stored URLs
remain valid. Historical database migrations are deliberately not rewritten.
Use versioned URLs for new code to avoid stale browser image caches.

# Wellness imagery · October 16, 2026

Generated with the built-in image generation tool. These are illustrative AI-generated lifestyle scenes, not actual patients, clinicians, testimonials or evidence of treatment outcomes. Product photography and commercial data remain sourced from Admin. Do not use these scenes as before/after imagery.

The original logo JPEG is preserved. A separate transparent derivative is used only in the store navigation. Images are delivered as optimized WebP; transparency is preserved for the logo.

## Local verification

User story: browse the redesigned home, explore Admin-owned categories, filter products and navigate catalog pages without altering referral or payment behavior.

- Local server on 127.0.0.1:3008 uses the pre-existing isolated database preview and read-only Admin catalog reader. No production deployment or write.
- Browser: 29 active products, 7 categories; all 9 visible editorial/logo image instances loaded; zero captured console errors.
- Category arrow moved from 1–4 to 4–7 and disabled at the end. Previous control responds to Enter. Links keep the original Admin category IDs.
- Clinical Services filter returned one Urgent Care Visit at $75 with no unnecessary pagination.
- Page 2 returned 12 distinct later products; page 3 returned 5 and no Next link.
- Responsive checks at effective CSS viewport widths 1025, 354, and 291. Found and fixed a grid intrinsic-width issue in the narrow hero; checked both viewport overflow and inner text bounds after the fix. Menu stays two rows at the narrow width.
- TypeScript passed; 13 existing RX routing/middleware/collection tests passed; diff whitespace check passed.
- Original referral banner persisted during browsing. No change to checkout, commission, agency-fee, or ownership logic. Medical descriptions and products are unchanged; clinical/regulatory approval is a separate prerequisite for launch.
- AI-generated images are illustrative; no invented testimonials, outcomes, scarcity, or proof claims added.

## Final prompts

### public/rx/wellness/hero-v1.webp

Portrait editorial lifestyle photograph for a premium wellness shop hero. An approachable woman around 40 with shoulder-length dark brown hair, natural skin texture, relaxed warm smile, wearing an ivory linen shirt, standing in a sunlit modern home near a large window with soft out-of-focus greenery. Framed waist up, plenty of headroom, subject centered, airy sage and warm cream palette. Candid quiet confidence, believable body proportions. High-end magazine photography, soft directional daylight, subtle film grain. No products, no text, no logos, no before-and-after, no implied treatment results.

### public/rx/wellness/clinical-v1.webp

Square editorial photograph for a premium virtual wellness shop category Clinical Services. Adult woman at a pale oak table using a laptop for a virtual appointment in a calm bright home, three-quarter side angle, laptop screen out of focus and no legible text. Sage knit top, natural warm daylight, cream and muted green palette, authentic skin texture, premium magazine photography. No medical outcome claims, no logos or text.

### public/rx/wellness/hair-v1.webp

Square premium editorial beauty photograph of an adult woman with deep brown skin and healthy naturally curly dark hair in a cream sleeveless top, gently moving her hair away from her face, warm natural smile, softly sunlit neutral plaster studio, close portrait with full head in frame and headroom. Natural skin pores, tasteful minimal wellness aesthetic, sage cream palette. No text, no logos, no product bottles, no before-and-after or treatment outcome claims.

### public/rx/wellness/movement-v1.webp

Square premium editorial lifestyle photograph of an adult woman with a natural average body build in muted sage activewear taking a relaxed morning walk beside sunlit coastal grasses. Three-quarter body framing with headroom, authentic candid smile, soft green and cream color palette, realistic skin texture, gentle breeze. Wellness magazine quality. Not a weight loss transformation, no before-and-after, no measuring tape, no scales, no text or logos.

### public/rx/wellness/focus-v1.webp

Use case: photorealistic-natural. Square editorial wellness photograph of an adult Asian man around 40 reading a book in a bright minimal home beside a window, thoughtful relaxed expression, natural skin detail, oatmeal linen shirt, soft sage foliage background, premium lifestyle magazine lighting and authentic everyday atmosphere. Framed waist up, generous headroom. No text, no logos, no supplements, no implied health outcomes.

### public/rx/wellness/balance-v1.webp

Use case: photorealistic-natural. Square editorial wellness photograph, adult woman around 35 with medium olive skin in a cream linen shirt holding a clear glass of water with both hands near a bright kitchen window, candid relaxed moment, sage and warm cream palette, natural skin texture, subtle grain, premium magazine photography. Full head in frame with headroom. No text, no logos, no supplements, no detox claims, no medical outcome.

### public/rx/wellness/longevity-v1.webp

Use case: photorealistic-natural. Square premium editorial wellness photograph of an approachable man in his early 50s with salt-and-pepper hair wearing a cream relaxed polo shirt, enjoying a quiet walk through a sunlit garden, waist-up portrait, green foliage bokeh, candid smile, authentic skin texture and age lines, warm cream sage palette, natural daylight. No logos, no text, no drugs, no before and after, no implied treatment results.

### public/rx/wellness/logo-v1.webp

Superseded on October 30, 2026 by the user-supplied red emblem. This legacy URL
now serves the new transparent emblem for compatibility. New UI references
`/brand/go-virtual-health-2026.png` through `lib/brand.ts`. Source, selected edit
prompt and export details are recorded in `public/brand/README.md`.

Historical prompt for the retired artwork:

Use case: background-extraction. Edit target: the attached Go Virtual Health company logo. Remove ONLY the white background and all white surrounding padding, output on genuinely transparent alpha background. Keep exact original lettering, colors, heartbeat circle emblem, small stars, red horizontal line, and tagline VIRTUAL CARE. REAL RESULTS unchanged. Do not redesign, redraw, reword or add anything. Trim to the visible logo content with small consistent transparent padding. This is for a glass website navigation.


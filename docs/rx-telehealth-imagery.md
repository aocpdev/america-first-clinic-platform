# Telehealth imagery and public service separation

Created 2026-10-16 with the built-in image generation tool. Fictional editorial scenes, not actual patients, testimonials or clinical team portraits. Both originals were reviewed visually and converted to WebP without retouching.

## Assets

- `public/rx/wellness/telehealth-home-v1.webp`: 1536 × 1024, 108,804 bytes. Used on the home section and dedicated landing hero.
- `public/rx/wellness/telehealth-clinician-v1.webp`: 1536 × 1024, 78,904 bytes. Used in the landing's conversation-first section, with illustrative-image disclosure.

## Final prompts

### Home / hero

Use case: photorealistic-natural. Asset type: premium telehealth website homepage section and landing hero, landscape 3:2. Primary request: an authentic editorial photograph of a woman in her late 30s having a relaxed virtual consultation at home. Scene: refined but lived-in sunlit home, warm ivory walls, pale oak table, subtle sage linen, one soft-focus plant. Subject: natural-looking woman with dark wavy hair in a cream knit top, at a laptop, calm attentive expression, viewed in three-quarter side profile. Laptop is visible but its screen angled away so there is no legible interface or medical data. Composition: medium-wide portrait, subject and laptop centered together, generous breathing room, all essential subjects within central 65% for mobile cropping. Lighting: soft daylight, realistic skin texture, editorial wellness photography, sophisticated minimal Apple-inspired art direction, not a stock-photo grin. Constraints: fictional adult, no actual patient testimonial, no pills, product bottles, vials, syringes, weight scales, measurement tapes, text, logos, watermarks, before/after or treatment-result claims.

### Supporting consultation scene

Use case: photorealistic-natural. Asset type: premium telehealth landing page supporting editorial image, landscape 3:2. Primary request: a caring female clinician in her early 40s seated at a laptop in a warm minimalist consultation office, listening thoughtfully during a video appointment. Scene: pale ivory wall, natural oak desk, soft sage accents, clean uncluttered environment, understated professional white coat over neutral top, no visible institutional brand. Subject: realistic woman with medium brown skin and neatly tied dark hair, candid three-quarter angle, laptop screen facing away, natural hands resting at desk. Composition: subject and laptop comfortably inside central 65%, medium-wide crop adaptable to mobile. Lighting: beautiful soft window light, human natural skin texture, sophisticated understated editorial photography. Constraints: fictional clinician illustration, not a named team member, no text, logos, badges with writing, visible patient records, medication packaging, vials, needles, promises or testimonial implications.

## Scope and launch boundary

- Home section links to `/telehealth` on RX (`/rx/telehealth` in local preview). The Explore menu also provides a separate Telehealth entry.
- The exact existing `Clinical Services` category is excluded from public catalog queries, counts, filters, category rail and category navigation. Admin data is not deleted or modified. Existing active clinical product/review routes redirect to Telehealth; cart mutations reject them and stale carts cannot proceed with them.
- The current Admin record is named `Urgent Care Visit`. Its $75 price is deliberately not reinterpreted as a Telehealth fee. This landing has no hardcoded consultation price, appointment form, health-data collection or payment action.
- Scheduling, clinical scope/availability and consultation pricing require confirmation before activation. The page explicitly labels scheduling as coming soon. No production deployment, database change or payment integration is included.

## Verification

- TypeScript passed; 34 focused tests passed for catalog routing, service exclusion, cart input and quote policy.
- Browser confirmed 28 products and 6 shop categories (previously 29 and 7); Clinical Services no longer appears in the home rail or catalog filters.
- Home CTA opens the dedicated landing. Both `/rx/products/urgent-care-visit` and `/rx/review/urgent-care-visit` redirect there.
- Both generated images load; the landing has no Add to cart action. FAQ disclosure works. No horizontal overflow at 354 CSS pixels. Referral banner and existing cart selection remain intact.
- React review kept the new sections server-rendered, used semantic headings/native disclosure controls and responsive optimized images. Routing changes are confined to the gated RX host.

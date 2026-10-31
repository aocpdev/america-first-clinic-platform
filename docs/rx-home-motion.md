# Home editorial and motion refinement — 2026-10-16

## Scope

- Home only: catalog uses an open editorial composition with the product on the left; Telehealth is a full-width dark section with copy on the left and its existing generated photo on the right. Mobile returns to one column in reading order.
- Numbered, open-layout journey replaces the large blue panel; the affiliate invitation gets a distinct editorial treatment and circular link affordance.
- Existing Admin catalog data, clinical-service exclusion, referral URLs, cart, checkout and payment/commission logic are unchanged. No new images, dependencies or production deployment.

## Motion and accessibility

- A small client wrapper observes server-rendered children with IntersectionObserver. Below-the-fold blocks reveal once using opacity/transform only. No scroll hijacking, scroll listeners, forced scrolling, endless floating or autoplay animation.
- Content remains visible with JavaScript disabled or IntersectionObserver unavailable. No initial hidden CSS. Already-visible elements are not animated during hydration.
- Reduced-motion preference prevents observation and all CSS animations/transitions. Changing preference disconnects observers and removes reveal classes. Listeners/observers clean up on unmount.
- Keyboard focus cancels the corresponding reveal and leaves controls immediately visible. Links keep focus outlines; native links and existing category controls remain functional.
- Hover movement is limited to hover-capable devices without reduced-motion preference. React skill review kept catalog data server-rendered and avoided adding an animation-library dependency.

## Verification

- TypeScript and whitespace checks passed. 34 existing catalog/routing/cart/quote regression tests passed.
- Browser confirmed catalog image left and Telehealth image right on desktop, CSS reveal activation during scroll, and mobile stacking without horizontal overflow at 354 CSS pixels. No browser errors observed.
- Desktop proof: `/private/tmp/gvh-home-editorial-catalog.png` and `/private/tmp/gvh-home-modern-telehealth.png`.
- Reduced-motion safeguards were inspected in implementation; no operating-system preference was changed during testing.

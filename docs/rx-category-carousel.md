# Category carousel navigation — 2026-10-16

Applied the pill-position indicator and circular previous/next controls from the user's Ro reference to the existing home category rail. The full product catalog retains its separate numbered pages.

- Desktop exposes part of the next card; arrows move one card including its gap. Native touch/trackpad scrolling and CSS scroll snap remain available.
- A compact pill displays the actual visible fraction and scroll position, recalculated on scroll and resize. The native visual scrollbar is hidden.
- Buttons disable at the ends; keyboard users can focus the list and use arrows, Home and End. Screen readers receive a category range and a named meter. No autoplay or account/payment changes.
- Motion uses smooth scrolling unless reduced motion is requested. Controls are at least 48 pixels on mobile; focus styles remain visible.
- Three unit tests cover start/middle/end, overscroll, subpixel edges, zero/invalid widths and responsive sizing. TypeScript and whitespace validation passed.
- Browser verified start at 0% with Previous disabled, one-card advance (desktop offset ~294px), end at 100% with Next disabled, and keyboard Home/End/ArrowRight. At 354px CSS viewport the indicator resized to the visible fraction and the page had no horizontal overflow. Category data and destinations remain Admin-backed.

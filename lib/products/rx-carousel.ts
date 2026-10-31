/** Derive the indicator from the actual scroll area, including resize and overscroll. */
export function rxCarouselMetrics(viewport: number, content: number, offset: number) {
  if (![viewport, content, offset].every(Number.isFinite) || viewport <= 0 || content <= viewport + 1) {
    return { previous: false, next: false, progress: 0, thumbWidth: 100, thumbLeft: 0 };
  }
  const max = content - viewport;
  const current = Math.min(max, Math.max(0, offset));
  const progress = current / max;
  const thumbWidth = viewport / content * 100;
  return { previous: current > 1, next: current < max - 1,
    progress: Math.round(progress * 100),
    thumbWidth: Math.round(thumbWidth * 100) / 100,
    thumbLeft: Math.round(progress * (100 - thumbWidth) * 100) / 100 };
}

export function captureInternalEvent(event: string, properties: Record<string, unknown> = {}) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return;
  }

  return {
    event,
    properties,
    ready: true
  };
}

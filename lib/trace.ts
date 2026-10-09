export type TraceEvent = {
  requestId: string;
  event: string;
  provider?: string;
  model?: string;
  durationMs?: number;
  status?: "success" | "error" | "timeout";
  error?: string;
  [key: string]: unknown;
};

let requestIdCounter = 0;

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function generateRequestId(): string {
  return `teos-${Date.now()}-${++requestIdCounter}-${randomId()}`;
}

export function trace(event: TraceEvent): void {
  const entry = {
    timestamp: new Date().toISOString(),
    ...event,
  };

  if (process.env.NODE_ENV === "production") {
    console.log(JSON.stringify(entry)); // eslint-disable-line no-console
  } else {
    const { requestId, event: evt, ...rest } = entry;
    console.log(`[${requestId}] ${evt}`, rest); // eslint-disable-line no-console
  }
}

export function createTraceContext(): { requestId: string } {
  return { requestId: generateRequestId() };
}

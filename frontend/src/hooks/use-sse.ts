import { useEffect, useRef, useCallback } from "react";

export type SSEEvent = {
  type: string;
  channel: string;
  data: Record<string, unknown>;
};

type SSEOptions = {
  /** Channels to subscribe to (e.g. ["test-runs"]) */
  channels?: string[];
  /** Called for every SSE event received */
  onEvent?: (event: SSEEvent) => void;
  /** Called when connection opens */
  onConnected?: () => void;
  /** Called on error / disconnect. Will auto-reconnect. */
  onError?: (error: Event) => void;
  /** Whether SSE is enabled. Default true. */
  enabled?: boolean;
};

const SSE_BASE = process.env.NEXT_PUBLIC_SSE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

/**
 * Reusable hook to subscribe to Server-Sent Events.
 * Connects directly to the backend (not through Next.js proxy) since
 * Next.js rewrites buffer responses and break SSE streaming.
 *
 * Usage:
 *   useSSE({
 *     channels: ["test-runs"],
 *     onEvent: (event) => {
 *       if (event.type === "test-run:updated") { ... }
 *     },
 *   });
 */
export function useSSE({ channels, onEvent, onConnected, onError, enabled = true }: SSEOptions) {
  const onEventRef = useRef(onEvent);
  const onConnectedRef = useRef(onConnected);
  const onErrorRef = useRef(onError);

  // Keep refs up to date without triggering reconnect
  onEventRef.current = onEvent;
  onConnectedRef.current = onConnected;
  onErrorRef.current = onError;

  const channelsKey = channels?.sort().join(",") ?? "";

  useEffect(() => {
    if (!enabled) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let isClosed = false;

    function connect() {
      if (isClosed) return;

      const params = channelsKey ? `?channels=${encodeURIComponent(channelsKey)}` : "";
      eventSource = new EventSource(`${SSE_BASE}/events${params}`);

      eventSource.onmessage = (e) => {
        try {
          const event: SSEEvent = JSON.parse(e.data);
          if (event.type === "connected") {
            onConnectedRef.current?.();
          } else {
            onEventRef.current?.(event);
          }
        } catch {
          // Ignore malformed messages
        }
      };

      eventSource.onerror = (e) => {
        onErrorRef.current?.(e);
        eventSource?.close();
        // Auto-reconnect after 3s
        if (!isClosed) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };
    }

    connect();

    return () => {
      isClosed = true;
      clearTimeout(reconnectTimeout);
      eventSource?.close();
    };
  }, [channelsKey, enabled]);
}

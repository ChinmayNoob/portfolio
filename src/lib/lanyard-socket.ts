/**
 * One shared Lanyard WebSocket for the whole page.
 *
 * Both the Discord tile and the Spotify tile read the same presence payload,
 * so they subscribe here rather than each opening their own socket. The
 * connection is reference-counted: it opens on the first subscriber, replays
 * the latest presence to anyone who joins late, and closes when the last
 * subscriber goes away.
 */
import {
  LANYARD_REST,
  LANYARD_SOCKET,
  type LanyardPresence,
  isLanyardPresence,
} from "~/lib/lanyard"

type Listener = (presence: LanyardPresence) => void

const RECONNECT_MS = 5_000
const DEFAULT_HEARTBEAT_MS = 30_000

const listeners = new Set<Listener>()

let socket: WebSocket | null = null
let heartbeatId: number | null = null
let reconnectId: number | null = null
let userId: string | null = null
let latest: LanyardPresence | null = null

const emit = (presence: LanyardPresence) => {
  latest = presence
  for (const listener of [...listeners]) listener(presence)
}

const clearTimers = () => {
  if (heartbeatId !== null) window.clearInterval(heartbeatId)
  if (reconnectId !== null) window.clearTimeout(reconnectId)
  heartbeatId = null
  reconnectId = null
}

/** A REST read fills the tiles immediately, before the socket handshake. */
const prime = (id: string) => {
  fetch(`${LANYARD_REST}/${id}`)
    .then((response) => (response.ok ? response.json() : null))
    .then((body) => {
      if (latest || !body?.success || !isLanyardPresence(body.data)) return
      emit(body.data)
    })
    .catch(() => {})
}

const open = (id: string) => {
  const connection = new WebSocket(LANYARD_SOCKET)
  socket = connection

  connection.onmessage = (message) => {
    let payload: { op: number; t?: string; d?: unknown }
    try {
      payload = JSON.parse(message.data)
    } catch {
      return
    }

    // op 1 = Hello: subscribe, then heartbeat on the interval it dictates.
    if (payload.op === 1) {
      const interval = (payload.d as { heartbeat_interval?: number })
        ?.heartbeat_interval
      connection.send(JSON.stringify({ op: 2, d: { subscribe_to_id: id } }))
      if (heartbeatId !== null) window.clearInterval(heartbeatId)
      heartbeatId = window.setInterval(
        () => connection.send(JSON.stringify({ op: 3 })),
        interval ?? DEFAULT_HEARTBEAT_MS,
      )
      return
    }

    if (
      payload.op === 0 &&
      (payload.t === "INIT_STATE" || payload.t === "PRESENCE_UPDATE") &&
      isLanyardPresence(payload.d)
    ) {
      emit(payload.d)
    }
  }

  connection.onclose = () => {
    if (heartbeatId !== null) window.clearInterval(heartbeatId)
    heartbeatId = null
    if (socket !== connection) return
    socket = null
    if (!listeners.size) return
    if (reconnectId !== null) window.clearTimeout(reconnectId)
    reconnectId = window.setTimeout(() => open(id), RECONNECT_MS)
  }

  connection.onerror = () => connection.close()
}

export const subscribeLanyard = (id: string, listener: Listener): (() => void) => {
  listeners.add(listener)

  if (userId !== id) {
    // Different user than whatever we had open — start over.
    userId = id
    latest = null
    clearTimers()
    socket?.close()
    socket = null
  }

  if (latest) listener(latest)
  if (!socket) {
    prime(id)
    open(id)
  }

  return () => {
    listeners.delete(listener)
    if (listeners.size) return
    clearTimers()
    socket?.close()
    socket = null
  }
}

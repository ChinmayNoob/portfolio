/**
 * Adapter for Lanyard (https://github.com/Phineas/lanyard) — a public API that
 * exposes the Discord presence of anyone who has joined the Lanyard Discord
 * server. Maps its payloads onto the DiscordPresenceState the tile renders.
 */
import type {
  DiscordActivity,
  DiscordPresenceState,
  DiscordStatus,
} from "~/lib/discord-presence"

export const LANYARD_REST = "https://api.lanyard.rest/v1/users"
export const LANYARD_SOCKET = "wss://api.lanyard.rest/socket"

/** Discord's activity types. 4 is a custom status, not something being done. */
const CUSTOM_STATUS = 4

export interface LanyardUser {
  id: string
  username: string
  global_name?: string | null
  display_name?: string | null
  discriminator?: string | null
  avatar?: string | null
}

interface LanyardActivity {
  name: string
  type: number
  state?: string | null
  details?: string | null
  application_id?: string | null
  timestamps?: { start?: number | null; end?: number | null } | null
  assets?: {
    large_image?: string | null
    large_text?: string | null
    small_image?: string | null
    small_text?: string | null
  } | null
}

export interface LanyardPresence {
  discord_user: LanyardUser
  discord_status: string
  activities?: LanyardActivity[] | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export const isLanyardPresence = (value: unknown): value is LanyardPresence =>
  isRecord(value) &&
  isRecord(value.discord_user) &&
  typeof value.discord_user.id === "string" &&
  typeof value.discord_user.username === "string" &&
  typeof value.discord_status === "string"

const toStatus = (status: string): DiscordStatus =>
  status === "online" || status === "idle" || status === "dnd"
    ? status
    : "offline"

/**
 * Discord asset references come in three shapes, and only the last one is an
 * actual CDN path — the other two need rewriting before they resolve.
 */
export const lanyardAssetUrl = (
  asset: string | null | undefined,
  applicationId: string | null | undefined,
): string | null => {
  if (!asset) return null
  if (asset.startsWith("mp:external/")) {
    const rest = asset.slice("mp:external/".length)
    const separator = rest.indexOf("/https/")
    if (separator === -1) return null
    return `https://media.discordapp.net/external/${rest.slice(0, separator)}/https/${rest.slice(separator + "/https/".length)}`
  }
  if (asset.startsWith("spotify:")) {
    return `https://i.scdn.co/image/${asset.slice("spotify:".length)}`
  }
  if (!applicationId) return null
  return `https://cdn.discordapp.com/app-assets/${applicationId}/${asset}.png`
}

export const lanyardAvatarUrl = (user: LanyardUser): string | null => {
  if (!user.avatar) return null
  const extension = user.avatar.startsWith("a_") ? "gif" : "png"
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=128`
}

export const lanyardDisplayName = (user: LanyardUser): string =>
  user.global_name || user.display_name || user.username

export const lanyardHandle = (user: LanyardUser): string =>
  user.discriminator && user.discriminator !== "0"
    ? `${user.username}#${user.discriminator}`
    : `@${user.username}`

export const lanyardPresenceState = (
  presence: LanyardPresence,
): DiscordPresenceState => {
  const activity = (presence.activities ?? []).find(
    (candidate) => candidate.type !== CUSTOM_STATUS,
  )

  if (!activity) {
    return {
      activity: null,
      status: toStatus(presence.discord_status),
      is_active: false,
      duration_ms: null,
      duration_pending: false,
    }
  }

  const applicationId = activity.application_id ?? null
  const mapped: DiscordActivity = {
    name: activity.name,
    details: activity.details ?? null,
    state: activity.state ?? null,
    application_id: applicationId,
    start_ms: activity.timestamps?.start ?? null,
    assets: activity.assets
      ? {
          large_image: lanyardAssetUrl(
            activity.assets.large_image,
            applicationId,
          ),
          large_text: activity.assets.large_text ?? null,
          small_image: lanyardAssetUrl(
            activity.assets.small_image,
            applicationId,
          ),
          small_text: activity.assets.small_text ?? null,
        }
      : null,
  }

  return {
    activity: mapped,
    status: toStatus(presence.discord_status),
    is_active: true,
    duration_ms: null,
    duration_pending: true,
  }
}

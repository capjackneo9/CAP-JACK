import "server-only";

/**
 * Central, server-only configuration. Every external dependency is optional
 * at boot so the site can run in development; each integration reports
 * whether it is configured so the UI can show honest "not connected" states.
 */
function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export const config = {
  appUrl: env("APP_URL") ?? "http://localhost:3000",
  timezone: env("STATION_TIMEZONE") ?? "America/New_York",
  uploadDir: env("UPLOAD_DIR") ?? "./uploads",
  maxUploadBytes: Number(env("MAX_UPLOAD_MB") ?? "200") * 1024 * 1024,
  maxVideoBytes: Number(env("MAX_VIDEO_MB") ?? "1024") * 1024 * 1024,
  /** Live video (MediaMTX). API is internal; HLS is served to browsers under /live-hls/ via Caddy. */
  liveVideo: {
    apiUrl: env("MEDIAMTX_API_URL"),
    path: env("MEDIAMTX_PATH") ?? "live",
    hlsPublicBase: env("NEXT_PUBLIC_LIVE_HLS_BASE") ?? "/live-hls",
    rtmpUrl: env("LIVE_RTMP_URL"),
  },
  azuracast: {
    baseUrl: env("AZURACAST_BASE_URL")?.replace(/\/+$/, ""),
    stationId: env("AZURACAST_STATION_ID"),
    shortcode: env("AZURACAST_STATION_SHORTCODE"),
    apiKey: env("AZURACAST_API_KEY"),
  },
  livekit: {
    url: env("LIVEKIT_URL"),
    apiKey: env("LIVEKIT_API_KEY"),
    apiSecret: env("LIVEKIT_API_SECRET"),
  },
  stripe: {
    secretKey: env("STRIPE_SECRET_KEY"),
    webhookSecret: env("STRIPE_WEBHOOK_SECRET"),
  },
};

export const integrations = {
  azuracastPublic: () => Boolean(config.azuracast.baseUrl && config.azuracast.stationId),
  azuracastAdmin: () => Boolean(config.azuracast.baseUrl && config.azuracast.stationId && config.azuracast.apiKey),
  livekit: () => Boolean(config.livekit.url && config.livekit.apiKey && config.livekit.apiSecret),
  stripe: () => Boolean(config.stripe.secretKey),
  liveVideo: () => Boolean(config.liveVideo.apiUrl),
};

export function integrationStatus() {
  return {
    azuracastPublic: integrations.azuracastPublic(),
    azuracastAdmin: integrations.azuracastAdmin(),
    webcast: Boolean(process.env.NEXT_PUBLIC_WEBCAST_URL),
    streamUrlOverride: Boolean(process.env.NEXT_PUBLIC_STREAM_URL),
    livekit: integrations.livekit(),
    stripe: integrations.stripe(),
    liveVideo: integrations.liveVideo(),
    database: Boolean(env("DATABASE_URL")),
    authSecret: Boolean(env("AUTH_SECRET")),
  };
}

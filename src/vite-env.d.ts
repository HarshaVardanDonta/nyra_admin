/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Empty in dev uses Vite proxy (same-origin). Required for production builds. */
  readonly VITE_API_BASE_URL?: string
  /** Optional subpath before `/api`… (empty when API is at origin). */
  readonly VITE_API_PATH_PREFIX?: string
  /** Dev-only: proxy target; see vite.config.ts (prefix path or /api + /healthz). */
  readonly VITE_API_PROXY_TARGET?: string
  /** MSG91 OTP widget id (dashboard). With `VITE_MSG91_WIDGET_AUTH_TOKEN`, admin login uses the widget SDK. */
  readonly VITE_MSG91_WIDGET_ID?: string
  /** Per-widget auth token from MSG91 dashboard (not the server MSG91_AUTH_KEY). */
  readonly VITE_MSG91_WIDGET_AUTH_TOKEN?: string
  /**
   * Set to `false` or `0` to use legacy Nyra OTP API (`/auth/otp/send` + `/verify`) for local dummy OTP.
   */
  readonly VITE_USE_MSG91_WIDGET?: string
  /** Override MSG91 widget API origin (default `https://control.msg91.com/api/v5/widget`, no trailing slash). */
  readonly VITE_MSG91_WIDGET_API_BASE?: string
  /**
   * When not `false`/`0`, widget OTP calls use Nyra `POST /api/v1/auth/otp/widget/*` (needed for web-only MSG91 widgets on mobile).
   */
  readonly VITE_MSG91_WIDGET_USE_SERVER_PROXY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base del API; vacía en desarrollo (Vite reenvía /api) y cuando la web y el API comparten origen. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

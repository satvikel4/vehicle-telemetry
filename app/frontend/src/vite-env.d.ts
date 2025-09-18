/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WS_STREAM: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}


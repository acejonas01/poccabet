// The shared code (../frontend/src) reads Vite-style settings; next.config.ts fills them in.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_THEMES?: string;
  readonly VITE_PUBLIC_URL?: string;
  readonly DEV?: boolean;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

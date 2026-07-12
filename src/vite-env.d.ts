/// <reference types="vite/client" />

declare module "heic2any" {
  export interface Heic2AnyOptions {
    blob: Blob;
    toType?: string;
    quality?: number;
  }

  export default function heic2any(options: Heic2AnyOptions): Promise<Blob | Blob[]>;
}

declare module "virtual:pwa-register" {
  export function registerSW(options?: { immediate?: boolean }): () => void;
}
/// <reference types="vite-plugin-pwa/client" />

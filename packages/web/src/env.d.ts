/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    session?: {
      valid: boolean;
      id: string | undefined;
    };
  }
}

declare module '@opencode-ai/sdk' {
  export function createOpencode(config?: Record<string, unknown>): Promise<{
    client: { session: { create(body: Record<string, unknown>): Promise<{ data?: { id?: string } }>; prompt(body: Record<string, unknown>): Promise<unknown> } };
    server: { close(): void };
  }>;
  export function createOpencodeClient(config?: Record<string, unknown>): Record<string, unknown>;
}

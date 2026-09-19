// The vault is indexed by Hermes (filesystem/MCP tool on the host it runs on), not read
// here — see docs/agent-system/PLAN.md. This is a thin search client over that index.

import { hermesOnline, hermesSearchMemory } from "./hermes";
import type { VaultNote } from "./types";

const VAULT_SOURCE = "obsidian-vault";

export function secondBrainOnline(): boolean {
  return hermesOnline();
}

export async function searchSecondBrain(query: string): Promise<VaultNote[]> {
  return hermesSearchMemory(query, VAULT_SOURCE);
}

import type { StatuslineItem } from "../types.ts";
import { TPSItem } from "./tps.ts";

/**
 * Registry of available statusline items.
 */
export class ItemRegistry {
  private items = new Map<string, StatuslineItem>();

  constructor() {
    // Register default items
    this.register(new TPSItem());
  }

  register(item: StatuslineItem): void {
    this.items.set(item.id, item);
  }

  get(id: string): StatuslineItem | undefined {
    return this.items.get(id);
  }

  getAll(): StatuslineItem[] {
    return Array.from(this.items.values());
  }

  has(id: string): boolean {
    return this.items.has(id);
  }
}

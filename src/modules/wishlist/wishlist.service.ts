/**
 * DISABLED — Phase 2 (wishlist).
 *
 * Placeholder interface only. Yadette's MVP has no wishlist table or handlers.
 */
export interface WishlistItem {
  id: string;
  personId: string;
  title: string;
  url: string | null;
  price: number | null;
}

export interface WishlistService {
  listForPerson(personId: string): Promise<WishlistItem[]>;
  add(personId: string, title: string): Promise<WishlistItem>;
  remove(itemId: string, personId: string): Promise<void>;
}

export const WISHLIST_MODULE_ENABLED = false;

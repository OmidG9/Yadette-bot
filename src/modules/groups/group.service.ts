/**
 * DISABLED — Phase 2 (group gift pool).
 *
 * Placeholder only: no schema, no handlers, no calls. Teams/group support is a
 * separate concern and will be added as its own module later.
 */
export interface GroupPool {
  id: string;
  personId: string;
  currency: string;
  targetAmount: number;
}

export interface GroupService {
  createPool(personId: string, currency: string, targetAmount: number): Promise<GroupPool>;
  contribute(poolId: string, userId: string, amount: number): Promise<GroupPool>;
}

export const GROUP_MODULE_ENABLED = false;

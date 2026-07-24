import type { ResolverAdapter } from './types'

/**
 * Identity function that types an adapter definition. Zero runtime cost; it exists
 * so the compiler enforces the contract at the definition site and gives full
 * inference. See docs/06-resolver-engine.md §7.
 */
export function defineAdapter(adapter: ResolverAdapter): ResolverAdapter {
  return adapter
}

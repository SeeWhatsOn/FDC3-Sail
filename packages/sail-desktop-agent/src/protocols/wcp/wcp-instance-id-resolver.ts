/**
 * Shared temp→canonical WCP instance id resolver.
 *
 * WCP4 routes under `temp-{connectionAttemptUuid}`; WCP5 assigns the canonical
 * `instanceId`. Production links at WCP5 success (see wcp-handlers); the browser
 * connector also links when migrating connection maps. Cleanup, DACP routing, and
 * test harnesses resolve through this module so disconnect and adoption stay aligned.
 */

/** temp-{connectionAttemptUuid} → canonical WCP5 instanceId */
const tempToCanonicalInstanceIds = new Map<string, string>()

/** Record temp→canonical mapping after WCP5 validation succeeds. */
export function linkTempToCanonical(tempInstanceId: string, canonicalInstanceId: string): void {
  tempToCanonicalInstanceIds.set(tempInstanceId, canonicalInstanceId)
}

/** Resolve canonical instance id from a WCP4 temp connection id, if linked. */
export function resolveCanonicalInstanceId(tempInstanceId: string): string | undefined {
  return tempToCanonicalInstanceIds.get(tempInstanceId)
}

/** Remove all temp ids pointing at the given canonical instance (disconnect cleanup). */
export function unlinkCanonical(canonicalInstanceId: string): void {
  for (const [tempId, canonicalId] of tempToCanonicalInstanceIds) {
    if (canonicalId === canonicalInstanceId) {
      tempToCanonicalInstanceIds.delete(tempId)
    }
  }
}

/** @internal Clears all mappings (test teardown only). */
export function clearAllWcpInstanceIdMappingsForTesting(): void {
  tempToCanonicalInstanceIds.clear()
}

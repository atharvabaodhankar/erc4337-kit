import { useMemo } from 'react'

/**
 * useExplorer
 *
 * Returns chain-aware block explorer URL helpers.
 * No hardcoded URLs — reads directly from the viem chain object's
 * blockExplorers config, so it always matches whatever chain you're on.
 *
 * @param {object} params
 * @param {object} params.chain — viem chain object (e.g. polygonAmoy, polygon, sepolia)
 *
 * @returns {object} {
 *   tx(hash),            ← full URL to a transaction
 *   address(addr),       ← full URL to an address page
 *   block(number),       ← full URL to a block
 *   token(addr),         ← full URL to a token page
 *   baseUrl,             ← root explorer URL (e.g. "https://polygonscan.com")
 *   name,                ← explorer name (e.g. "Polygonscan")
 * }
 *
 * @example
 * const explorer = useExplorer({ chain: polygonAmoy })
 *
 * // Open transaction in explorer
 * window.open(explorer.tx(txHash))
 *
 * // Display address link
 * <a href={explorer.address(smartAccountAddress)}>View on Explorer</a>
 *
 * // Display shortened hash with link
 * <a href={explorer.tx(hash)}>{hash.slice(0, 8)}...{hash.slice(-6)}</a>
 */
export function useExplorer({ chain }) {
  return useMemo(() => {
    // viem chains expose blockExplorers.default.url and .name
    const explorerUrl = chain?.blockExplorers?.default?.url ?? null
    const explorerName = chain?.blockExplorers?.default?.name ?? 'Block Explorer'

    // Strip trailing slash for clean URL concatenation
    const base = explorerUrl ? explorerUrl.replace(/\/$/, '') : null

    /**
     * Build an explorer URL for a given path segment.
     * Returns null if no explorer is configured for this chain.
     */
    function buildUrl(path) {
      if (!base) return null
      return `${base}${path}`
    }

    return {
      /** Full URL to a transaction detail page */
      tx: (hash) => buildUrl(`/tx/${hash}`),

      /** Full URL to an address page (wallet or contract) */
      address: (addr) => buildUrl(`/address/${addr}`),

      /** Full URL to a block detail page */
      block: (blockNumber) => buildUrl(`/block/${blockNumber}`),

      /** Full URL to a token page */
      token: (tokenAddr) => buildUrl(`/token/${tokenAddr}`),

      /** Root explorer URL */
      baseUrl: base,

      /** Explorer display name */
      name: explorerName,
    }
  }, [chain])
}

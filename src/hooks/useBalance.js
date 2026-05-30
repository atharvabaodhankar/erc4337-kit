import { useState, useEffect, useCallback } from 'react'
import { createPublicClient, http, formatEther } from 'viem'

/**
 * useBalance
 *
 * Returns the native token balance (ETH, MATIC, etc.) for a Smart Account.
 * Auto-fetches on mount and exposes a refetch function for manual refresh.
 *
 * @param {object} params
 * @param {string} params.address   — Smart Account address (from useSmartAccount().smartAccountAddress)
 * @param {object} params.chain     — viem chain object (e.g. polygonAmoy)
 * @param {string} params.rpcUrl    — your RPC URL (same one passed to ChainProvider)
 *
 * @returns {object} {
 *   formatted,  ← human-readable string e.g. "1.234"
 *   raw,        ← raw balance in wei (BigInt)
 *   symbol,     ← native currency symbol e.g. "ETH", "MATIC"
 *   isLoading,
 *   error,
 *   refetch     ← call this to manually refresh the balance
 * }
 *
 * @example
 * const { smartAccountAddress } = useSmartAccount({ ... })
 * const { formatted, symbol } = useBalance({
 *   address: smartAccountAddress,
 *   chain: polygonAmoy,
 *   rpcUrl: import.meta.env.VITE_RPC_URL
 * })
 *
 * // Display: "Balance: 0.5 MATIC"
 */
export function useBalance({ address, chain, rpcUrl }) {
  const [raw, setRaw]           = useState(null)
  const [formatted, setFormatted] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]       = useState(null)

  const symbol = chain?.nativeCurrency?.symbol ?? 'ETH'

  const fetchBalance = useCallback(async () => {
    if (!address || !chain || !rpcUrl) return

    setIsLoading(true)
    setError(null)

    try {
      const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
      })

      const balanceWei = await publicClient.getBalance({ address })

      setRaw(balanceWei)
      // formatEther gives 18-decimal precision; trim to 6 for display
      const full = formatEther(balanceWei)
      setFormatted(trimDecimals(full, 6))

    } catch (err) {
      console.error('[erc4337-kit] useBalance fetch failed:', err)
      setError(err.message || 'Failed to fetch balance')
    } finally {
      setIsLoading(false)
    }
  }, [address, chain, rpcUrl])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  return {
    formatted,
    raw,
    symbol,
    isLoading,
    error,
    refetch: fetchBalance,
  }
}

// -----------------------------------------------------------------
// Internal: trim a decimal string to N decimal places
// -----------------------------------------------------------------
function trimDecimals(value, decimals) {
  const [integer, fraction = ''] = value.split('.')
  if (!fraction) return integer
  return `${integer}.${fraction.slice(0, decimals)}`
}

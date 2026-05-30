import { useState, useEffect, useCallback, useRef } from 'react'
import { createPublicClient, http } from 'viem'

/**
 * useContractRead
 *
 * Read from any contract function with built-in caching, loading states,
 * auto-refetch on interval, and manual refetch support.
 *
 * Uses React Query-style semantics without requiring React Query to be
 * imported directly. Backed by a publicClient created from chain + rpcUrl.
 *
 * @param {object} params
 * @param {string}  params.address       — contract address
 * @param {array}   params.abi           — contract ABI
 * @param {string}  params.functionName  — function to read
 * @param {array}   [params.args]        — function arguments (default [])
 * @param {string}  [params.account]     — caller address (for msg.sender-based reads)
 * @param {object}  params.chain         — viem chain object
 * @param {string}  params.rpcUrl        — RPC URL
 * @param {number}  [params.refetchInterval] — auto-refetch interval in ms (0 = disabled)
 * @param {boolean} [params.enabled]     — set false to skip the fetch (default true)
 *
 * @returns {object} {
 *   data,       ← the returned value from the contract
 *   isLoading,
 *   isFetching, ← true on any fetch (including background refetches)
 *   error,
 *   refetch     ← manually trigger a fresh read
 * }
 *
 * @example
 * // Basic read
 * const { data: totalRecords } = useContractRead({
 *   address: contractAddress,
 *   abi: myAbi,
 *   functionName: 'totalRecords',
 *   chain: polygonAmoy,
 *   rpcUrl: import.meta.env.VITE_RPC_URL,
 * })
 *
 * // User-specific read (msg.sender-based mapping)
 * const { data: myRecords } = useContractRead({
 *   address: contractAddress,
 *   abi: myAbi,
 *   functionName: 'getRecordsBySubmitter',
 *   args: [smartAccountAddress],
 *   account: smartAccountAddress,
 *   chain: polygonAmoy,
 *   rpcUrl: import.meta.env.VITE_RPC_URL,
 *   refetchInterval: 10_000,  // refetch every 10 seconds
 * })
 */
export function useContractRead({
  address,
  abi,
  functionName,
  args = [],
  account,
  chain,
  rpcUrl,
  refetchInterval = 0,
  enabled = true,
}) {
  const [data, setData]           = useState(undefined)
  const [isLoading, setIsLoading] = useState(true)    // true on the initial fetch only
  const [isFetching, setIsFetching] = useState(false) // true on any fetch
  const [error, setError]         = useState(null)

  // Stable ref for the interval so we can clear it on unmount/change
  const intervalRef = useRef(null)

  const fetchData = useCallback(async (isInitial = false) => {
    if (!enabled || !address || !abi || !functionName || !chain || !rpcUrl) return

    if (isInitial) setIsLoading(true)
    setIsFetching(true)
    setError(null)

    try {
      const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
      })

      const result = await publicClient.readContract({
        address,
        abi,
        functionName,
        args,
        ...(account ? { account } : {}),
      })

      setData(result)
    } catch (err) {
      console.error('[erc4337-kit] useContractRead failed:', err)
      setError(err.message || 'Failed to read contract')
    } finally {
      if (isInitial) setIsLoading(false)
      setIsFetching(false)
    }
  }, [address, abi, functionName, JSON.stringify(args), account, chain, rpcUrl, enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  // Initial fetch + refetch interval setup
  useEffect(() => {
    fetchData(true)

    if (refetchInterval > 0) {
      intervalRef.current = setInterval(() => fetchData(false), refetchInterval)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchData, refetchInterval])

  return {
    data,
    isLoading,
    isFetching,
    error,
    refetch: () => fetchData(false),
  }
}

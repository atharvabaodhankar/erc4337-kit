import { useState, useEffect, useCallback } from 'react'
import { createPublicClient, http, formatUnits } from 'viem'
import { useERC4337 } from '../providers/ChainProvider.jsx'

// Minimal ERC20 ABI — only the functions we need
const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
]

/**
 * useTokenBalance
 *
 * Returns the ERC20 token balance for a Smart Account address.
 * Automatically fetches token symbol, decimals, and name from the contract.
 *
 * @param {object} params
 * @param {string} params.tokenAddress — ERC20 token contract address
 * @param {string} params.address      — Smart Account address (from useSmartAccount().smartAccountAddress)
 * @param {object} params.chain        — viem chain object
 * @param {string} params.rpcUrl       — your RPC URL
 *
 * @returns {object} {
 *   formatted,  ← human-readable balance string e.g. "100.5"
 *   raw,        ← raw balance as BigInt
 *   symbol,     ← token symbol e.g. "USDC"
 *   decimals,   ← token decimals e.g. 6
 *   name,       ← token name e.g. "USD Coin"
 *   isLoading,
 *   error,
 *   refetch
 * }
 *
 * @example
 * const { smartAccountAddress } = useSmartAccount({ ... })
 * const usdc = useTokenBalance({
 *   tokenAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // USDC on Polygon
 *   address: smartAccountAddress,
 *   chain: polygon,
 *   rpcUrl: import.meta.env.VITE_RPC_URL
 * })
 *
 * // Display: "100.5 USDC"
 */
export function useTokenBalance(params = {}) {
  const context = useERC4337()
  const isLegacyStyle = typeof params === 'string'

  const tokenAddress = isLegacyStyle ? params : params?.tokenAddress
  const address = isLegacyStyle ? context?.smartAccount?.smartAccountAddress : (params?.address ?? context?.smartAccount?.smartAccountAddress)
  const chain = isLegacyStyle ? context?.chain : (params?.chain ?? context?.chain)
  const rpcUrl = isLegacyStyle ? context?.rpcUrl : (params?.rpcUrl ?? context?.rpcUrl)

  const [raw, setRaw]             = useState(null)
  const [formatted, setFormatted] = useState(null)
  const [symbol, setSymbol]       = useState(null)
  const [decimals, setDecimals]   = useState(null)
  const [name, setName]           = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]         = useState(null)

  const fetchTokenBalance = useCallback(async () => {
    if (!tokenAddress || !address || !chain || !rpcUrl) return

    setIsLoading(true)
    setError(null)

    try {
      const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
      })

      // Batch all read calls for efficiency
      const [balance, tokenDecimals, tokenSymbol, tokenName] = await Promise.all([
        publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address],
        }),
        publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'decimals',
        }),
        publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'symbol',
        }),
        publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'name',
        }).catch(() => null), // name() is optional — not all tokens implement it
      ])

      setRaw(balance)
      setDecimals(tokenDecimals)
      setSymbol(tokenSymbol)
      setName(tokenName)
      setFormatted(trimDecimals(formatUnits(balance, tokenDecimals), 6))

    } catch (err) {
      console.error('[erc4337-kit] useTokenBalance fetch failed:', err)
      setError(err.message || 'Failed to fetch token balance')
    } finally {
      setIsLoading(false)
    }
  }, [tokenAddress, address, chain, rpcUrl])

  useEffect(() => {
    fetchTokenBalance()
  }, [fetchTokenBalance])

  return {
    formatted,
    raw,
    symbol,
    decimals,
    name,
    isLoading,
    error,
    refetch: fetchTokenBalance,
  }
}

// -----------------------------------------------------------------
// Internal: trim a decimal string to N decimal places
// -----------------------------------------------------------------
function trimDecimals(value, maxDecimals) {
  const [integer, fraction = ''] = value.split('.')
  if (!fraction) return integer
  return `${integer}.${fraction.slice(0, maxDecimals)}`
}

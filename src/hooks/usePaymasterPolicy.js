import { useState, useCallback, useRef } from 'react'
import { encodeFunctionData } from 'viem'
import { useERC4337 } from '../providers/ChainProvider.jsx'
import { parseAAError } from '../utils/errors.js'

// localStorage key for daily usage tracking
const USAGE_KEY = (address) => `erc4337kit:policy:${address?.toLowerCase()}`

// -----------------------------------------------------------------
// createPaymasterPolicy (utility — not a hook)
// -----------------------------------------------------------------

/**
 * createPaymasterPolicy
 *
 * Creates a client-side paymaster policy object that enforces
 * spending limits, contract allowlists, and per-tx gas caps
 * BEFORE sending to the bundler.
 *
 * This is a client-side guard layer. It does NOT replace server-side
 * Pimlico paymaster policies (which you configure in your Pimlico dashboard)
 * but it catches violations early, saving unnecessary bundler round-trips
 * and providing user-facing error messages.
 *
 * @param {object} options
 * @param {number}   [options.dailyLimitUSD]       — max USD value of gas to sponsor per day (approximate)
 * @param {string[]} [options.allowedContracts]    — whitelist of contract addresses (lowercase); empty = allow all
 * @param {bigint}   [options.maxGasPerTx]         — max gas units per single transaction
 * @param {number}   [options.maxTxPerDay]         — max number of transactions per day
 *
 * @returns {object} policy — pass this to usePaymasterPolicy()
 *
 * @example
 * import { createPaymasterPolicy } from 'erc4337-kit'
 *
 * const policy = createPaymasterPolicy({
 *   dailyLimitUSD: 5,
 *   allowedContracts: [
 *     '0x1234...contractA',
 *     '0xabcd...contractB',
 *   ],
 *   maxGasPerTx:  500_000n,
 *   maxTxPerDay:  20,
 * })
 */
export function createPaymasterPolicy({
  dailyLimitUSD = Infinity,
  allowedContracts = [],    // empty = allow all
  maxGasPerTx = null,       // null = no limit
  maxTxPerDay = Infinity,
} = {}) {
  return {
    dailyLimitUSD,
    allowedContracts: allowedContracts.map(a => a.toLowerCase()),
    maxGasPerTx: maxGasPerTx ? BigInt(maxGasPerTx) : null,
    maxTxPerDay,
  }
}

// -----------------------------------------------------------------
// usePaymasterPolicy (hook)
// -----------------------------------------------------------------

/**
 * usePaymasterPolicy
 *
 * Wraps smartAccountClient with policy enforcement.
 * Provides a `send()` function that checks your policy rules
 * before submitting any transaction to the bundler.
 *
 * Daily usage is tracked in localStorage and resets at midnight UTC.
 *
 * @param {object} params
 * @param {object} params.smartAccountClient   — from useSmartAccount() or useWallet()
 * @param {string} params.smartAccountAddress  — from useSmartAccount() or useWallet()
 * @param {object} params.policy               — from createPaymasterPolicy()
 * @param {number} [params.gasUsdPrice]        — approximate gas token price in USD (for dailyLimitUSD check)
 *                                               e.g. 0.7 for MATIC at $0.70. Default: 1.0
 *
 * @returns {object} {
 *   send({ to, abi, functionName, args, value, data }),
 *   pending,
 *   confirmed,
 *   failed,
 *   txHash,
 *   receipt,
 *   error,
 *   reset,
 *   usage: {       ← today's usage stats
 *     txCount,
 *     estimatedUSD,
 *   },
 *   resetUsage,    ← manually reset daily counter
 * }
 *
 * @example
 * const policy = createPaymasterPolicy({
 *   dailyLimitUSD: 5,
 *   maxTxPerDay: 20,
 *   allowedContracts: [contractAddress],
 * })
 *
 * const { send, pending, confirmed, error } = usePaymasterPolicy({
 *   smartAccountClient,
 *   smartAccountAddress,
 *   policy,
 *   gasUsdPrice: 0.7,  // MATIC price
 * })
 *
 * await send({
 *   to: contractAddress,
 *   abi: myAbi,
 *   functionName: 'storeRecord',
 *   args: [dataHash],
 * })
 *
 * // If over daily limit:
 * // error = "Daily transaction limit reached (20/20). Resets at midnight UTC."
 */
export function usePaymasterPolicy(params = {}) {
  const context = useERC4337()
  const smartAccountClient = params?.smartAccountClient ?? context?.smartAccount?.smartAccountClient
  const smartAccountAddress = params?.smartAccountAddress ?? context?.smartAccount?.smartAccountAddress
  const policy = params?.policy
  const gasUsdPrice = params?.gasUsdPrice ?? 1.0

  const storageKey = USAGE_KEY(smartAccountAddress)

  const [pending, setPending]     = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [failed, setFailed]       = useState(false)
  const [txHash, setTxHash]       = useState(null)
  const [receipt, setReceipt]     = useState(null)
  const [error, setError]         = useState(null)

  // -----------------------------------------------------------------
  // Daily usage tracking
  // -----------------------------------------------------------------

  function getTodayKey() {
    // UTC date string — resets at midnight UTC
    return new Date().toISOString().slice(0, 10) // e.g. "2024-01-15"
  }

  function loadUsage() {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return { date: getTodayKey(), txCount: 0, gasWeiTotal: '0' }
      const stored = JSON.parse(raw)
      // If stored date is old, reset
      if (stored.date !== getTodayKey()) {
        return { date: getTodayKey(), txCount: 0, gasWeiTotal: '0' }
      }
      return stored
    } catch {
      return { date: getTodayKey(), txCount: 0, gasWeiTotal: '0' }
    }
  }

  function saveUsage(usage) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(usage))
    } catch { /* ignore */ }
  }

  function incrementUsage(gasWei = 0n) {
    const usage = loadUsage()
    const updated = {
      date: getTodayKey(),
      txCount: usage.txCount + 1,
      gasWeiTotal: (BigInt(usage.gasWeiTotal || '0') + gasWei).toString(),
    }
    saveUsage(updated)
    return updated
  }

  const resetUsage = useCallback(() => {
    try { localStorage.removeItem(storageKey) } catch { /* ignore */ }
  }, [storageKey])

  // Get current usage for display
  const rawUsage = loadUsage()
  const usedGasWei = BigInt(rawUsage.gasWeiTotal || '0')
  // Approximate USD: gasWei is in wei, divide by 1e18 to get tokens, multiply by price
  const estimatedUSD = parseFloat((Number(usedGasWei) / 1e18 * gasUsdPrice).toFixed(4))
  const usage = {
    txCount: rawUsage.txCount,
    estimatedUSD,
  }

  // -----------------------------------------------------------------
  // Policy check — runs before sending
  // -----------------------------------------------------------------
  function checkPolicy(to) {
    if (!policy) return null

    const current = loadUsage()

    // Check tx count limit
    if (policy.maxTxPerDay !== Infinity && current.txCount >= policy.maxTxPerDay) {
      return `Daily transaction limit reached (${current.txCount}/${policy.maxTxPerDay}). Resets at midnight UTC.`
    }

    // Check daily USD limit (approximate)
    if (policy.dailyLimitUSD !== Infinity) {
      const usedWei = BigInt(current.gasWeiTotal || '0')
      const usedUSD = Number(usedWei) / 1e18 * gasUsdPrice
      if (usedUSD >= policy.dailyLimitUSD) {
        return `Daily spending limit reached ($${usedUSD.toFixed(2)} / $${policy.dailyLimitUSD}). Resets at midnight UTC.`
      }
    }

    // Check contract allowlist
    if (policy.allowedContracts.length > 0 && to) {
      if (!policy.allowedContracts.includes(to.toLowerCase())) {
        return `Transaction target ${to} is not in the allowed contracts list.`
      }
    }

    return null // all checks passed
  }

  // -----------------------------------------------------------------
  // send()
  // -----------------------------------------------------------------
  const send = useCallback(
    async ({ to, abi, functionName, args = [], value = 0n, data }) => {
      if (!smartAccountClient) {
        setError('Smart account not initialized. Make sure user is logged in.')
        setFailed(true)
        return null
      }

      // Policy check before touching the bundler
      const policyError = checkPolicy(to)
      if (policyError) {
        setError(policyError)
        setFailed(true)
        return null
      }

      // Reset state
      setPending(true)
      setConfirmed(false)
      setFailed(false)
      setError(null)
      setTxHash(null)
      setReceipt(null)

      try {
        let calldata = data ?? '0x'
        if (!data && abi && functionName) {
          calldata = encodeFunctionData({ abi, functionName, args })
        }

        // Check maxGasPerTx via gas estimation if policy has a limit
        if (policy?.maxGasPerTx) {
          try {
            const gasEstimate = await smartAccountClient.estimateGas({
              to, data: calldata, value,
            })
            if (BigInt(gasEstimate) > policy.maxGasPerTx) {
              throw new Error(
                `Transaction exceeds max gas limit: estimated ${gasEstimate}, max ${policy.maxGasPerTx}`
              )
            }
          } catch (estimateErr) {
            if (estimateErr.message?.includes('exceeds max gas')) throw estimateErr
            // If estimation itself fails for other reasons, proceed (bundler will catch it)
          }
        }

        const hash = await smartAccountClient.sendTransaction({
          to, data: calldata, value,
        })

        setTxHash(hash)

        const txReceipt = await smartAccountClient.waitForTransactionReceipt({ hash })

        if (txReceipt.status === 'reverted') {
          setFailed(true)
          setError('Transaction was reverted on-chain.')
          setReceipt(txReceipt)
          return null
        }

        // Record gas used for daily tracking
        let gasWeiUsed = 0n
        try {
          if (txReceipt.gasUsed && txReceipt.effectiveGasPrice) {
            gasWeiUsed = BigInt(txReceipt.gasUsed) * BigInt(txReceipt.effectiveGasPrice)
          }
        } catch { /* ignore */ }
        incrementUsage(gasWeiUsed)

        setReceipt(txReceipt)
        setConfirmed(true)

        return hash

      } catch (err) {
        const structured = parseAAError(err)
        setError(structured.message)
        setFailed(true)
        console.error('[erc4337-kit] usePaymasterPolicy.send failed:', err)
        return null
      } finally {
        setPending(false)
      }
    },
    [smartAccountClient, policy, gasUsdPrice] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const reset = useCallback(() => {
    setPending(false)
    setConfirmed(false)
    setFailed(false)
    setTxHash(null)
    setReceipt(null)
    setError(null)
  }, [])

  return {
    send,
    pending,
    confirmed,
    failed,
    txHash,
    receipt,
    error,
    reset,
    usage,
    resetUsage,
  }
}

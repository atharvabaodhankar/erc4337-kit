import { useState, useCallback, useEffect, useRef } from 'react'

// localStorage key prefix — scoped per smart account address
const STORAGE_KEY = (address) => `erc4337kit:analytics:${address?.toLowerCase()}`

/**
 * Default analytics state — matches the shape stored in localStorage
 */
function defaultState() {
  return {
    txCount:              0,   // total transactions attempted
    confirmedCount:       0,   // successfully mined
    failedCount:          0,   // reverted or rejected
    totalGasSponsoredWei: '0', // stored as string (BigInt serialization)
    confirmationTimesMs:  [],  // array of milliseconds per confirmed tx
  }
}

/**
 * useAAAnalytics
 *
 * Tracks ERC-4337 transaction analytics for a smart account.
 * Data is persisted in localStorage keyed by smart account address,
 * so stats survive page refreshes and accumulate over time.
 *
 * @param {object} params
 * @param {string} params.smartAccountAddress — from useSmartAccount() or useWallet()
 *
 * @returns {object} {
 *   txCount,                ← total txs attempted
 *   confirmedCount,         ← successfully mined
 *   failedCount,            ← reverted or rejected
 *   successRate,            ← 0–1 (e.g. 0.95 = 95%)
 *   totalGasSponsoredWei,   ← BigInt total gas sponsored
 *   averageConfirmationMs,  ← average confirmation time in ms
 *
 *   // Call these from your tx flow to record events:
 *   recordPending(),        ← call when tx is submitted
 *   recordConfirmed(receipt, startedAt),  ← call when tx is mined
 *   recordFailed(),         ← call when tx fails
 *   reset(),                ← clear all stored analytics
 * }
 *
 * @example
 * const analytics = useAAAnalytics({ smartAccountAddress })
 * const tx = useTransaction({ smartAccountClient })
 *
 * const handleSend = async () => {
 *   const startedAt = Date.now()
 *   analytics.recordPending()
 *   const hash = await tx.send({ to, abi, functionName, args })
 *   if (tx.confirmed) analytics.recordConfirmed(tx.receipt, startedAt)
 *   if (tx.failed)    analytics.recordFailed()
 * }
 *
 * // Display
 * <p>Transactions: {analytics.txCount}</p>
 * <p>Success rate: {(analytics.successRate * 100).toFixed(1)}%</p>
 * <p>Avg confirmation: {(analytics.averageConfirmationMs / 1000).toFixed(1)}s</p>
 */
export function useAAAnalytics({ smartAccountAddress }) {
  const storageKey = STORAGE_KEY(smartAccountAddress)

  // Load initial state from localStorage
  const [state, setState] = useState(() => {
    if (!smartAccountAddress) return defaultState()
    try {
      const stored = localStorage.getItem(storageKey)
      return stored ? JSON.parse(stored) : defaultState()
    } catch {
      return defaultState()
    }
  })

  // When smartAccountAddress changes, reload from localStorage
  useEffect(() => {
    if (!smartAccountAddress) {
      setState(defaultState())
      return
    }
    try {
      const stored = localStorage.getItem(storageKey)
      setState(stored ? JSON.parse(stored) : defaultState())
    } catch {
      setState(defaultState())
    }
  }, [smartAccountAddress, storageKey])

  // Persist to localStorage on every state change
  const persistRef = useRef(state)
  useEffect(() => {
    if (!smartAccountAddress) return
    persistRef.current = state
    try {
      localStorage.setItem(storageKey, JSON.stringify(state))
    } catch {
      // localStorage may be full or disabled — fail silently
    }
  }, [state, storageKey, smartAccountAddress])

  // -----------------------------------------------------------------
  // Recording helpers — call these from your transaction flow
  // -----------------------------------------------------------------

  /** Call when a UserOp is submitted to the bundler */
  const recordPending = useCallback(() => {
    setState(prev => ({ ...prev, txCount: prev.txCount + 1 }))
  }, [])

  /**
   * Call when a tx is confirmed on-chain
   * @param {object} [receipt]   — TransactionReceipt from waitForTransactionReceipt
   * @param {number} [startedAt] — Date.now() value from when you called send()
   */
  const recordConfirmed = useCallback((receipt, startedAt) => {
    setState(prev => {
      // Calculate gas sponsored from gasUsed × effectiveGasPrice in receipt
      let additionalWei = 0n
      try {
        if (receipt?.gasUsed && receipt?.effectiveGasPrice) {
          additionalWei = BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice)
        }
      } catch { /* ignore BigInt conversion errors */ }

      const prevWei = BigInt(prev.totalGasSponsoredWei || '0')
      const newWei = (prevWei + additionalWei).toString()

      // Record confirmation time if startedAt was provided
      const newTimes = [...prev.confirmationTimesMs]
      if (startedAt && typeof startedAt === 'number') {
        newTimes.push(Date.now() - startedAt)
        // Keep only last 100 times to bound array growth
        if (newTimes.length > 100) newTimes.shift()
      }

      return {
        ...prev,
        confirmedCount: prev.confirmedCount + 1,
        totalGasSponsoredWei: newWei,
        confirmationTimesMs: newTimes,
      }
    })
  }, [])

  /** Call when a tx fails (reverted, rejected, or errored) */
  const recordFailed = useCallback(() => {
    setState(prev => ({ ...prev, failedCount: prev.failedCount + 1 }))
  }, [])

  /** Clear all analytics for this account */
  const reset = useCallback(() => {
    const fresh = defaultState()
    setState(fresh)
    if (smartAccountAddress) {
      try {
        localStorage.removeItem(storageKey)
      } catch { /* ignore */ }
    }
  }, [smartAccountAddress, storageKey])

  // -----------------------------------------------------------------
  // Derived values
  // -----------------------------------------------------------------
  const { txCount, confirmedCount, failedCount, totalGasSponsoredWei, confirmationTimesMs } = state

  const successRate = txCount > 0 ? confirmedCount / txCount : 0

  const averageConfirmationMs = confirmationTimesMs.length > 0
    ? Math.round(confirmationTimesMs.reduce((a, b) => a + b, 0) / confirmationTimesMs.length)
    : 0

  let totalGasSponsoredWeiBig = 0n
  try {
    totalGasSponsoredWeiBig = BigInt(totalGasSponsoredWei || '0')
  } catch { /* ignore */ }

  return {
    // Metrics
    txCount,
    confirmedCount,
    failedCount,
    successRate,
    totalGasSponsoredWei: totalGasSponsoredWeiBig,
    averageConfirmationMs,

    // Recording actions
    recordPending,
    recordConfirmed,
    recordFailed,
    reset,
  }
}

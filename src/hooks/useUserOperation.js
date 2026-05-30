import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * useUserOperation
 *
 * Monitors an ERC-4337 UserOperation by its hash.
 * Polls the bundler (via pimlicoClient) until the UserOp is
 * confirmed or the timeout is reached.
 *
 * Use this when you need visibility into a UserOp that was submitted
 * elsewhere (e.g. by an AI agent, background process, or external signer).
 * For standard transaction flows, the `pending/confirmed/failed` states
 * from `useTransaction` are sufficient.
 *
 * @param {object} params
 * @param {string}  params.userOpHash     — the UserOperation hash to monitor
 * @param {object}  params.pimlicoClient  — from useSmartAccount() or useWallet()
 * @param {number}  [params.pollInterval] — polling interval in ms (default 2000)
 * @param {number}  [params.timeout]      — give up after N ms (default 120_000 = 2 min)
 *
 * @returns {object} {
 *   status,     ← 'pending' | 'confirmed' | 'failed' | 'timeout' | 'idle'
 *   receipt,    ← UserOperationReceipt once confirmed
 *   txHash,     ← on-chain tx hash (from receipt)
 *   error,
 *   startPolling(),   ← manually start polling (called automatically if userOpHash is provided)
 *   stopPolling(),    ← manually stop polling
 *   reset()           ← clear state
 * }
 *
 * @example
 * // Monitor a known UserOp hash (e.g. from an AI agent)
 * const { status, txHash, receipt } = useUserOperation({
 *   userOpHash: '0xabc...',
 *   pimlicoClient,
 * })
 *
 * // Display status
 * <p>UserOp status: {status}</p>
 * {status === 'confirmed' && <p>Tx: {txHash}</p>}
 * {status === 'timeout'   && <p>Still pending after 2 minutes</p>}
 */
export function useUserOperation({
  userOpHash,
  pimlicoClient,
  pollInterval = 2_000,
  timeout = 120_000,
}) {
  const [status, setStatus]   = useState('idle')
  const [receipt, setReceipt] = useState(null)
  const [txHash, setTxHash]   = useState(null)
  const [error, setError]     = useState(null)

  // Refs for interval + timeout cleanup
  const intervalRef = useRef(null)
  const timeoutRef  = useRef(null)
  const isPolling   = useRef(false)

  const stopPolling = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (timeoutRef.current)  { clearTimeout(timeoutRef.current);   timeoutRef.current = null  }
    isPolling.current = false
  }, [])

  const reset = useCallback(() => {
    stopPolling()
    setStatus('idle')
    setReceipt(null)
    setTxHash(null)
    setError(null)
  }, [stopPolling])

  const startPolling = useCallback(() => {
    if (!userOpHash || !pimlicoClient || isPolling.current) return
    isPolling.current = true
    setStatus('pending')

    // Set global timeout — give up if not confirmed within `timeout` ms
    timeoutRef.current = setTimeout(() => {
      if (isPolling.current) {
        stopPolling()
        setStatus('timeout')
      }
    }, timeout)

    // Poll on interval
    intervalRef.current = setInterval(async () => {
      try {
        // getUserOperationReceipt returns null while pending,
        // returns the receipt object once the UserOp is mined
        const opReceipt = await pimlicoClient.getUserOperationReceipt({ hash: userOpHash })

        if (opReceipt) {
          stopPolling()

          if (opReceipt.success) {
            setReceipt(opReceipt)
            setTxHash(opReceipt.receipt?.transactionHash ?? null)
            setStatus('confirmed')
          } else {
            // UserOp was reverted on-chain
            setReceipt(opReceipt)
            setError('UserOperation was reverted on-chain.')
            setStatus('failed')
          }
        }
        // null receipt = still pending, keep polling
      } catch (err) {
        // Network errors during polling are transient — log but keep polling
        console.warn('[erc4337-kit] useUserOperation poll error:', err.message)
      }
    }, pollInterval)

  }, [userOpHash, pimlicoClient, pollInterval, timeout, stopPolling])

  // Auto-start polling when userOpHash is provided
  useEffect(() => {
    if (userOpHash && pimlicoClient) {
      reset()
      // Small delay so reset() state is flushed before we start
      const startId = setTimeout(() => startPolling(), 50)
      return () => { clearTimeout(startId); stopPolling() }
    }
  }, [userOpHash, pimlicoClient]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), [stopPolling])

  return {
    status,
    receipt,
    txHash,
    error,
    startPolling,
    stopPolling,
    reset,
  }
}

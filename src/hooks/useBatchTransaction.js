import { useState, useCallback } from 'react'
import { encodeFunctionData } from 'viem'
import { useERC4337 } from '../providers/ChainProvider.jsx'
import { parseAAError } from '../utils/errors.js'

/**
 * useBatchTransaction
 *
 * Sends multiple contract calls in a SINGLE ERC-4337 UserOperation.
 * This is one of the core advantages of smart accounts — atomic multi-call
 * with a single signature, single gas payment, and single bundler submission.
 *
 * @param {object} params
 * @param {object} params.smartAccountClient  — from useSmartAccount()
 *
 * @returns {object} {
 *   send(txArray),  ← send an array of transactions as one UserOp
 *   pending,
 *   confirmed,
 *   failed,
 *   txHash,
 *   receipt,
 *   error,
 *   reset
 * }
 *
 * @example
 * const batch = useBatchTransaction({ smartAccountClient })
 *
 * await batch.send([
 *   {
 *     to: contractA,
 *     abi: abiA,
 *     functionName: 'approve',
 *     args: [spender, amount]
 *   },
 *   {
 *     to: contractB,
 *     abi: abiB,
 *     functionName: 'deposit',
 *     args: [amount]
 *   }
 * ])
 *
 * // Both calls go in a single UserOperation — one signature, one gas sponsorship
 */
export function useBatchTransaction(params = {}) {
  const context = useERC4337()
  const smartAccountClient = params?.smartAccountClient ?? context?.smartAccount?.smartAccountClient

  const [pending, setPending]       = useState(false)
  const [confirmed, setConfirmed]   = useState(false)
  const [failed, setFailed]         = useState(false)
  const [txHash, setTxHash]         = useState(null)
  const [receipt, setReceipt]       = useState(null)
  const [error, setError]           = useState(null)

  /**
   * send
   *
   * @param {Array<object>} transactions — array of tx objects:
   *   {
   *     to:           string    — target contract address
   *     abi?:         array     — contract ABI (if calling a function)
   *     functionName?: string   — function to call
   *     args?:        array     — function arguments (default [])
   *     value?:       bigint    — native token value (default 0n)
   *     data?:        string    — raw calldata (alternative to abi/functionName/args)
   *   }
   *
   * @returns {string|null} txHash on success, null on failure
   */
  const send = useCallback(
    async (transactions = []) => {
      if (!smartAccountClient) {
        setError('Smart account not initialized. Make sure user is logged in.')
        setFailed(true)
        return null
      }

      if (!transactions.length) {
        setError('No transactions provided to batch.')
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
        // Build calldata for each transaction
        const calls = transactions.map(({ to, abi, functionName, args = [], value = 0n, data }) => {
          let calldata = data ?? '0x'
          if (!data && abi && functionName) {
            calldata = encodeFunctionData({ abi, functionName, args })
          }
          return { to, data: calldata, value }
        })

        // sendCalls is the ERC-4337 batch method on SmartAccountClient.
        // It packs all calls into a single UserOperation using the smart
        // account's executeBatch (or equivalent) entry point function.
        // One signature. One gas estimate. One bundler submission.
        const hash = await smartAccountClient.sendUserOperation({
          calls,
        })

        setTxHash(hash)

        // Wait for on-chain confirmation
        const txReceipt = await smartAccountClient.waitForTransactionReceipt({ hash })

        if (txReceipt.status === 'reverted') {
          setFailed(true)
          setError('Batch transaction was reverted on-chain.')
          setReceipt(txReceipt)
          return null
        }

        setReceipt(txReceipt)
        setConfirmed(true)

        return hash

      } catch (err) {
        const structured = parseAAError(err)
        setError(structured.message)
        setFailed(true)
        console.error('[erc4337-kit] useBatchTransaction failed:', err)
        return null
      } finally {
        setPending(false)
      }
    },
    [smartAccountClient]
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
  }
}

import { useState, useCallback } from 'react'
import { encodeFunctionData } from 'viem'

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
export function useBatchTransaction({ smartAccountClient }) {
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
        const message = parseBatchError(err)
        setError(message)
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

// -----------------------------------------------------------------
// Internal: parse common batch + ERC-4337 errors into human messages
// -----------------------------------------------------------------
function parseBatchError(err) {
  const msg = err?.message || err?.toString() || 'Unknown error'

  if (msg.includes('AA21')) {
    return 'Paymaster rejected: your Pimlico API key may be invalid or the policy does not cover this chain.'
  }
  if (msg.includes('AA31')) {
    return 'Paymaster out of funds. Check your Pimlico dashboard deposit balance.'
  }
  if (msg.includes('AA23') || msg.includes('invalid signature')) {
    return 'Wallet signature failed. Try logging out and back in.'
  }
  if (msg.includes('gas') && msg.includes('too low')) {
    return 'Gas estimate too low. The batch may be too large for the paymaster policy — try splitting into smaller batches.'
  }
  if (msg.includes('nonce')) {
    return 'Nonce error. A previous transaction may still be pending — wait a moment and retry.'
  }
  if (msg.includes('user rejected') || msg.includes('User rejected')) {
    return 'Transaction batch was cancelled.'
  }
  if (msg.includes('fetch') || msg.includes('network')) {
    return 'Network error. Check your RPC URL and Pimlico API key.'
  }
  if (msg.includes('executeBatch') || msg.includes('multicall')) {
    return 'Batch execution failed. One of the calls in the batch may have reverted — check your arguments.'
  }

  return msg
}

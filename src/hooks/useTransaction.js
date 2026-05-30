import { useState, useCallback } from 'react'
import { encodeFunctionData } from 'viem'

/**
 * useTransaction
 *
 * Unified hook for sending gasless ERC-4337 transactions.
 * Handles encoding, submission, confirmation, and error states
 * in a single clean API.
 *
 * @param {object} params
 * @param {object} params.smartAccountClient  — from useSmartAccount()
 *
 * @returns {object} {
 *   send(params),   ← call this to send a transaction
 *   pending,        ← true while UserOp is being submitted
 *   confirmed,      ← true once tx is mined
 *   failed,         ← true if tx reverted or was rejected
 *   txHash,
 *   receipt,
 *   error,
 *   reset
 * }
 *
 * @example
 * const tx = useTransaction({ smartAccountClient })
 *
 * // Simple ETH/native transfer
 * await tx.send({ to: '0x...', value: 1n })
 *
 * // Contract call
 * await tx.send({
 *   to: contractAddress,
 *   abi: myAbi,
 *   functionName: 'storeRecord',
 *   args: [dataHash]
 * })
 */
export function useTransaction({ smartAccountClient }) {
  const [pending, setPending]       = useState(false)
  const [confirmed, setConfirmed]   = useState(false)
  const [failed, setFailed]         = useState(false)
  const [txHash, setTxHash]         = useState(null)
  const [receipt, setReceipt]       = useState(null)
  const [error, setError]           = useState(null)

  /**
   * send
   *
   * @param {object} params
   * @param {string}   params.to           — target contract or wallet address
   * @param {array}    [params.abi]        — contract ABI (required if calling a function)
   * @param {string}   [params.functionName] — contract function name
   * @param {array}    [params.args]       — function arguments
   * @param {bigint}   [params.value]      — native token value in wei (default 0n)
   * @param {string}   [params.data]       — raw calldata (alternative to abi/functionName/args)
   *
   * @returns {string|null} txHash on success, null on failure
   */
  const send = useCallback(
    async ({ to, abi, functionName, args = [], value = 0n, data }) => {
      if (!smartAccountClient) {
        setError('Smart account not initialized. Make sure user is logged in.')
        setFailed(true)
        return null
      }

      // Reset state for new tx
      setPending(true)
      setConfirmed(false)
      setFailed(false)
      setError(null)
      setTxHash(null)
      setReceipt(null)

      try {
        // Build calldata: prefer explicit data, fallback to ABI encoding
        let calldata = data ?? '0x'
        if (!data && abi && functionName) {
          calldata = encodeFunctionData({ abi, functionName, args })
        }

        // Send via SmartAccountClient — this builds + sponsors + submits the UserOp
        const hash = await smartAccountClient.sendTransaction({
          to,
          data: calldata,
          value,
        })

        setTxHash(hash)

        // Wait for on-chain confirmation
        const txReceipt = await smartAccountClient.waitForTransactionReceipt({ hash })

        // Check if the tx was reverted on-chain
        if (txReceipt.status === 'reverted') {
          setFailed(true)
          setError('Transaction was reverted on-chain.')
          setReceipt(txReceipt)
          return null
        }

        setReceipt(txReceipt)
        setConfirmed(true)

        return hash

      } catch (err) {
        const message = parseTransactionError(err)
        setError(message)
        setFailed(true)
        console.error('[erc4337-kit] useTransaction failed:', err)
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
// Internal: parse ERC-4337 / Pimlico errors into human messages
// -----------------------------------------------------------------
function parseTransactionError(err) {
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
    return 'Gas estimate too low. The contract function may be too expensive for the paymaster policy.'
  }
  if (msg.includes('nonce')) {
    return 'Nonce error. A previous transaction may still be pending — wait a moment and retry.'
  }
  if (msg.includes('user rejected') || msg.includes('User rejected')) {
    return 'Transaction was cancelled.'
  }
  if (msg.includes('fetch') || msg.includes('network')) {
    return 'Network error. Check your RPC URL and Pimlico API key.'
  }
  if (msg.includes('reverted')) {
    return 'Transaction reverted. The contract rejected the call — check your arguments.'
  }

  return msg
}

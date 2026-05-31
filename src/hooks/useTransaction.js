import { useState, useCallback } from 'react'
import { encodeFunctionData } from 'viem'
import { useERC4337 } from '../providers/ChainProvider.jsx'
import { parseAAError } from '../utils/errors.js'

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
export function useTransaction(params = {}) {
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
        const structured = parseAAError(err)
        setError(structured.message)
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

import { useState, useCallback } from 'react'
import { encodeFunctionData } from 'viem'
import { useERC4337 } from '../providers/ChainProvider.jsx'
import { parseAAError } from '../utils/errors.js'

/**
 * useStoreOnChain
 *
 * Generic hook to call any write function on any contract
 * via ERC-4337 gasless UserOperation.
 *
 * @param {object} params
 * @param {object} params.smartAccountClient  — from useSmartAccount()
 * @param {string} params.contractAddress     — deployed contract address
 * @param {array}  params.abi                 — contract ABI (just the functions you need)
 * @param {string} params.functionName        — which function to call
 *
 * @returns {object} {
 *   submit(args),   ← call this with your function arguments as an array
 *   txHash,
 *   recordId,       ← decoded from logs if contract returns bytes32
 *   isLoading,
 *   isSuccess,
 *   error,
 *   reset
 * }
 *
 * @example
 * const { submit, txHash, isLoading } = useStoreOnChain({
 *   smartAccountClient,
 *   contractAddress: '0x...',
 *   abi: incidentABI,
 *   functionName: 'storeRecord',
 * })
 *
 * // In your handler:
 * await submit([dataHash])
 */
export function useStoreOnChain(params = {}) {
  const context = useERC4337()
  const smartAccountClient = params?.smartAccountClient ?? context?.smartAccount?.smartAccountClient
  const contractAddress = params?.contractAddress
  const abi = params?.abi
  const functionName = params?.functionName

  const [txHash, setTxHash] = useState(null)
  const [recordId, setRecordId] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState(null)

  const submit = useCallback(
    async (args = []) => {
      // Guard: smartAccountClient must exist (user must be logged in)
      if (!smartAccountClient) {
        setError('Smart account not initialized. Make sure user is logged in.')
        return null
      }

      setIsLoading(true)
      setIsSuccess(false)
      setError(null)
      setTxHash(null)
      setRecordId(null)

      try {
        // Encode contract function arguments into standard EVM calldata
        console.log('[erc4337-kit] 1. Encoding contract function calldata...')
        const calldata = encodeFunctionData({
          abi,
          functionName,
          args,
        })

        // Send gasless UserOperation via permissionless SmartAccountClient.
        // Handles gas fee estimation, paymaster sponsorship request,
        // EOA signature signing, and mempool bundler submission.
        console.log('[erc4337-kit] 2. Submitting sendTransaction to smartAccountClient (triggering gasless estimate & Privy signature)...')
        const hash = await smartAccountClient.sendTransaction({
          to: contractAddress,
          data: calldata,
          value: 0n,
        })

        console.log('[erc4337-kit] 3. sendTransaction completed! Tx Hash:', hash)
        setTxHash(hash)

        // Wait for on-chain block mining confirmation
        console.log('[erc4337-kit] 4. Awaiting on-chain transaction receipt...')
        const txReceipt = await smartAccountClient.waitForTransactionReceipt({
          hash,
        })

        console.log('[erc4337-kit] 5. Transaction confirmed on-chain! Status:', txReceipt.status)

        if (txReceipt.status === 'reverted') {
          throw new Error('Transaction reverted on-chain.')
        }

        setIsSuccess(true)

        // Attempt to decode bytes32 recordId from logs (if contract emitted it)
        try {
          if (txReceipt.logs && txReceipt.logs.length > 0) {
            const firstLog = txReceipt.logs[0]
            if (firstLog.topics && firstLog.topics.length > 1) {
              const decodedId = firstLog.topics[1]
              setRecordId(decodedId)
            }
          }
        } catch {
          // Log parsing failing is not a fatal error — tx already succeeded
        }

        return hash

      } catch (err) {
        const structured = parseAAError(err)
        setError(structured.message)
        console.error('[erc4337-kit] Transaction failed:', err)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [smartAccountClient, contractAddress, abi, functionName]
  )

  const reset = useCallback(() => {
    setTxHash(null)
    setRecordId(null)
    setIsLoading(false)
    setIsSuccess(false)
    setError(null)
  }, [])

  return {
    submit,
    txHash,
    recordId,
    isLoading,
    isSuccess,
    error,
    reset,
  }
}

// -----------------------------------------------------------------
// Internal: parse common ERC-4337 / Pimlico errors into human messages
// These are the exact errors you hit during ProofChain development
// -----------------------------------------------------------------
function parseError(err) {
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

  return msg
}

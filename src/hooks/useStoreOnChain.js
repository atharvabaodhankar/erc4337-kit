import { useState, useCallback } from 'react'
import { encodeFunctionData } from 'viem'

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
export function useStoreOnChain({
  smartAccountClient,
  contractAddress,
  abi,
  functionName,
}) {
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
        // encodeFunctionData turns your ABI + args into the raw calldata bytes
        // that the smart account will call on the target contract
        const calldata = encodeFunctionData({
          abi,
          functionName,
          args,
        })

        // sendTransaction on a SmartAccountClient works differently than a normal
        // wallet tx. Under the hood it:
        //   1. Builds a UserOperation
        //   2. Estimates gas (callGasLimit, verificationGasLimit, preVerificationGas)
        //   3. Calls your paymaster (Pimlico) for sponsorship
        //   4. Signs the UserOperation with the embedded wallet
        //   5. Sends it to the Pimlico bundler
        //   6. Returns the tx hash once the bundler accepts it
        //
        // The tx hash here is the ACTUAL on-chain tx hash, not the UserOp hash.
        const hash = await smartAccountClient.sendTransaction({
          to: contractAddress,
          data: calldata,
          value: 0n,  // no ETH/MATIC sent — this is just a contract call
        })

        setTxHash(hash)
        setIsSuccess(true)

        // Try to extract the returned bytes32 record ID from the receipt logs
        // This is specific to BaseStorage.sol which emits RecordStored(id, ...)
        try {
          const receipt = await smartAccountClient.waitForTransactionReceipt({ hash })
          const firstLog = receipt.logs?.[0]
          if (firstLog?.topics?.[1]) {
            setRecordId(firstLog.topics[1])
          }
        } catch {
          // Log parsing failing is not a fatal error — tx already succeeded
        }

        return hash

      } catch (err) {
        const message = parseError(err)
        setError(message)
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

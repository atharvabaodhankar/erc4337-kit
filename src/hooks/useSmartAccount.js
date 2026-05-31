import { useState, useCallback, useRef, useEffect } from 'react'
import { usePrivy, useWallets, useCreateWallet } from '@privy-io/react-auth'
import { createPublicClient, createWalletClient, http, custom } from 'viem'
import { createSmartAccountClient } from 'permissionless'
import { toSimpleSmartAccount } from 'permissionless/accounts'
import { createPimlicoClient } from 'permissionless/clients/pimlico'
import { entryPoint07Address, createPaymasterClient } from 'viem/account-abstraction'

// Internal helper — builds the Pimlico endpoint URL from chain ID
function buildPimlicoUrl(chainId, apiKey) {
  return `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${apiKey}`
}

/**
 * useSmartAccount
 *
 * Manages ERC-4337 Smart Account creation and lifecycle.
 * Handles Privy auth, embedded wallet creation, and Pimlico setup.
 *
 * @param {object} config
 * @param {string} config.pimlicoApiKey   — from dashboard.pimlico.io
 * @param {string} config.rpcUrl          — Alchemy/Infura RPC for your chain
 * @param {object} config.chain           — viem chain object (e.g. polygonAmoy)
 *
 * @returns {object} {
 *   login, logout, authenticated, user,
 *   smartAccountAddress,
 *   smartAccountClient,   ← use this to send transactions
 *   pimlicoClient,
 *   isReady,              ← true when SA is initialized and ready
 *   isLoading,
 *   error
 * }
 */
export function useSmartAccount({
  pimlicoApiKey = null,
  alchemyApiKey = null,
  biconomyApiKey = null,
  bundler = 'pimlico',
  paymaster = 'pimlico',
  bundlerUrl = null,
  paymasterUrl = null,
  rpcUrl,
  chain,
}) {
  const { login, logout, authenticated, user, ready } = usePrivy()
  const { wallets } = useWallets()
  const { createWallet } = useCreateWallet()

  const [smartAccountAddress, setSmartAccountAddress] = useState(null)
  const [smartAccountClient, setSmartAccountClient] = useState(null)
  const [pimlicoClient, setPimlicoClient] = useState(null)
  const [paymasterClient, setPaymasterClient] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // Refs to prevent duplicate initialization — same pattern as your ProofChain
  const initCalledRef = useRef(false)
  const walletCreationAttempted = useRef(false)

  // Memoize resolved URL components to prevent re-renders
  const resolvedBundlerUrl = useMemo(() => {
    if (bundlerUrl) return bundlerUrl
    if (bundler === 'pimlico') {
      if (!pimlicoApiKey) return null
      return `https://api.pimlico.io/v2/${chain?.id}/rpc?apikey=${pimlicoApiKey}`
    }
    if (bundler === 'alchemy') {
      return rpcUrl
    }
    return null
  }, [bundlerUrl, bundler, pimlicoApiKey, chain?.id, rpcUrl])

  const resolvedPaymasterUrl = useMemo(() => {
    if (paymasterUrl) return paymasterUrl
    if (paymaster === 'pimlico') {
      if (!pimlicoApiKey) return null
      return `https://api.pimlico.io/v2/${chain?.id}/rpc?apikey=${pimlicoApiKey}`
    }
    if (paymaster === 'alchemy') {
      return rpcUrl
    }
    return null
  }, [paymasterUrl, paymaster, pimlicoApiKey, chain?.id, rpcUrl])

  const initSmartAccount = useCallback(async () => {
    // Guard: only proceed when Privy is fully ready and user is logged in
    if (!authenticated || !ready || !chain || !rpcUrl) return

    // If no wallet yet, try to create one (Privy sometimes needs a nudge)
    if (!wallets || wallets.length === 0) {
      if (!walletCreationAttempted.current) {
        walletCreationAttempted.current = true
        try {
          await createWallet()
          // Don't continue here — wait for next effect run after wallet appears
          return
        } catch (err) {
          // 'already has' means the wallet exists but wasn't in state yet — safe to ignore
          if (!err.message?.includes('already has')) {
            setError('Failed to create embedded wallet: ' + err.message)
          }
          return
        }
      }
      return
    }

    // Guard: don't initialize twice
    if (initCalledRef.current) return
    initCalledRef.current = true

    setIsLoading(true)
    setError(null)

    try {
      const wallet = wallets[0]

      // Switch to the configured chain before doing anything
      await wallet.switchChain(chain.id)

      const provider = await wallet.getEthereumProvider()

      // Wallet client signs UserOperations using the embedded wallet
      const walletClient = createWalletClient({
        account: wallet.address,
        chain,
        transport: custom(provider),
      })

      // Public client reads from chain (balance, contract state, etc.)
      const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
      })

      // Setup bundler and paymaster based on option C
      if (!resolvedBundlerUrl) {
        throw new Error(`[erc4337-kit] Configuration error: bundler '${bundler}' requires a valid API key or bundlerUrl override`)
      }

      let paymasterObj = null
      let pimlicoInstance = null

      if (paymaster === 'pimlico') {
        if (!resolvedPaymasterUrl) {
          throw new Error('[erc4337-kit] Configuration error: Pimlico paymaster requires a valid pimlicoApiKey')
        }
        pimlicoInstance = createPimlicoClient({
          transport: http(resolvedPaymasterUrl),
          entryPoint: {
            address: entryPoint07Address,
            version: '0.7',
          },
        })
        paymasterObj = pimlicoInstance
      } else if (paymaster === 'alchemy') {
        if (!resolvedPaymasterUrl) {
          throw new Error('[erc4337-kit] Configuration error: Alchemy paymaster requires a valid RPC URL')
        }
        paymasterObj = createPaymasterClient({
          transport: http(resolvedPaymasterUrl),
        })
      }

      // SimpleSmartAccount: the simplest ERC-4337 account type
      // deterministic address — same owner always gets same SA address
      const smartAccount = await toSimpleSmartAccount({
        client: publicClient,
        owner: walletClient,
        entryPoint: {
          address: entryPoint07Address,
          version: '0.7',
        },
      })

      // SmartAccountClient: the object you use to send transactions
      // It automatically builds UserOperations, gets gas estimates,
      // requests paymaster sponsorship, and submits to the bundler
      const client = createSmartAccountClient({
        account: smartAccount,
        chain,
        bundlerTransport: http(resolvedBundlerUrl),
        ...(paymasterObj ? { paymaster: paymasterObj } : {}),
        // userOperation config: tell paymaster to sponsor everything
        userOperation: {
          estimateFeesPerGas: async () => {
            if (paymaster === 'pimlico' && pimlicoInstance) {
              const fees = await pimlicoInstance.getUserOperationGasPrice()
              return fees.fast
            } else {
              // Fallback to standard gas price estimation via public client
              const fees = await publicClient.estimateFeesPerGas()
              return fees
            }
          },
        },
      })

      setPimlicoClient(pimlicoInstance)
      setPaymasterClient(paymasterObj)
      setSmartAccountClient(client)
      setSmartAccountAddress(smartAccount.address)

    } catch (err) {
      console.error('[erc4337-kit] Smart account init failed:', err)
      setError(err.message || 'Failed to initialize smart account')
      // Reset so the user can retry
      initCalledRef.current = false
    } finally {
      setIsLoading(false)
    }
  }, [
    authenticated,
    wallets,
    ready,
    createWallet,
    chain,
    rpcUrl,
    bundler,
    paymaster,
    resolvedBundlerUrl,
    resolvedPaymasterUrl,
  ])

  useEffect(() => {
    initSmartAccount()
  }, [initSmartAccount])

  const handleLogout = useCallback(async () => {
    await logout()
    // Full reset so next login starts fresh
    initCalledRef.current = false
    walletCreationAttempted.current = false
    setSmartAccountAddress(null)
    setSmartAccountClient(null)
    setPimlicoClient(null)
    setPaymasterClient(null)
    setError(null)
  }, [logout])

  return {
    login,
    logout: handleLogout,
    authenticated,
    user,
    smartAccountAddress,
    smartAccountClient,
    pimlicoClient,
    paymasterClient,
    isReady: !!smartAccountClient && !!smartAccountAddress,
    isLoading,
    error,
  }
}

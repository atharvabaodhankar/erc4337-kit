import { useState, useCallback, useRef, useEffect } from 'react'
import { usePrivy, useWallets, useCreateWallet } from '@privy-io/react-auth'
import { createPublicClient, createWalletClient, http, custom } from 'viem'
import { createSmartAccountClient } from 'permissionless'
import { toSimpleSmartAccount } from 'permissionless/accounts'
import { createPimlicoClient } from 'permissionless/clients/pimlico'
import { entryPoint07Address } from 'viem/account-abstraction'

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
export function useSmartAccount({ pimlicoApiKey, rpcUrl, chain }) {
  const { login, logout, authenticated, user, ready } = usePrivy()
  const { wallets } = useWallets()
  const { createWallet } = useCreateWallet()

  const [smartAccountAddress, setSmartAccountAddress] = useState(null)
  const [smartAccountClient, setSmartAccountClient] = useState(null)
  const [pimlicoClient, setPimlicoClient] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // Refs to prevent duplicate initialization — same pattern as your ProofChain
  const initCalledRef = useRef(false)
  const walletCreationAttempted = useRef(false)

  const pimlicoUrl = buildPimlicoUrl(chain.id, pimlicoApiKey)

  const initSmartAccount = useCallback(async () => {
    // Guard: only proceed when Privy is fully ready and user is logged in
    if (!authenticated || !ready) return

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

      // Pimlico client handles bundling + gas sponsorship
      const pimlico = createPimlicoClient({
        transport: http(pimlicoUrl),
        entryPoint: {
          address: entryPoint07Address,
          version: '0.7',
        },
      })

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
        bundlerTransport: http(pimlicoUrl),
        paymaster: pimlico,
        // userOperation config: tell Pimlico to sponsor everything
        userOperation: {
          estimateFeesPerGas: async () => {
            const fees = await pimlico.getUserOperationGasPrice()
            return fees.fast
          },
        },
      })

      setPimlicoClient(pimlico)
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
  }, [authenticated, wallets, ready, createWallet, chain, rpcUrl, pimlicoUrl])

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
    isReady: !!smartAccountClient && !!smartAccountAddress,
    isLoading,
    error,
  }
}

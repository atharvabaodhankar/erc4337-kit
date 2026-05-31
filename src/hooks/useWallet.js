import { useMemo } from 'react'
import { useSmartAccount } from './useSmartAccount.js'
import { useBalance } from './useBalance.js'
import { useERC4337 } from '../providers/ChainProvider.jsx'

/**
 * useWallet
 *
 * Unified hook that combines auth, smart account, and native balance
 * into a single ergonomic API.
 *
 * This is the "one hook" mental model — instead of calling useSmartAccount
 * and useBalance separately and threading state between them, useWallet
 * gives you everything about the current user's wallet in one place.
 *
 * @param {object} config
 * @param {string} config.pimlicoApiKey  — from dashboard.pimlico.io
 * @param {string} config.rpcUrl         — Alchemy/Infura RPC for your chain
 * @param {object} config.chain          — viem chain object
 *
 * @returns {object} {
 *   // Auth
 *   login,
 *   logout,
 *   authenticated,
 *   user,
 *
 *   // Smart Account
 *   address,            ← smart account address (shorthand for smartAccountAddress)
 *   smartAccountAddress,
 *   smartAccountClient,
 *   pimlicoClient,
 *   isReady,
 *   isLoading,
 *   error,
 *
 *   // Chain
 *   chain,              ← the viem chain object you passed in
 *   chainId,            ← numeric chain ID
 *   chainName,          ← human-readable chain name
 *
 *   // Balance
 *   balance: {
 *     formatted,        ← e.g. "0.5"
 *     raw,              ← BigInt
 *     symbol,           ← e.g. "MATIC"
 *     isLoading,
 *     error,
 *     refetch,
 *   },
 *
 *   // EOA (embedded wallet — the owner of the smart account)
 *   owner,              ← EOA address that owns the smart account
 * }
 *
 * @example
 * const wallet = useWallet({
 *   pimlicoApiKey: import.meta.env.VITE_PIMLICO_API_KEY,
 *   rpcUrl:        import.meta.env.VITE_RPC_URL,
 *   chain:         polygonAmoy,
 * })
 *
 * // Auth
 * if (!wallet.authenticated) return <button onClick={wallet.login}>Sign in</button>
 *
 * // Display
 * <p>{wallet.address}</p>
 * <p>{wallet.balance.formatted} {wallet.balance.symbol}</p>
 * <p>Network: {wallet.chainName}</p>
 *
 * // Send a tx
 * await wallet.smartAccountClient.sendTransaction({ to, data, value: 0n })
 */
export function useWallet(config = {}) {
  const context = useERC4337()
  const hasConfig = Object.keys(config).length > 0

  // 1. Context-level Zero-Config execution
  if (context && !hasConfig) {
    const { smartAccount, balance, chain } = context

    const owner = useMemo(() => {
      if (!smartAccount.user) return null
      const embeddedWallet = smartAccount.user.linkedAccounts?.find(
        (a) => a.type === 'wallet' && a.walletClientType === 'privy'
      )
      return embeddedWallet?.address ?? null
    }, [smartAccount.user])

    return {
      // Auth
      login: smartAccount.login,
      logout: smartAccount.logout,
      authenticated: smartAccount.authenticated,
      user: smartAccount.user,

      // Smart Account
      address: smartAccount.smartAccountAddress,
      smartAccountAddress: smartAccount.smartAccountAddress,
      smartAccountClient: smartAccount.smartAccountClient,
      pimlicoClient: smartAccount.pimlicoClient,
      paymasterClient: smartAccount.paymasterClient,
      isReady: smartAccount.isReady,
      isLoading: smartAccount.isLoading,
      error: smartAccount.error,

      // Chain
      chain,
      chainId: chain?.id ?? null,
      chainName: chain?.name ?? null,

      // Balance
      balance,

      // EOA Owner
      owner,
    }
  }

  // 2. Direct calling configuration fallback (Backward Compatibility)
  const {
    pimlicoApiKey,
    alchemyApiKey,
    biconomyApiKey,
    bundler,
    paymaster,
    bundlerUrl,
    paymasterUrl,
    rpcUrl,
    chain,
  } = config

  const smartAccount = useSmartAccount({
    pimlicoApiKey,
    alchemyApiKey,
    biconomyApiKey,
    bundler,
    paymaster,
    bundlerUrl,
    paymasterUrl,
    rpcUrl,
    chain,
  })

  const balance = useBalance({
    address: smartAccount.smartAccountAddress,
    chain,
    rpcUrl,
  })

  const owner = useMemo(() => {
    if (!smartAccount.user) return null
    const embeddedWallet = smartAccount.user.linkedAccounts?.find(
      (a) => a.type === 'wallet' && a.walletClientType === 'privy'
    )
    return embeddedWallet?.address ?? null
  }, [smartAccount.user])

  return {
    // Auth
    login: smartAccount.login,
    logout: smartAccount.logout,
    authenticated: smartAccount.authenticated,
    user: smartAccount.user,

    // Smart Account
    address: smartAccount.smartAccountAddress,
    smartAccountAddress: smartAccount.smartAccountAddress,
    smartAccountClient: smartAccount.smartAccountClient,
    pimlicoClient: smartAccount.pimlicoClient,
    paymasterClient: smartAccount.paymasterClient,
    isReady: smartAccount.isReady,
    isLoading: smartAccount.isLoading,
    error: smartAccount.error,

    // Chain info
    chain,
    chainId: chain?.id ?? null,
    chainName: chain?.name ?? null,

    // Balance
    balance,

    // EOA owner
    owner,
  }
}

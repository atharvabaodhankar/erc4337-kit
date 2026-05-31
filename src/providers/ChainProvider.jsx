import React, { createContext, useContext } from 'react'
import { PrivyProvider } from '@privy-io/react-auth'
import { WagmiProvider, createConfig } from '@privy-io/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http } from 'viem'
import { useSmartAccount } from '../hooks/useSmartAccount.js'
import { useBalance } from '../hooks/useBalance.js'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
    },
  },
})

export const ERC4337Context = createContext(null)

/**
 * useERC4337
 *
 * Hook to consume the ERC-4337 configuration and global smart account context.
 * Returns null if used outside of <ChainProvider>.
 */
export function useERC4337() {
  const context = useContext(ERC4337Context)
  return context
}

function ERC4337ProviderInner({
  chain,
  rpcUrl,
  pimlicoApiKey,
  alchemyApiKey,
  biconomyApiKey,
  bundler,
  paymaster,
  bundlerUrl,
  paymasterUrl,
  children,
}) {
  const smartAccount = useSmartAccount({
    chain,
    rpcUrl,
    pimlicoApiKey,
    alchemyApiKey,
    biconomyApiKey,
    bundler,
    paymaster,
    bundlerUrl,
    paymasterUrl,
  })

  const balance = useBalance({
    address: smartAccount.smartAccountAddress,
    chain,
    rpcUrl,
  })

  const value = {
    chain,
    rpcUrl,
    pimlicoApiKey,
    alchemyApiKey,
    biconomyApiKey,
    bundler,
    paymaster,
    bundlerUrl,
    paymasterUrl,
    smartAccount,
    balance,
  }

  return (
    <ERC4337Context.Provider value={value}>
      {children}
    </ERC4337Context.Provider>
  )
}

/**
 * ChainProvider
 *
 * Wraps your app with all providers required for ERC-4337:
 * Privy (auth + embedded wallets) → QueryClient → Wagmi → ERC4337Context
 *
 * Put this at the ROOT of your app, outside your router.
 *
 * @param {object}   props
 * @param {string}   props.privyAppId      — from dashboard.privy.io
 * @param {object}   props.chain           — viem chain (e.g. polygonAmoy)
 * @param {string}   props.rpcUrl          — your Alchemy/Infura RPC URL
 * @param {string[]} [props.loginMethods]  — default: ['google', 'email']
 * @param {object}   [props.appearance]    — Privy modal theme config
 * @param {string}   [props.pimlicoApiKey]  — Optional Pimlico API key
 * @param {string}   [props.alchemyApiKey]  — Optional Alchemy API key
 * @param {string}   [props.biconomyApiKey] — Optional Biconomy API key
 * @param {string}   [props.bundler]       — 'pimlico' | 'alchemy' (default: 'pimlico')
 * @param {string}   [props.paymaster]     — 'pimlico' | 'alchemy' (default: 'pimlico')
 * @param {string}   [props.bundlerUrl]    — Optional custom bundler RPC endpoint
 * @param {string}   [props.paymasterUrl]  — Optional custom paymaster RPC endpoint
 * @param {node}     props.children
 */
export function ChainProvider({
  privyAppId,
  chain,
  rpcUrl,
  loginMethods = ['google', 'email'],
  appearance = {},
  pimlicoApiKey = null,
  alchemyApiKey = null,
  biconomyApiKey = null,
  bundler = 'pimlico',
  paymaster = 'pimlico',
  bundlerUrl = null,
  paymasterUrl = null,
  children,
}) {
  const wagmiConfig = createConfig({
    chains: [chain],
    transports: {
      [chain.id]: http(rpcUrl),
    },
  })

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods,
        embeddedWallets: {
          // CRITICAL: this tells Privy to create a wallet for EVERY user
          // automatically on login. Without this, you'd have to call
          // createWallet() manually and handle the timing yourself.
          createOnLogin: 'all-users',
        },
        defaultChain: chain,
        supportedChains: [chain],
        appearance: {
          theme: 'light',
          accentColor: '#7c3aed',
          ...appearance,
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <ERC4337ProviderInner
            chain={chain}
            rpcUrl={rpcUrl}
            pimlicoApiKey={pimlicoApiKey}
            alchemyApiKey={alchemyApiKey}
            biconomyApiKey={biconomyApiKey}
            bundler={bundler}
            paymaster={paymaster}
            bundlerUrl={bundlerUrl}
            paymasterUrl={paymasterUrl}
          >
            {children}
          </ERC4337ProviderInner>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  )
}

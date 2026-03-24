import React from 'react'
import { PrivyProvider } from '@privy-io/react-auth'
import { WagmiProvider, createConfig } from '@privy-io/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http } from 'viem'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
    },
  },
})

/**
 * ChainProvider
 *
 * Wraps your app with all providers required for ERC-4337:
 * Privy (auth + embedded wallets) → QueryClient → Wagmi
 *
 * Put this at the ROOT of your app, outside your router.
 *
 * @param {object}   props
 * @param {string}   props.privyAppId      — from dashboard.privy.io
 * @param {object}   props.chain           — viem chain (e.g. polygonAmoy)
 * @param {string}   props.rpcUrl          — your Alchemy/Infura RPC URL
 * @param {string[]} [props.loginMethods]  — default: ['google', 'email']
 * @param {object}   [props.appearance]    — Privy modal theme config
 * @param {node}     props.children
 *
 * @example
 * import { ChainProvider } from '@atharva/erc4337-kit'
 * import { polygonAmoy } from 'viem/chains'
 *
 * <ChainProvider
 *   privyAppId={import.meta.env.VITE_PRIVY_APP_ID}
 *   chain={polygonAmoy}
 *   rpcUrl={import.meta.env.VITE_RPC_URL}
 * >
 *   <App />
 * </ChainProvider>
 */
export function ChainProvider({
  privyAppId,
  chain,
  rpcUrl,
  loginMethods = ['google', 'email'],
  appearance = {},
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
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  )
}

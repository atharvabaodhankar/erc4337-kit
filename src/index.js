// Providers
export { ChainProvider } from './providers/ChainProvider.jsx'

// Hooks — v0.1
export { useSmartAccount } from './hooks/useSmartAccount.js'
export { useStoreOnChain } from './hooks/useStoreOnChain.js'

// Hooks — v0.2
export { useTransaction } from './hooks/useTransaction.js'
export { useBalance } from './hooks/useBalance.js'
export { useTokenBalance } from './hooks/useTokenBalance.js'
export { useBatchTransaction } from './hooks/useBatchTransaction.js'
export { useExplorer } from './hooks/useExplorer.js'

// Hooks — v0.3
export { useContractRead } from './hooks/useContractRead.js'
export { useWallet } from './hooks/useWallet.js'

// Hooks — v0.4
export { useAAAnalytics } from './hooks/useAAAnalytics.js'
export { useUserOperation } from './hooks/useUserOperation.js'
export { useSessionKey, createSessionKey } from './hooks/useSessionKey.js'
export { usePaymasterPolicy, createPaymasterPolicy } from './hooks/usePaymasterPolicy.js'

// Utils — v0.1
export { sha256Hash, sha256HashFile } from './utils/hash.js'

// Utils — v0.3
export { createERC4337Config } from './utils/config.js'

// Re-export commonly needed viem chains so consumers
// don't need to install viem just to get the chain object
// v0.1 chains
export { polygonAmoy, polygon, sepolia, baseSepolia } from 'viem/chains'
// v0.3 chains
export { base, arbitrum, optimism, avalanche, bsc } from 'viem/chains'

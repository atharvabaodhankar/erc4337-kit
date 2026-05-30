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

// Utils
export { sha256Hash, sha256HashFile } from './utils/hash.js'

// Re-export commonly needed viem chains so consumers
// don't need to install viem just to get the chain object
export { polygonAmoy, polygon, sepolia, baseSepolia } from 'viem/chains'

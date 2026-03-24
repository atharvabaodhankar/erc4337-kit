// Providers
export { ChainProvider } from './providers/ChainProvider.jsx'

// Hooks
export { useSmartAccount } from './hooks/useSmartAccount.js'
export { useStoreOnChain } from './hooks/useStoreOnChain.js'

// Utils
export { sha256Hash, sha256HashFile } from './utils/hash.js'

// Re-export commonly needed viem chains so consumers
// don't need to install viem just to get the chain object
export { polygonAmoy, polygon, sepolia, baseSepolia } from 'viem/chains'

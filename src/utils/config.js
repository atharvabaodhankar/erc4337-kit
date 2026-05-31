/**
 * createERC4337Config
 *
 * Creates a reusable, portable config object that can be passed to any
 * erc4337-kit hook without repeating the same three params everywhere.
 *
 * Instead of:
 *   useSmartAccount({ pimlicoApiKey, rpcUrl, chain })
 *   useBalance({ address, chain, rpcUrl })
 *   useContractRead({ ..., chain, rpcUrl })
 *
 * Do:
 *   const config = createERC4337Config({ chain, rpcUrl, pimlicoApiKey })
 *   useSmartAccount(config)
 *   useBalance({ address, ...config })
 *   useContractRead({ ..., ...config })
 *
 * @param {object} options
 * @param {object} options.chain          — viem chain object (e.g. polygonAmoy)
 * @param {string} options.rpcUrl         — Alchemy/Infura RPC URL
 * @param {string} [options.pimlicoApiKey] — Pimlico API key (required for write hooks)
 *
 * @returns {object} { chain, rpcUrl, pimlicoApiKey }
 *
 * @example
 * // config.js — define once, import everywhere
 * import { createERC4337Config, polygonAmoy } from 'erc4337-kit'
 *
 * export const config = createERC4337Config({
 *   chain:          polygonAmoy,
 *   rpcUrl:         import.meta.env.VITE_RPC_URL,
 *   pimlicoApiKey:  import.meta.env.VITE_PIMLICO_API_KEY,
 * })
 *
 * // In any component:
 * import { config } from './config'
 *
 * const wallet = useWallet(config)
 * const { data } = useContractRead({ address, abi, functionName, ...config })
 * const balance = useBalance({ address: wallet.address, ...config })
 */
export function createERC4337Config({
  chain,
  rpcUrl,
  pimlicoApiKey = null,
  alchemyApiKey = null,
  biconomyApiKey = null,
  bundler = 'pimlico',
  paymaster = 'pimlico',
  bundlerUrl = null,
  paymasterUrl = null,
}) {
  if (!chain) {
    throw new Error('[erc4337-kit] createERC4337Config: `chain` is required')
  }
  if (!rpcUrl) {
    throw new Error('[erc4337-kit] createERC4337Config: `rpcUrl` is required')
  }

  return {
    chain,
    rpcUrl,
    bundler,
    paymaster,
    ...(pimlicoApiKey ? { pimlicoApiKey } : {}),
    ...(alchemyApiKey ? { alchemyApiKey } : {}),
    ...(biconomyApiKey ? { biconomyApiKey } : {}),
    ...(bundlerUrl ? { bundlerUrl } : {}),
    ...(paymasterUrl ? { paymasterUrl } : {}),
  }
}

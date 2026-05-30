import { encodeFunctionData, createPublicClient, http } from 'viem'

/**
 * createContractClient
 *
 * Creates a typed contract wrapper that gives you clean `read` and `write`
 * interfaces without dealing with encodeFunctionData or sendTransaction directly.
 *
 * Reads go through a publicClient (free, no gas).
 * Writes go through smartAccountClient (gasless via ERC-4337).
 *
 * @param {object} options
 * @param {string}  options.address             — deployed contract address
 * @param {array}   options.abi                 — contract ABI
 * @param {object}  [options.smartAccountClient] — from useSmartAccount() — required for writes
 * @param {object}  [options.chain]             — viem chain — required for reads (if no publicClient)
 * @param {string}  [options.rpcUrl]            — RPC URL — required for reads (if no publicClient)
 * @param {object}  [options.publicClient]      — provide your own publicClient (optional)
 *
 * @returns {object} {
 *   read,    ← proxy: contract.read.functionName(args) → Promise<result>
 *   write,   ← proxy: contract.write.functionName(args, options?) → Promise<txHash>
 *   address,
 *   abi,
 * }
 *
 * @example
 * import { createContractClient } from 'erc4337-kit'
 *
 * const registry = createContractClient({
 *   address: import.meta.env.VITE_CONTRACT_ADDRESS,
 *   abi: registryAbi,
 *   smartAccountClient,
 *   chain: polygonAmoy,
 *   rpcUrl: import.meta.env.VITE_RPC_URL,
 * })
 *
 * // Read (free)
 * const total = await registry.read.totalRecords()
 * const myRecords = await registry.read.getRecordsBySubmitter([smartAccountAddress])
 *
 * // Write (gasless)
 * const txHash = await registry.write.storeRecord([dataHash])
 *
 * // Write with ETH value
 * const txHash = await registry.write.deposit([], { value: 1000000n })
 */
export function createContractClient({
  address,
  abi,
  smartAccountClient = null,
  chain = null,
  rpcUrl = null,
  publicClient: providedPublicClient = null,
}) {
  if (!address) throw new Error('[erc4337-kit] createContractClient: `address` is required')
  if (!abi)     throw new Error('[erc4337-kit] createContractClient: `abi` is required')

  // Build or use the provided publicClient for reads
  function getPublicClient() {
    if (providedPublicClient) return providedPublicClient
    if (!chain || !rpcUrl) {
      throw new Error('[erc4337-kit] createContractClient: `chain` and `rpcUrl` are required for reads (or provide a `publicClient`)')
    }
    return createPublicClient({ chain, transport: http(rpcUrl) })
  }

  // -----------------------------------------------------------------
  // read proxy — routes any property access to publicClient.readContract
  // -----------------------------------------------------------------
  const read = new Proxy({}, {
    get(_, functionName) {
      return async (args = [], options = {}) => {
        const client = getPublicClient()
        return client.readContract({
          address,
          abi,
          functionName,
          args,
          ...(options.account ? { account: options.account } : {}),
        })
      }
    },
  })

  // -----------------------------------------------------------------
  // write proxy — routes any property access to smartAccountClient.sendTransaction
  // -----------------------------------------------------------------
  const write = new Proxy({}, {
    get(_, functionName) {
      return async (args = [], options = {}) => {
        if (!smartAccountClient) {
          throw new Error(
            `[erc4337-kit] createContractClient: cannot call write.${functionName}() — no smartAccountClient provided. Make sure the user is logged in.`
          )
        }

        const calldata = encodeFunctionData({ abi, functionName, args })

        return smartAccountClient.sendTransaction({
          to: address,
          data: calldata,
          value: options.value ?? 0n,
        })
      }
    },
  })

  return {
    read,
    write,
    address,
    abi,
  }
}

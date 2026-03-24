# erc4337-kit

ERC-4337 Account Abstraction for React apps — gasless transactions, social login, smart accounts. Plug in, don't plumb.

Built on: Privy · Pimlico · Permissionless · Polygon Amoy

---

## Install

```bash
npm install erc4337-kit
```

Also install peer dependencies if you haven't already:

```bash
npm install @privy-io/react-auth @privy-io/wagmi viem wagmi @tanstack/react-query permissionless
```

---

## Vite setup (required)

Add this to `vite.config.js` — viem needs these polyfills in the browser:

```js
export default defineConfig({
  define: { global: 'globalThis' },
  resolve: {
    alias: { '@noble/curves/nist.js': '@noble/curves/nist' },
  },
})
```

Add this to your `index.html` `<head>` before your app script:

```html
<script type="module">
  import { Buffer } from 'buffer'
  import process from 'process'
  window.Buffer = Buffer
  window.process = process
</script>
```

---

## Quick start

### 1. Wrap your app

```jsx
import { ChainProvider } from 'erc4337-kit'
import { polygonAmoy } from 'erc4337-kit'

function main() {
  return (
    <ChainProvider
      privyAppId={import.meta.env.VITE_PRIVY_APP_ID}
      chain={polygonAmoy}
      rpcUrl={import.meta.env.VITE_RPC_URL}
    >
      <App />
    </ChainProvider>
  )
}
```

### 2. Initialize the smart account

```jsx
import { useSmartAccount } from 'erc4337-kit'
import { polygonAmoy } from 'erc4337-kit'

function App() {
  const {
    login, logout, authenticated,
    smartAccountClient, smartAccountAddress,
    isReady, isLoading, error
  } = useSmartAccount({
    pimlicoApiKey: import.meta.env.VITE_PIMLICO_API_KEY,
    rpcUrl:        import.meta.env.VITE_RPC_URL,
    chain:         polygonAmoy,
  })

  if (!authenticated) return <button onClick={login}>Login with Google</button>
  if (isLoading) return <p>Setting up your wallet...</p>
  if (error) return <p>Error: {error}</p>

  return <Dashboard smartAccountClient={smartAccountClient} />
}
```

### 3. Store data on-chain (gasless)

```jsx
import { useStoreOnChain, sha256Hash } from 'erc4337-kit'

const MY_CONTRACT_ABI = [
  {
    name: 'storeRecord',
    type: 'function',
    inputs: [{ name: 'dataHash', type: 'bytes32' }],
  },
]

function ReportForm({ smartAccountClient }) {
  const { submit, txHash, isLoading, error } = useStoreOnChain({
    smartAccountClient,
    contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS,
    abi: MY_CONTRACT_ABI,
    functionName: 'storeRecord',
  })

  const handleSubmit = async (reportText) => {
    const hash = await sha256Hash(reportText)  // hashed locally
    await submit([hash])
  }

  return (
    <div>
      <button onClick={() => handleSubmit('incident details')} disabled={isLoading}>
        {isLoading ? 'Storing...' : 'Submit Report'}
      </button>
      {txHash && <p>Stored! Tx: {txHash}</p>}
      {error && <p>Error: {error}</p>}
    </div>
  )
}
```

---

## Contract template

Copy `src/contracts/BaseStorage.sol` from this package as a starting point. It is pre-commented with all ERC-4337 compatibility rules. Add fields to the struct and parameters to `storeRecord()` as needed for your use case.

Deploy it with Hardhat or Remix to your chain, then pass the address to `useStoreOnChain()`.

---

## Environment variables

```env
VITE_PRIVY_APP_ID=       # dashboard.privy.io
VITE_PIMLICO_API_KEY=    # dashboard.pimlico.io
VITE_RPC_URL=            # Alchemy or Infura RPC for your chain
VITE_CONTRACT_ADDRESS=   # deployed BaseStorage.sol address
```

---

## Supported chains

Any EVM chain supported by Pimlico and Privy. Chains exported from this package for convenience:

- `polygonAmoy` — Polygon testnet (recommended for dev)
- `polygon` — Polygon mainnet
- `sepolia` — Ethereum testnet
- `baseSepolia` — Base testnet

---

## License

MIT

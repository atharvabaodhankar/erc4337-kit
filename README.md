# erc4337-kit

> ERC-4337 Account Abstraction for React — gasless transactions, social login, smart accounts, balances, contract reads, and batch calls without the complexity.

Built on **Privy** (auth) · **Pimlico** (bundler + paymaster) · **Permissionless** (smart accounts) · **viem** (Ethereum client)

[![npm](https://img.shields.io/npm/v/erc4337-kit)](https://www.npmjs.com/package/erc4337-kit)
[![license](https://img.shields.io/npm/l/erc4337-kit)](LICENSE)

---

## What this package does

Normally, setting up ERC-4337 means wiring together Privy, Permissionless, Pimlico, viem, wagmi, and writing ~200 lines of boilerplate hooks yourself — dealing with race conditions, polyfills, gas estimation, UserOperation formatting, and paymaster sponsorship.

This package collapses all of that into a single install.

```
Without erc4337-kit:              With erc4337-kit:
─────────────────────────         ────────────────────────
200 lines of setup          →     <ChainProvider>       (5 lines)
Privy + wagmi + QueryClient       useWallet()           (1 line)
Smart account init race fix       useTransaction()      (1 line)
Pimlico gas estimation            useBalance()          (1 line)
UserOperation formatting          useBatchTransaction() (1 line)
Contract read boilerplate         useContractRead()     (1 line)
Error parsing                     useExplorer()         (1 line)
```

---

## Requirements

- React 18 or 19
- Vite, Next.js, or Create React App
- Node.js 18+
- A Privy App ID (free at [dashboard.privy.io](https://dashboard.privy.io))
- A Pimlico API Key (free at [dashboard.pimlico.io](https://dashboard.pimlico.io))
- An Alchemy RPC URL (free at [dashboard.alchemy.com](https://dashboard.alchemy.com))

---

## Setup via CLI (Recommended) ✨ v0.5

The fastest way to get started is by scaffolding a pre-configured template using our CLI in an empty folder:

```bash
# Vite + React (default)
npx erc4337-kit init

# Next.js App Router
npx erc4337-kit init next

# Create React App style
npx erc4337-kit init react
```

This generates all the boilerplate files (`vite.config.js`/`next.config.js`, browser polyfills, environment files, providers, and a complete pre-configured `App.jsx` using `useWallet`).

---

## Manual Installation

```bash
# Step 1: install the package
npm install erc4337-kit

# Step 2: install peer dependencies
npm install @privy-io/react-auth @privy-io/wagmi viem wagmi @tanstack/react-query

# Step 3: install browser polyfills (viem needs these)
npm install buffer process
```

---

## Setup (two files to edit, then you're done)

### 1. `vite.config.js`

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',        // required for viem
  },
  resolve: {
    alias: {
      '@noble/curves/nist.js': '@noble/curves/nist',  // required for permissionless
    },
  },
})
```

> If you're using Tailwind v4, add `tailwindcss from '@tailwindcss/vite'` to plugins as normal — it's compatible.

### 2. `index.html` — add this in `<head>`, **before** your app script

```html
<head>
  <!-- ... your other meta tags ... -->

  <!-- REQUIRED: add this before <script src="/src/main.jsx"> -->
  <script type="module">
    import { Buffer } from 'buffer'
    import process from 'process'
    window.Buffer = Buffer
    window.process = process
  </script>
</head>
```

> **Why?** `viem` and `permissionless` use Node.js globals (`Buffer`, `process`) that don't exist in the browser. This polyfill must load before your app or you'll get `ReferenceError: Buffer is not defined`.

---

## `.env`

```env
VITE_PRIVY_APP_ID=          # from dashboard.privy.io → your app → App ID
VITE_PIMLICO_API_KEY=       # from dashboard.pimlico.io → API Keys
VITE_RPC_URL=               # from dashboard.alchemy.com → your chain → HTTPS URL
VITE_CONTRACT_ADDRESS=      # your deployed contract address (after you deploy)
```

> Never commit `.env` to git. Add it to `.gitignore`.

---

## Demo Application (Todo App)

A pre-configured, highly premium glassmorphic Todo list application demonstrating `erc4337-kit` in a real-world setting is available at:
👉 **[github.com/atharvabaodhankar/erc4337-kit-demo](https://github.com/atharvabaodhankar/erc4337-kit-demo)**

You can clone this demo repository to test:
- Social sign-in (Google/Email).
- Deterministic Smart Account creation.
- 100% sponsored gasless transaction syncing.
- Cryptographic verification & tamper-proofing simulations.

---

## Quick Start

### 1. Wrap your app with `ChainProvider`

Put this in `src/main.jsx`. Sets up Privy, QueryClient, and Wagmi in one shot.

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ChainProvider, polygonAmoy } from 'erc4337-kit'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ChainProvider
      privyAppId={import.meta.env.VITE_PRIVY_APP_ID}
      chain={polygonAmoy}
      rpcUrl={import.meta.env.VITE_RPC_URL}
      loginMethods={['google', 'email']}     // optional, this is the default
      appearance={{ theme: 'dark', accentColor: '#7c3aed' }}  // optional
    >
      <App />
    </ChainProvider>
  </React.StrictMode>,
)
```

### 2. Initialize the wallet (recommended: use `useWallet`)

`useWallet` is the all-in-one hook introduced in v0.3. It replaces calling `useSmartAccount` and `useBalance` separately.

```jsx
import { useWallet, polygonAmoy } from 'erc4337-kit'

function App() {
  const wallet = useWallet({
    pimlicoApiKey: import.meta.env.VITE_PIMLICO_API_KEY,
    rpcUrl:        import.meta.env.VITE_RPC_URL,
    chain:         polygonAmoy,
  })

  if (!wallet.authenticated) return <button onClick={wallet.login}>Sign in</button>
  if (wallet.isLoading)      return <p>Setting up your wallet…</p>
  if (wallet.error)          return <p style={{ color: 'red' }}>Error: {wallet.error}</p>

  return (
    <div>
      <p>Address: {wallet.address}</p>
      <p>Balance: {wallet.balance.formatted} {wallet.balance.symbol}</p>
      <p>Network: {wallet.chainName}</p>
      <button onClick={wallet.logout}>Sign out</button>
    </div>
  )
}
```

> If you need individual hooks (e.g. for code-splitting), you can still use `useSmartAccount` and `useBalance` separately — `useWallet` is just a convenience wrapper.

> `wallet.address` is **deterministic** — the same user always gets the same smart account address across sessions. Store this in your database if you need to link on-chain records to users.

### 3. Send a gasless transaction

```jsx
import { useTransaction, sha256Hash } from 'erc4337-kit'

function SubmitForm({ smartAccountClient }) {
  const tx = useTransaction({ smartAccountClient })

  const handleSubmit = async (rawData) => {
    const dataHash = await sha256Hash(JSON.stringify(rawData))

    await tx.send({
      to: import.meta.env.VITE_CONTRACT_ADDRESS,
      abi: myAbi,
      functionName: 'storeRecord',
      args: [dataHash],
    })
  }

  return (
    <div>
      <button onClick={() => handleSubmit({ text: 'my data' })} disabled={tx.pending}>
        {tx.pending ? 'Sending…' : 'Submit'}
      </button>
      {tx.confirmed && <p>✅ Confirmed! Tx: {tx.txHash?.slice(0, 10)}…</p>}
      {tx.failed    && <p>❌ Failed: {tx.error}</p>}
    </div>
  )
}
```

### 4. Check balances

```jsx
import { useBalance, useTokenBalance, polygonAmoy } from 'erc4337-kit'

function WalletInfo({ smartAccountAddress }) {
  // Native token (MATIC on Polygon, ETH on Ethereum, etc.)
  const native = useBalance({
    address: smartAccountAddress,
    chain:   polygonAmoy,
    rpcUrl:  import.meta.env.VITE_RPC_URL,
  })

  // ERC20 token (e.g. USDC)
  const usdc = useTokenBalance({
    tokenAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // USDC on Polygon
    address:      smartAccountAddress,
    chain:        polygonAmoy,
    rpcUrl:       import.meta.env.VITE_RPC_URL,
  })

  return (
    <div>
      <p>Balance: {native.formatted} {native.symbol}</p>
      <p>USDC: {usdc.formatted} {usdc.symbol}</p>
    </div>
  )
}
```

> **Tip:** If you use `useWallet`, the native balance is already included as `wallet.balance` — no need to call `useBalance` separately.

### 5. Batch multiple calls in one UserOperation

```jsx
import { useBatchTransaction } from 'erc4337-kit'

function BatchDemo({ smartAccountClient }) {
  const batch = useBatchTransaction({ smartAccountClient })

  const handleBatch = async () => {
    await batch.send([
      {
        to: contractA,
        abi: abiA,
        functionName: 'approve',
        args: [spender, amount],
      },
      {
        to: contractB,
        abi: abiB,
        functionName: 'deposit',
        args: [amount],
      },
    ])
    // Both calls go in a single UserOperation — one signature, one gas sponsorship
  }

  return (
    <button onClick={handleBatch} disabled={batch.pending}>
      {batch.pending ? 'Sending batch…' : 'Execute batch'}
    </button>
  )
}
```

### 6. Chain-aware explorer links

```jsx
import { useExplorer, polygonAmoy } from 'erc4337-kit'

function TxLink({ txHash }) {
  const explorer = useExplorer({ chain: polygonAmoy })

  return (
    <a href={explorer.tx(txHash)} target="_blank" rel="noreferrer">
      View on {explorer.name}
    </a>
  )
}
```

### 7. Read from the contract

Use `useContractRead` — no manual `publicClient` setup needed.

```jsx
import { useContractRead, polygonAmoy } from 'erc4337-kit'

function RecordList({ smartAccountAddress }) {
  const { data: records, isLoading, refetch } = useContractRead({
    address:      contractAddress,
    abi:          contractABI,
    functionName: 'getRecordsBySubmitter',
    args:         [smartAccountAddress],
    account:      smartAccountAddress,   // required for msg.sender-based reads
    chain:        polygonAmoy,
    rpcUrl:       import.meta.env.VITE_RPC_URL,
    refetchInterval: 10_000,             // auto-refetch every 10 seconds (optional)
  })

  if (isLoading) return <p>Loading…</p>

  return (
    <ul>
      {records?.map(id => <li key={id}>{id}</li>)}
    </ul>
  )
}
```

> `account: smartAccountAddress` is required when your contract uses `msg.sender` to look up data. Without it, the read returns data for address `0x000...000` instead.

### 8. Use a shared config object

Avoid repeating `chain`, `rpcUrl`, and `pimlicoApiKey` in every hook call:

```jsx
// src/config.js — define once
import { createERC4337Config, polygonAmoy } from 'erc4337-kit'

export const config = createERC4337Config({
  chain:         polygonAmoy,
  rpcUrl:        import.meta.env.VITE_RPC_URL,
  pimlicoApiKey: import.meta.env.VITE_PIMLICO_API_KEY,
})

// In any component:
import { config } from './config'

const wallet = useWallet(config)
const { data } = useContractRead({ address, abi, functionName, ...config })
const balance = useBalance({ address: wallet.address, ...config })
```

---

## Supported chains

```js
// v0.1 chains
import { polygonAmoy, polygon, sepolia, baseSepolia } from 'erc4337-kit'

// v0.3 chains
import { base, arbitrum, optimism, avalanche, bsc } from 'erc4337-kit'
```

| Export | Network | Chain ID | Use for |
|--------|---------|----------|---------|
| `polygonAmoy` | Polygon Amoy testnet | 80002 | Development and testing |
| `polygon` | Polygon mainnet | 137 | Production (Polygon) |
| `sepolia` | Ethereum Sepolia testnet | 11155111 | Ethereum testing |
| `baseSepolia` | Base Sepolia testnet | 84532 | Base testing |
| `base` | Base mainnet | 8453 | Production (Base) |
| `arbitrum` | Arbitrum One | 42161 | Production (Arbitrum) |
| `optimism` | Optimism mainnet | 10 | Production (Optimism) |
| `avalanche` | Avalanche C-Chain | 43114 | Production (Avalanche) |
| `bsc` | BNB Smart Chain | 56 | Production (BNB) |

All chains supported by both Pimlico and Privy work. These are re-exported from viem for convenience.

---

## Solidity contract compatibility

Your contract works with this package without modification. There is one rule you must understand:

**`msg.sender` in your contract will be the user's Smart Account address, not their EOA.**

This is correct and expected. Your mappings, ownership checks, and identity logic should use `msg.sender` as normal — it will consistently resolve to the user's smart account address every session.

A minimal compatible contract:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract YourApp {
    // msg.sender = user's Smart Account (consistent, deterministic)
    mapping(address => bytes32[]) private _records;

    function storeRecord(bytes32 dataHash) external {
        _records[msg.sender].push(dataHash);
    }

    function getRecords() external view returns (bytes32[] memory) {
        return _records[msg.sender];
    }
}
```

A full template with events, verification, and submitter indexing is included at `node_modules/erc4337-kit/src/contracts/BaseStorage.sol`.

---

## API Reference

### `<ChainProvider>`

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `privyAppId` | `string` | Yes | — | Your Privy App ID |
| `chain` | `Chain` (viem) | Yes | — | Target blockchain |
| `rpcUrl` | `string` | Yes | — | Alchemy / Infura RPC URL |
| `loginMethods` | `string[]` | No | `['google', 'email']` | Privy login methods |
| `appearance` | `object` | No | `{ theme: 'light' }` | Privy modal appearance |

---

### `useSmartAccount(config)`

**Config:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pimlicoApiKey` | `string` | Yes | Pimlico API key |
| `rpcUrl` | `string` | Yes | RPC URL matching your chain |
| `chain` | `Chain` (viem) | Yes | Must match ChainProvider |

**Returns:**

| Field | Type | Description |
|-------|------|-------------|
| `login` | `Function` | Opens Privy login modal |
| `logout` | `Function` | Clears all state and logs out |
| `authenticated` | `boolean` | True when user is logged in |
| `user` | `PrivyUser \| null` | Privy user object |
| `smartAccountAddress` | `string \| null` | The user's smart account address |
| `smartAccountClient` | `SmartAccountClient \| null` | For sending transactions |
| `pimlicoClient` | `PimlicoClient \| null` | For gas price reads |
| `isReady` | `boolean` | True when safe to call `sendTransaction` |
| `isLoading` | `boolean` | True during initialization |
| `error` | `string \| null` | Human-readable error |

---

### `useTransaction(config)` ✨ v0.2

**Config:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `smartAccountClient` | `SmartAccountClient` | Yes | From `useSmartAccount()` |

**`send(params)` params:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `to` | `string` | Yes | Target contract or wallet address |
| `abi` | `Abi` | No | Contract ABI (required if calling a function) |
| `functionName` | `string` | No | Function to call |
| `args` | `any[]` | No | Function arguments (default `[]`) |
| `value` | `bigint` | No | Native token value in wei (default `0n`) |
| `data` | `string` | No | Raw calldata (alternative to abi/functionName/args) |

**Returns:**

| Field | Type | Description |
|-------|------|-------------|
| `send` | `async (params) => string \| null` | Sends the transaction, returns txHash |
| `pending` | `boolean` | True while UserOp is being submitted and mined |
| `confirmed` | `boolean` | True once tx is successfully mined |
| `failed` | `boolean` | True if tx reverted or was rejected |
| `txHash` | `string \| null` | Transaction hash |
| `receipt` | `TransactionReceipt \| null` | Full receipt after confirmation |
| `error` | `string \| null` | Human-readable error |
| `reset` | `Function` | Resets all state |

---

### `useBalance(config)` ✨ v0.2

**Config:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `address` | `string` | Yes | Smart account address |
| `chain` | `Chain` (viem) | Yes | Target chain |
| `rpcUrl` | `string` | Yes | RPC URL |

**Returns:**

| Field | Type | Description |
|-------|------|-------------|
| `formatted` | `string \| null` | Human-readable balance (e.g. `"1.234"`) |
| `raw` | `bigint \| null` | Raw balance in wei |
| `symbol` | `string` | Native currency symbol (e.g. `"MATIC"`, `"ETH"`) |
| `isLoading` | `boolean` | True while fetching |
| `error` | `string \| null` | Error message |
| `refetch` | `Function` | Manually refresh the balance |

---

### `useTokenBalance(config)` ✨ v0.2

**Config:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tokenAddress` | `string` | Yes | ERC20 contract address |
| `address` | `string` | Yes | Smart account address |
| `chain` | `Chain` (viem) | Yes | Target chain |
| `rpcUrl` | `string` | Yes | RPC URL |

**Returns:**

| Field | Type | Description |
|-------|------|-------------|
| `formatted` | `string \| null` | Human-readable balance |
| `raw` | `bigint \| null` | Raw balance |
| `symbol` | `string \| null` | Token symbol (e.g. `"USDC"`) |
| `decimals` | `number \| null` | Token decimals (e.g. `6`) |
| `name` | `string \| null` | Token name (e.g. `"USD Coin"`) |
| `isLoading` | `boolean` | True while fetching |
| `error` | `string \| null` | Error message |
| `refetch` | `Function` | Manually refresh |

---

### `useBatchTransaction(config)` ✨ v0.2

**Config:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `smartAccountClient` | `SmartAccountClient` | Yes | From `useSmartAccount()` |

**`send(transactions)` — array of:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `to` | `string` | Yes | Target address |
| `abi` | `Abi` | No | Contract ABI |
| `functionName` | `string` | No | Function to call |
| `args` | `any[]` | No | Arguments (default `[]`) |
| `value` | `bigint` | No | Native value (default `0n`) |
| `data` | `string` | No | Raw calldata |

**Returns:** Same shape as `useTransaction` — `{ send, pending, confirmed, failed, txHash, receipt, error, reset }`.

---

### `useExplorer(config)` ✨ v0.2

**Config:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chain` | `Chain` (viem) | Yes | Target chain |

**Returns:**

| Field | Type | Description |
|-------|------|-------------|
| `tx(hash)` | `string \| null` | Full URL to transaction page |
| `address(addr)` | `string \| null` | Full URL to address page |
| `block(number)` | `string \| null` | Full URL to block page |
| `token(addr)` | `string \| null` | Full URL to token page |
| `baseUrl` | `string \| null` | Root explorer URL |
| `name` | `string` | Explorer display name |

---

### `useWallet(config)` ✨ v0.3

Unified hook combining `useSmartAccount` + `useBalance`. Accepts the same config as `useSmartAccount`.

**Config:** Same as `useSmartAccount` — `{ pimlicoApiKey, rpcUrl, chain }`

**Returns:** All fields from `useSmartAccount`, plus:

| Field | Type | Description |
|-------|------|-------------|
| `address` | `string \| null` | Shorthand for `smartAccountAddress` |
| `chainId` | `number \| null` | Numeric chain ID |
| `chainName` | `string \| null` | Human-readable chain name |
| `balance` | `object` | `{ formatted, raw, symbol, isLoading, error, refetch }` |
| `owner` | `string \| null` | EOA address that owns the smart account |

---

### `useContractRead(config)` ✨ v0.3

**Config:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `address` | `string` | Yes | Contract address |
| `abi` | `Abi` | Yes | Contract ABI |
| `functionName` | `string` | Yes | Function to read |
| `args` | `any[]` | No | Function arguments (default `[]`) |
| `account` | `string` | No | Caller address (for `msg.sender`-based reads) |
| `chain` | `Chain` (viem) | Yes | Target chain |
| `rpcUrl` | `string` | Yes | RPC URL |
| `refetchInterval` | `number` | No | Auto-refetch interval in ms (0 = disabled) |
| `enabled` | `boolean` | No | Set `false` to skip the fetch (default `true`) |

**Returns:**

| Field | Type | Description |
|-------|------|-------------|
| `data` | `any` | Contract return value |
| `isLoading` | `boolean` | True on the initial fetch only |
| `isFetching` | `boolean` | True on any fetch (including background refetches) |
| `error` | `string \| null` | Error message |
| `refetch` | `Function` | Manually trigger a fresh read |

---

### `createERC4337Config(options)` ✨ v0.3

Creates a reusable config object to spread into any hook, avoiding repetition.

```js
const config = createERC4337Config({ chain, rpcUrl, pimlicoApiKey })

useWallet(config)
useContractRead({ address, abi, functionName, ...config })
useBalance({ address, ...config })
```

**Options:** `{ chain, rpcUrl, pimlicoApiKey? }` — throws if `chain` or `rpcUrl` are missing.

---

### `useAAAnalytics(config)` ✨ v0.4

Tracks transaction metrics for a smart account. Persisted in localStorage.

**Config:** `{ smartAccountAddress }`

**Returns:**

| Field | Type | Description |
|-------|------|-------------|
| `txCount` | `number` | Total txs attempted |
| `confirmedCount` | `number` | Successfully mined |
| `failedCount` | `number` | Reverted or rejected |
| `successRate` | `number` | 0–1 ratio of confirmed/attempted |
| `totalGasSponsoredWei` | `bigint` | Total gas sponsored in wei |
| `averageConfirmationMs` | `number` | Average confirmation time in ms |
| `recordPending()` | `Function` | Call when UserOp is submitted |
| `recordConfirmed(receipt, startedAt)` | `Function` | Call on confirmation |
| `recordFailed()` | `Function` | Call on failure |
| `reset()` | `Function` | Clear all stored analytics |

```jsx
const analytics = useAAAnalytics({ smartAccountAddress })
const tx = useTransaction({ smartAccountClient })

const handleSend = async () => {
  const startedAt = Date.now()
  analytics.recordPending()
  await tx.send({ to, abi, functionName, args })
  if (tx.confirmed) analytics.recordConfirmed(tx.receipt, startedAt)
  if (tx.failed)    analytics.recordFailed()
}

// Display
<p>Success rate: {(analytics.successRate * 100).toFixed(1)}%</p>
<p>Avg time: {(analytics.averageConfirmationMs / 1000).toFixed(1)}s</p>
```

---

### `useUserOperation(config)` ✨ v0.4

Polls the bundler for UserOp status. Useful for monitoring ops submitted by external signers or agents.

**Config:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userOpHash` | `string` | Yes | The UserOperation hash |
| `pimlicoClient` | `PimlicoClient` | Yes | From `useSmartAccount()` |
| `pollInterval` | `number` | No | Poll interval ms (default `2000`) |
| `timeout` | `number` | No | Give up after N ms (default `120_000`) |

**Returns:**

| Field | Type | Description |
|-------|------|-------------|
| `status` | `'idle' \| 'pending' \| 'confirmed' \| 'failed' \| 'timeout'` | Current status |
| `receipt` | `UserOperationReceipt \| null` | Receipt once confirmed |
| `txHash` | `string \| null` | On-chain tx hash |
| `error` | `string \| null` | Error if failed |
| `startPolling()` | `Function` | Manually start polling |
| `stopPolling()` | `Function` | Stop polling |
| `reset()` | `Function` | Clear all state |

---

### `createSessionKey(options)` ✨ v0.4

Async utility. Generates a temporary keypair with expiry, stored in localStorage.

```js
const session = await createSessionKey({
  smartAccountAddress,
  expiresIn: '7d',      // also: '24h', '30m', '60s', 5000 (ms)
  label: 'game-session',
})

console.log(session.address)    // 0x... (temporary signer address)
console.log(session.expiresAt)  // Unix ms timestamp
console.log(session.isValid())  // true/false
```

> **Note:** True contract-level session key scoping (restricting which contracts a key can call) requires a Kernel or Safe smart account. `createSessionKey` generates an ephemeral EOA keypair suitable for reducing re-prompts in games and agents.

---

### `useSessionKey(config)` ✨ v0.4

React hook wrapping `createSessionKey` with lifecycle management.

**Config:** `{ smartAccountAddress }`

**Returns:**

| Field | Type | Description |
|-------|------|-------------|
| `sessions` | `array` | All non-expired sessions |
| `activeSession` | `object \| null` | Most recent valid session |
| `hasActiveSession` | `boolean` | Shorthand |
| `create({ expiresIn, label? })` | `async Function` | Create a new session key |
| `revoke(address)` | `Function` | Remove a session by its address |
| `revokeAll()` | `Function` | Remove all sessions |
| `isLoading` | `boolean` | True while creating |

---

### `createPaymasterPolicy(options)` ✨ v0.4

Creates a policy object for use with `usePaymasterPolicy`.

```js
const policy = createPaymasterPolicy({
  dailyLimitUSD:      5,                    // max $5 gas sponsored per day
  allowedContracts:   [contractAddress],    // empty = allow all
  maxGasPerTx:        500_000n,             // gas units (not wei)
  maxTxPerDay:        20,                   // transaction count limit
})
```

---

### `usePaymasterPolicy(config)` ✨ v0.4

Wraps `smartAccountClient` with policy enforcement. Same `send()` API as `useTransaction`.

**Config:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `smartAccountClient` | `SmartAccountClient` | Yes | From `useSmartAccount()` |
| `smartAccountAddress` | `string` | Yes | For usage tracking |
| `policy` | `object` | Yes | From `createPaymasterPolicy()` |
| `gasUsdPrice` | `number` | No | Token price in USD for limit calculations (default `1.0`) |

**Returns:** Same as `useTransaction`, plus:

| Field | Type | Description |
|-------|------|-------------|
| `usage.txCount` | `number` | Txs sent today |
| `usage.estimatedUSD` | `number` | Estimated USD spent today |
| `resetUsage()` | `Function` | Manually reset daily counter |

---

### `useStoreOnChain(config)`

> A focused hook for the specific pattern of hashing data and storing on-chain. For general contract interactions, prefer `useTransaction`.

**Config:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `smartAccountClient` | `SmartAccountClient` | Yes | From `useSmartAccount()` |
| `contractAddress` | `string` | Yes | Deployed contract address |
| `abi` | `Abi` | Yes | Contract ABI |
| `functionName` | `string` | Yes | Function to call |

**Returns:**

| Field | Type | Description |
|-------|------|-------------|
| `submit` | `async (args: any[]) => string \| null` | Sends the transaction, returns txHash |
| `txHash` | `string \| null` | Transaction hash after success |
| `recordId` | `string \| null` | bytes32 decoded from first event log |
| `isLoading` | `boolean` | True while submitting |
| `isSuccess` | `boolean` | True after successful submission |
| `error` | `string \| null` | Human-readable error |
| `reset` | `Function` | Clears all state |

---

### `sha256Hash(text)` / `sha256HashFile(file)`

```js
const hash = await sha256Hash('any string')     // → '0x7f3a...' (66 chars, bytes32-compatible)
const hash = await sha256HashFile(fileObject)   // → '0xabcd...' (66 chars, bytes32-compatible)
```

Hashing happens in the browser using the Web Crypto API — no data leaves the device.

---

### `createContractClient(config)` ✨ v0.5

Creates a typed dynamic contract wrapper with beautiful `read` and `write` interfaces. Standard reads are free and go through a publicClient, while writes automatically go gasless through your `smartAccountClient`.

```js
import { createContractClient, polygonAmoy } from 'erc4337-kit'

const registry = createContractClient({
  address:             import.meta.env.VITE_CONTRACT_ADDRESS,
  abi:                 registryAbi,
  smartAccountClient:  wallet.smartAccountClient, // required for writes
  chain:               polygonAmoy,              // required for reads
  rpcUrl:              import.meta.env.VITE_RPC_URL, // required for reads
})

// 1. Read from contract (free, automatically formatted)
const total = await registry.read.totalRecords()

// 2. Write gaslessly (returns transaction hash, automatic UserOp wrapping)
const txHash = await registry.write.storeRecord([dataHash])
```

---

### Structured Error System ✨ v0.5

No more parsing raw unreadable ERC-4337 hex strings! `erc4337-kit` includes a built-in structured error analyzer that converts EntryPoint and bundler/paymaster errors into elegant objects.

```js
import { parseAAError } from 'erc4337-kit'

try {
  await registry.write.storeRecord([dataHash])
} catch (err) {
  const error = parseAAError(err)
  
  console.log(error.code)    // "AA21"
  console.log(error.title)   // "Paymaster Rejected"
  console.log(error.message) // "The paymaster rejected your sponsorship request."
  console.log(error.fix)     // "Verify your Pimlico API key is correct and this chain is enabled..."
}
```

We export:
* `parseAAError(err: Error)` — parses any error into a structured `ERC4337Error`
* `ERC4337Error` — structured error class
* `AA_ERROR_CODES` — map of all EntryPoint codes (`AA10` through `AA96`) to their pre-configured titles, messages, and actionable fixes.

---

### Zero-Config Hooks & Context ✨ v0.6

You no longer need to pass the `chain`, `rpcUrl`, and API keys to every hook! Wrap your application in `<ChainProvider>` and configure your settings once at the root level. All hooks will automatically consume configurations, clients, and addresses from the global React Context.

**1. Configure your root provider once:**

```jsx
import { ChainProvider, polygonAmoy } from 'erc4337-kit'

ReactDOM.createRoot(document.getElementById('root')).render(
  <ChainProvider
    privyAppId={import.meta.env.VITE_PRIVY_APP_ID}
    chain={polygonAmoy}
    rpcUrl={import.meta.env.VITE_RPC_URL}
    
    // Optional infrastructure configuration (Option C)
    bundler="alchemy"          // 'pimlico' | 'alchemy' (default: 'pimlico')
    paymaster="alchemy"        // 'pimlico' | 'alchemy' (default: 'pimlico')
    pimlicoApiKey={import.meta.env.VITE_PIMLICO_API_KEY}
    alchemyApiKey={import.meta.env.VITE_ALCHEMY_API_KEY}
  >
    <App />
  </ChainProvider>
)
```

**2. Call zero-config parameter-free hooks anywhere in your React tree:**

```jsx
import { useWallet, useTransaction, useBalance } from 'erc4337-kit'

function MyComponent() {
  // 1. Auto-configures auth, smart account client, and balance
  const wallet = useWallet() 

  // 2. Auto-binds your smart account client for gasless transactions
  const tx = useTransaction() 

  // 3. Auto-fetches native balance for your smart account
  const balance = useBalance() 
  
  return (
    <div>
      <p>{wallet.address}</p>
      <button onClick={() => tx.send({ to: '0x...', value: 100n })}>
        Send Gasless
      </button>
    </div>
  )
}
```

We export:
* `useERC4337()` — context hook to consume raw configurations, `smartAccount`, and `balance` states.
* `ERC4337Context` — raw React Context object for custom wrapping and testing.

---

## Troubleshooting

### `ReferenceError: Buffer is not defined`
The polyfill script is missing from `index.html`, or it's placed after your app script. It must come first in `<head>`.

### Smart account not initializing
Check all three env vars are set and correct. The `error` field from `useSmartAccount` will give you the exact message. Most commonly: wrong Pimlico API key, or your chain not enabled in your Pimlico dashboard.

### `account.encodeCalls is not a function`
You called `smartAccountClient.writeContract()`. Use `useTransaction` or `smartAccountClient.sendTransaction()` with `encodeFunctionData()` from viem instead.

### Contract reads returning empty or wrong data
You're missing `account: smartAccountAddress` in `publicClient.readContract()`. Without it, reads go out as address `0x0` which returns empty mappings.

### `AA21` — paymaster rejected
Your Pimlico API key is wrong, or your chain isn't enabled in your Pimlico project dashboard.

### `AA31` — paymaster out of funds
Your Pimlico paymaster balance is empty. The free tier works for testnet — log in and check your dashboard balance.

### `nonce` error
A previous UserOperation from this smart account is still pending in the bundler mempool. Wait 30–60 seconds and retry.

### Batch transaction fails
One of the calls in your batch likely has wrong arguments or a contract that's rejecting the call. The whole batch is atomic — if one call reverts, all revert. Test each call individually first.

---

## Production checklist

- [ ] Move from testnet to mainnet (change `chain` and `rpcUrl`)
- [ ] Upgrade Pimlico to a paid plan (free tier is testnet only)
- [ ] Set private keys and deployment secrets only in server env, never in `VITE_` prefixed vars
- [ ] Audit your Solidity contract before mainnet deployment
- [ ] Add `waitForTransactionReceipt` confirmation handling for critical flows
- [ ] Handle the `error` state from `useSmartAccount` visibly in your UI
- [ ] Add `.env` to `.gitignore`

---

## Changelog

### v0.6.0
- ✨ **Zero-Config Hooks** (`useWallet`, `useTransaction`, `useBalance`, `useTokenBalance`, `useBatchTransaction`, `useExplorer`, `useContractRead`, `usePaymasterPolicy`, `useUserOperation`) automatically consume configuration, clients, and state from the global React Context.
- ✨ **Multi-Bundler & Multi-Paymaster Support** (Option C) for Pimlico, Alchemy, and custom JSON-RPC URLs.
- ✨ `useERC4337` and `ERC4337Context` exported to query global provider configuration and wallet status.
- ✨ Structured `parseAAError` integration inside `useTransaction`, `useBatchTransaction`, and `usePaymasterPolicy` to automatically provide human-friendly fixes on failure.

### v0.5.0
- ✨ **CLI tool** (`npx erc4337-kit init`) for zero-config Vite, Next.js, and React starter templates.
- ✨ `createContractClient` — Proxy-based typed contract wrapper for beautiful reads and writes.
- ✨ **Structured Error System** (`parseAAError`, `ERC4337Error`, `AA_ERROR_CODES`) converting EntryPoint and bundler errors to human-friendly titles, messages, and fixes.

### v0.4.0
- ✨ `useAAAnalytics` — localStorage-persisted tx analytics (count, success rate, gas sponsored, avg confirmation time)
- ✨ `useUserOperation` — UserOp status monitoring via bundler polling
- ✨ `createSessionKey` + `useSessionKey` — ephemeral keypair sessions with expiry and revocation
- ✨ `createPaymasterPolicy` + `usePaymasterPolicy` — client-side spending limits, allowlists, and gas caps

### v0.3.0
- ✨ `useWallet` — unified hook (auth + smart account + balance + chain info)
- ✨ `useContractRead` — contract reads with caching, auto-refetch, and loading states
- ✨ `createERC4337Config` — portable config object to avoid repeating params
- ✨ Expanded chain support: `base`, `arbitrum`, `optimism`, `avalanche`, `bsc`

### v0.2.0
- ✨ `useTransaction` — unified tx management with `pending/confirmed/failed` states
- ✨ `useBalance` — native token balance with auto-fetch and refetch
- ✨ `useTokenBalance` — ERC20 balance with auto-fetched symbol, decimals, name
- ✨ `useBatchTransaction` — multiple contract calls in a single UserOperation
- ✨ `useExplorer` — chain-aware block explorer URL builder

### v0.1.2
- Initial public release
- `ChainProvider`, `useSmartAccount`, `useStoreOnChain`, `sha256Hash`, `sha256HashFile`

---

## Contributing

Found a bug? Have a feature request? Contributions are welcome!

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Links

- **npm**: https://www.npmjs.com/package/erc4337-kit
- **GitHub**: https://github.com/atharvabaodhankar/erc4337-kit
- **Privy dashboard**: https://dashboard.privy.io
- **Pimlico dashboard**: https://dashboard.pimlico.io
- **Alchemy**: https://dashboard.alchemy.com
- **ERC-4337 spec**: https://eips.ethereum.org/EIPS/eip-4337

---

## Support

- 🐛 Issues: https://github.com/atharvabaodhankar/erc4337-kit/issues
- 💬 Discussions: https://github.com/atharvabaodhankar/erc4337-kit/discussions

---

## License

MIT © Atharva Baodhankar
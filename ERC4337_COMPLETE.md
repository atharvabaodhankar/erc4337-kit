# ERC-4337 Complete Guide

> Everything you need to understand ERC-4337 Account Abstraction — the standard, the components, how `erc4337-kit` implements it, and how to use it confidently in any app.

---

## Table of contents

1. [What problem ERC-4337 solves](#1-what-problem-erc-4337-solves)
2. [The five components of ERC-4337](#2-the-five-components-of-erc-4337)
3. [What a UserOperation is](#3-what-a-useroperation-is)
4. [The complete transaction flow](#4-the-complete-transaction-flow)
5. [How erc4337-kit maps to the standard](#5-how-erc4337-kit-maps-to-the-standard)
6. [Writing ERC-4337-compatible Solidity contracts](#6-writing-erc-4337-compatible-solidity-contracts)
7. [Using smartAccountClient correctly](#7-using-smartaccountclient-correctly)
8. [Reading vs writing — the pattern difference](#8-reading-vs-writing--the-pattern-difference)
9. [What the data looks like end to end](#9-what-the-data-looks-like-end-to-end)
10. [Error codes and what they mean](#10-error-codes-and-what-they-mean)
11. [Key concepts that trip people up](#11-key-concepts-that-trip-people-up)
12. [Environment variables and where they go](#12-environment-variables-and-where-they-go)
13. [Chain IDs and network config](#13-chain-ids-and-network-config)
14. [Production readiness](#14-production-readiness)

---

## 1. What problem ERC-4337 solves

Traditional Ethereum requires every user to:

1. Download a wallet extension (MetaMask)
2. Generate a private key and write down a seed phrase
3. Acquire native tokens (ETH, MATIC) before they can do anything
4. Pay gas fees every single transaction
5. Lose everything if they lose the seed phrase

This is a catastrophic UX barrier. 92% of users abandon a flow that requires MetaMask for a single use case.

ERC-4337 (published 2021, widely deployed 2023) is an Ethereum standard that adds **Account Abstraction** — the ability to use smart contracts as wallets — without changing the Ethereum protocol itself. It enables:

- Social login (Google, email) instead of seed phrases
- Zero gas fees for users (you sponsor them as the app developer)
- Automatic wallet creation on first login
- Programmable transaction rules (spending limits, session keys, multi-sig)
- Account recovery via email instead of seed phrases

**The tradeoff:** You (the app developer) pay gas fees on behalf of your users, via a Paymaster service. On testnets this is free. On mainnet it costs fractions of a cent per transaction on Polygon, slightly more on Ethereum.

---

## 2. The five components of ERC-4337

Every ERC-4337 system has five parts. You need to understand each one.

### EntryPoint contract

A single, globally deployed smart contract at `0x0000000071727De22E5E9d8BAf0edAc6f37da032` (EntryPoint v0.7). This is the same address on every EVM chain. It is the only contract in the standard that handles actual execution — your contract and the smart account all route through it. You never deploy it yourself; it already exists.

The EntryPoint:
- Receives UserOperations from bundlers
- Verifies the smart account's signature
- Calls the paymaster to sponsor gas
- Executes your contract function
- Handles nonces and replay protection

### Smart Account (SA)

A smart contract deployed per user. In `erc4337-kit`, it uses the **Simple Smart Account** type from Permissionless. Key properties:

- Deterministic address: given the same owner (the Privy embedded wallet), the same smart account address is always produced. The user doesn't need to "create" it — it can even receive funds before it's deployed.
- Gets deployed on first transaction, not on login. Before the first tx, the SA technically doesn't exist on-chain yet — but its address is already known.
- `msg.sender` in your contract will always be this SA address, not the user's EOA.

### Bundler

A service that collects UserOperations from apps, packs them into batches, and submits them to the EntryPoint. `erc4337-kit` uses **Pimlico** as the bundler. Pimlico's API is at:

```
https://api.pimlico.io/v2/{chainId}/rpc?apikey={YOUR_KEY}
```

The bundler is essentially the "mempool" for UserOperations. It's separate from the normal Ethereum mempool.

### Paymaster

A smart contract (usually operated by Pimlico) that vouches for and pays the gas fees for a UserOperation. When a paymaster signs a UserOp, it's promising the EntryPoint: "I will cover the gas cost for this operation." Your Pimlico API key links to a paymaster that has a funded balance. The user never needs MATIC.

On Pimlico's free tier, testnet gas sponsorship is unlimited. Mainnet requires a paid plan.

### Your contract

The business logic. Completely standard Solidity. ERC-4337 requires no special interface, no inheritance, no modifiers in your contract. The only thing that changes is who `msg.sender` is (the Smart Account, not the EOA).

---

## 3. What a UserOperation is

A UserOperation (UserOp) is a signed object that represents an intent — "the owner of this smart account wants to call this function." It is NOT a regular Ethereum transaction.

A UserOp has these fields:

```js
{
  sender:               "0x9f3a...c821",  // the Smart Account address
  nonce:                "0x1",            // SA's transaction counter
  callData:             "0xa1b2...",      // encoded function call (to + data)
  callGasLimit:         "0x12345",        // gas for the actual call
  verificationGasLimit: "0x23456",        // gas for signature verification
  preVerificationGas:   "0x5000",         // bundler overhead gas
  maxFeePerGas:         "0x...",          // gas price
  maxPriorityFeePerGas: "0x...",
  paymasterAndData:     "0xPimlico...",   // paymaster address + signature
  signature:            "0xowner_sig...", // signed by embedded wallet
}
```

`callData` is the part your app controls. It encodes: `to` (your contract address) + `data` (the encoded function call).

The flow is: your app creates the callData → Pimlico estimates gas and fills in gas fields → Pimlico's paymaster signs `paymasterAndData` → the user's embedded wallet signs `signature` → the bundler submits the whole thing to the EntryPoint.

`erc4337-kit` handles all of this. You only provide the contract address, ABI, function name, and args.

---

## 4. The complete transaction flow

Here is exactly what happens when a user submits data in an app using `erc4337-kit`:

```
User clicks "Submit"
│
├─ sha256Hash() runs in browser
│   Input:  '{"description":"incident","timestamp":1742810000}'
│   Output: '0x7f3a9b...c821e4'  (bytes32)
│
├─ useStoreOnChain.submit([hash]) called
│   │
│   ├─ encodeFunctionData()
│   │   Encodes: storeRecord(0x7f3a...) → calldata bytes
│   │
│   ├─ smartAccountClient.sendTransaction({ to, data: calldata, value: 0n })
│   │   │
│   │   ├─ Builds UserOperation
│   │   │   sender = smartAccountAddress (0x9f3a...)
│   │   │   callData = calldata
│   │   │   nonce = current SA nonce
│   │   │
│   │   ├─ Calls Pimlico: eth_estimateUserOperationGas
│   │   │   Fills in: callGasLimit, verificationGasLimit, preVerificationGas
│   │   │
│   │   ├─ Calls Pimlico paymaster: pm_sponsorUserOperation
│   │   │   Returns: paymasterAndData (paymaster's sponsorship signature)
│   │   │
│   │   ├─ Pimlico returns current gas price (maxFeePerGas)
│   │   │
│   │   ├─ Embedded wallet signs the UserOp
│   │   │   signature = sign(userOpHash, embeddedWalletPrivateKey)
│   │   │
│   │   └─ Sends to bundler: eth_sendUserOperation
│   │
│   └─ Bundler submits to EntryPoint on Polygon Amoy
│       │
│       ├─ EntryPoint verifies SA signature
│       ├─ EntryPoint calls paymaster to check + deduct gas
│       ├─ EntryPoint calls SA.execute(to, value, data)
│       └─ SA calls YourContract.storeRecord(0x7f3a...)
│
├─ txHash returned: '0xd4e3f1...8901'
│
└─ waitForTransactionReceipt({ hash })
    Returns: receipt with logs
    Log[0].topics[1] = recordId (bytes32)
```

**Total time:** 3–8 seconds on Polygon Amoy.
**User gas cost:** $0.00. Pimlico's paymaster pays.

---

## 5. How erc4337-kit maps to the standard

```
ERC-4337 Component      →  erc4337-kit handles this via
─────────────────────────────────────────────────────────────
EntryPoint (v0.7)       →  entryPoint07Address (viem constant)
                            Hard-coded in useSmartAccount, no config needed

Smart Account           →  toSimpleSmartAccount() from permissionless
                            Created in useSmartAccount()
                            Returns: smartAccountAddress, smartAccountClient

Bundler                 →  Pimlico (https://api.pimlico.io/v2/{chainId}/rpc)
                            Uses your VITE_PIMLICO_API_KEY
                            Called by smartAccountClient internally

Paymaster               →  createPimlicoClient() from permissionless/clients/pimlico
                            Attached to smartAccountClient as paymaster:
                            Every sendTransaction() auto-requests sponsorship

Your contract           →  You write and deploy this (BaseStorage.sol is a template)
                            Passed to useStoreOnChain() as contractAddress + abi

Auth (embedded wallet)  →  Privy (@privy-io/react-auth)
                            The embedded wallet is the SA "owner"
                            createOnLogin: 'all-users' creates it automatically
```

---

## 6. Writing ERC-4337-compatible Solidity contracts

Your contract requires **zero special code** for ERC-4337. Write standard Solidity. But there are four rules to understand.

### Rule 1: `msg.sender` is the Smart Account, not the user's EOA

```solidity
// msg.sender here is the user's Smart Account (e.g. 0x9f3a...c821)
// It is NOT their original Google/email wallet address
mapping(address => bytes32[]) private _records;

function storeRecord(bytes32 dataHash) external {
    _records[msg.sender].push(dataHash);  // ← correct: SA address
}
```

This is consistent across every session — the same user always has the same SA address. Don't fight this; embrace it. Your frontend reads `smartAccountAddress` from `useSmartAccount()` and uses that as the user identifier.

### Rule 2: Don't use `block.timestamp` for security-critical logic

`block.timestamp` is fine for display, sorting, and approximate timing. But bundlers can vary it by up to ~15 seconds. Never use it for "this action must happen within 10 seconds" type logic.

### Rule 3: Keep functions gas-efficient

Paymasters have a gas limit per UserOperation. Writing to storage is the expensive operation (~20,000 gas per slot). As a rough guide: a function that writes to 3–5 storage slots and emits one event is well within limits. Functions that loop over unbounded arrays will get UserOps rejected.

### Rule 4: Use `revert` with custom errors, not `require(string)`

```solidity
// ✅ Custom errors — cheaper gas, better UX
error RecordNotFound(bytes32 id);
if (!_records[id].exists) revert RecordNotFound(id);

// ❌ String requires — wastes gas the paymaster is paying for
require(_records[id].exists, "Record not found");
```

### Minimal working contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract YourApp {
    struct Record {
        bytes32 dataHash;
        uint256 timestamp;
        address submitter;   // the Smart Account address (msg.sender)
        bool exists;
    }

    mapping(bytes32 => Record) private _records;
    mapping(address => bytes32[]) private _bySubmitter;

    event RecordStored(bytes32 indexed id, bytes32 indexed dataHash, address indexed submitter);

    error RecordAlreadyExists(bytes32 id);
    error RecordNotFound(bytes32 id);

    function storeRecord(bytes32 dataHash) external returns (bytes32 id) {
        id = keccak256(abi.encodePacked(dataHash, block.timestamp, msg.sender));
        if (_records[id].exists) revert RecordAlreadyExists(id);

        _records[id] = Record(dataHash, block.timestamp, msg.sender, true);
        _bySubmitter[msg.sender].push(id);

        emit RecordStored(id, dataHash, msg.sender);
    }

    function getRecord(bytes32 id) external view returns (bytes32 dataHash, uint256 timestamp, address submitter) {
        if (!_records[id].exists) revert RecordNotFound(id);
        Record storage r = _records[id];
        return (r.dataHash, r.timestamp, r.submitter);
    }

    function verifyRecord(bytes32 id, bytes32 dataHash) external view returns (bool) {
        if (!_records[id].exists) return false;
        return _records[id].dataHash == dataHash;
    }

    function getMyRecords() external view returns (bytes32[] memory) {
        return _bySubmitter[msg.sender];
    }
}
```

### Deploying the contract

Option A — Remix IDE (no setup, good for testing):
1. Go to [remix.ethereum.org](https://remix.ethereum.org)
2. Create a new file, paste your contract
3. Compile with Solidity 0.8.20
4. Deploy to "Injected Provider" (MetaMask) on Polygon Amoy
5. Copy the deployed address

Option B — deploy script (from the test app):

```bash
# Install deployment deps
npm install --save-dev dotenv solc

# Your deploy script at scripts/deploy.js:
# (see IMPLEMENTATION_GUIDE.md in the test app for the full script)
npm run deploy
```

The deploy script compiles your `.sol`, deploys via viem's `walletClient.deployContract`, and saves the address to `.env` automatically.

---

## 7. Using `smartAccountClient` correctly

`smartAccountClient` is a viem `SmartAccountClient`. It behaves like a normal viem `WalletClient` for most things, but transaction submission goes through the ERC-4337 pipeline instead of directly to the chain.

### Sending transactions (write operations)

**Always use `sendTransaction` with `encodeFunctionData`:**

```js
import { encodeFunctionData } from 'viem'

// Step 1: encode the function call into calldata
const calldata = encodeFunctionData({
  abi: contractABI,       // the full ABI array, or just the function you need
  functionName: 'addTodo',
  args: ['buy groceries'],
})

// Step 2: send as a transaction
const hash = await smartAccountClient.sendTransaction({
  to: contractAddress,
  data: calldata,
  value: 0n,             // 0n = BigInt(0). Use this unless you're sending ETH/MATIC
})

// Step 3 (optional): wait for confirmation
const receipt = await smartAccountClient.waitForTransactionReceipt({ hash })
```

**Never use `writeContract`:**

```js
// ❌ This throws: account.encodeCalls is not a function
await smartAccountClient.writeContract({
  address: contractAddress,
  abi: contractABI,
  functionName: 'addTodo',
  args: ['buy groceries'],
})
```

`writeContract` is a viem helper that calls `account.encodeCalls()` internally. The `SmartAccountClient` account object doesn't implement that method — it's specific to regular EOA accounts.

### Waiting for receipts

The `sendTransaction` on a `SmartAccountClient` returns the **on-chain transaction hash** (not the UserOperation hash). You can use it directly:

```js
const hash = await smartAccountClient.sendTransaction({ ... })
// hash is a real 0x... tx hash, visible on Polygonscan

const receipt = await smartAccountClient.waitForTransactionReceipt({ hash })
// receipt.logs contains your contract's emitted events
// receipt.status is 'success' or 'reverted'
```

### Transaction status pattern

For any write operation in your UI:

```js
const [status, setStatus] = useState('idle') // 'idle' | 'pending' | 'success' | 'error'
const [txHash, setTxHash] = useState(null)
const [error, setError] = useState(null)

const handleSubmit = async () => {
  setStatus('pending')
  setError(null)
  try {
    const calldata = encodeFunctionData({ abi, functionName, args })
    const hash = await smartAccountClient.sendTransaction({ to, data: calldata, value: 0n })
    setTxHash(hash)
    await smartAccountClient.waitForTransactionReceipt({ hash })
    setStatus('success')
  } catch (err) {
    setError(err.message)
    setStatus('error')
  }
}
```

### Batch transactions (advanced)

The smart account can execute multiple contract calls in a single UserOperation:

```js
const hash = await smartAccountClient.sendUserOperation({
  calls: [
    { to: contractA, data: calldataA, value: 0n },
    { to: contractB, data: calldataB, value: 0n },
  ],
})
```

This is one of ERC-4337's key advantages — one gas sponsorship, two on-chain actions atomically.

---

## 8. Reading vs writing — the pattern difference

Reading from the blockchain doesn't require a smart account. Use a standard viem `publicClient`:

```js
import { createPublicClient, http } from 'viem'
import { polygonAmoy } from 'erc4337-kit'

// Create this once, outside your component (or in a module)
const publicClient = createPublicClient({
  chain: polygonAmoy,
  transport: http(import.meta.env.VITE_RPC_URL),
})
```

**Reading is free — no gas, no Pimlico, no smart account needed.**

```js
// Reading public data (no account needed)
const totalRecords = await publicClient.readContract({
  address: contractAddress,
  abi: contractABI,
  functionName: 'totalRecords',
  args: [],
})

// Reading user-specific data (account required for msg.sender simulation)
const myRecords = await publicClient.readContract({
  address: contractAddress,
  abi: contractABI,
  functionName: 'getMyRecords',
  args: [],
  account: smartAccountAddress,  // ← tells viem to simulate as this address
})
```

The `account` parameter in `readContract` doesn't send a transaction. It tells viem to simulate the call as if `msg.sender` were `smartAccountAddress`. Without it, `msg.sender` is `0x0000...0000` and your user-specific mappings return empty data.

### After a write, refresh reads with a delay

After submitting a transaction, the blockchain needs a few seconds to finalize. If you immediately re-read, you get stale data:

```js
const addRecord = async () => {
  const hash = await smartAccountClient.sendTransaction({ ... })
  await smartAccountClient.waitForTransactionReceipt({ hash })
  // Now it's confirmed — safe to refresh
  await loadRecords()
}
```

Or, if you don't want to block on `waitForTransactionReceipt`, use a timeout:

```js
setTimeout(loadRecords, 3000)  // 3s is usually enough on Polygon Amoy
```

---

## 9. What the data looks like end to end

Here is a complete end-to-end data trace for a women's safety incident report app.

**Step 1 — User fills the form:**
```js
const report = {
  description: "Harassment at Gandhi Chowk",
  category: "verbal",
  timestamp: 1742810000000,
  // location is NOT included here — stored separately, not on-chain
}
```

**Step 2 — Hash locally:**
```js
const hash = await sha256Hash(JSON.stringify(report))
// → '0x7f3a9b4c2d1e8fa6b5c9d3e2f1a0b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1'
// This is 66 characters: '0x' + 64 hex chars = 32 bytes = bytes32
```

**Step 3 — Submit to contract:**
```js
await submit([hash])
// Internally calls: storeRecord('0x7f3a...')
// Gas: paid by Pimlico paymaster
// Time: 3-8 seconds
```

**Step 4 — What gets stored on-chain:**
```
Polygon Amoy blockchain, block #12345678:

Contract: 0xEC42...9138
Function: storeRecord(bytes32 dataHash)

Storage written:
  _records[0x3ea1c0...f1655] = {
    dataHash:  0x7f3a9b...e3f2a1,   ← the SHA-256 hash
    timestamp: 1742810000,           ← block.timestamp (Unix seconds)
    submitter: 0x9f3a...c821,        ← smart account address
    exists:    true
  }
  _bySubmitter[0x9f3a...c821] pushed: 0x3ea1c0...f1655

Event emitted:
  RecordStored(
    id:        0x3ea1c0...f1655,   ← the unique record ID
    dataHash:  0x7f3a9b...e3f2a1,
    submitter: 0x9f3a...c821
  )
```

**Step 5 — What your app receives:**
```js
txHash:   '0xd4e3f1a2b5c6...8901'   // view on amoy.polygonscan.com/tx/0xd4e3...
recordId: '0x3ea1c0...f1655'         // decoded from receipt.logs[0].topics[1]
```

**Step 6 — Store in your database:**
```js
await db.incidents.create({
  userId:      privyUser.id,
  recordId:    recordId,          // ← the on-chain ID
  dataHash:    hash,              // ← to verify later
  txHash:      txHash,
  description: report.description,  // ← the actual data (in your DB, not on-chain)
  createdAt:   new Date(),
})
```

**Step 7 — Later, verification:**
```js
// Does this incident exist on-chain and has it not been tampered with?
const isValid = await publicClient.readContract({
  address: contractAddress,
  abi: contractABI,
  functionName: 'verifyRecord',
  args: [recordId, hash],  // hash comes from your DB
})
// → true if authentic, false if tampered or not found
```

---

## 10. Error codes and what they mean

These are bundler and EntryPoint error codes you may encounter. `erc4337-kit` translates these into English automatically in the `error` field returned by `useStoreOnChain`.

| Code | Meaning | Fix |
|------|---------|-----|
| `AA21` | Paymaster didn't pay prefund (rejected sponsorship) | Check Pimlico API key; enable Polygon Amoy in dashboard |
| `AA31` | Paymaster out of funds | Add funds to Pimlico dashboard paymaster balance |
| `AA23` | Invalid UserOp signature | Log out and back in — embedded wallet may have reset |
| `AA25` | Invalid nonce | Previous UserOp still pending — wait 30–60s and retry |
| `AA13` | Init code failed (SA deployment failed) | RPC URL is wrong or unreachable |
| `AA40` | Call reverted on-chain | Your contract function threw a revert — check your Solidity logic |
| `AA95` | Gas too low | Contract function is too expensive for the paymaster policy |

If `erc4337-kit`'s error message doesn't match one of these, the raw error is passed through as-is. Always `console.error(err)` in a catch block during development to see the full stack.

---

## 11. Key concepts that trip people up

### The Smart Account doesn't exist on-chain until the first transaction

When `useSmartAccount()` returns `smartAccountAddress`, that address is computed deterministically — but the contract isn't deployed yet. It deploys during the first `sendTransaction`. This is called "counterfactual deployment." After the first tx, it exists permanently.

Implication: you can tell users their address before they've ever transacted. It's safe to store in your database immediately.

### `isReady` vs `authenticated`

- `authenticated` = the user has logged in with Privy (they have an embedded wallet)
- `isReady` = the smart account client has been fully initialized and is ready to send transactions

There's a gap between these two — typically 1–3 seconds while Permissionless builds the smart account client. Always gate transaction UI on `isReady`, not `authenticated`.

```jsx
// ✅ Correct
{isReady && <button onClick={sendTx}>Submit</button>}

// ❌ Wrong — smartAccountClient is null here
{authenticated && <button onClick={sendTx}>Submit</button>}
```

### Smart Account addresses are different from EOA addresses

```
User logs in with Google
  → Privy creates embedded wallet: EOA 0xABCD...1234
  → Permissionless creates Smart Account: SA 0x9f3a...c821

These are two different addresses.
Your contract sees: msg.sender = 0x9f3a...c821 (the SA)
Your frontend gets: smartAccountAddress = '0x9f3a...c821'

The EOA (0xABCD...1234) is the SA's "owner" key.
You almost never need the EOA address directly.
```

### BigInt for value and uint256

Solidity `uint256` maps to JavaScript `BigInt`. Always use `0n` (not `0`) for the `value` field:

```js
// ✅
await smartAccountClient.sendTransaction({ to, data, value: 0n })

// ❌ Will throw a type error
await smartAccountClient.sendTransaction({ to, data, value: 0 })
```

When passing `uint256` args to `encodeFunctionData`:
```js
encodeFunctionData({
  abi: [...],
  functionName: 'toggleTodo',
  args: [BigInt(index)],   // ← index from array, must be BigInt
})
```

### The polyfills must load before your app

The `<script type="module">` block in `index.html` that sets `window.Buffer` and `window.process` must come before `<script type="module" src="/src/main.jsx">`. Module scripts load in order. If your app code loads first, viem will throw `Buffer is not defined` before the polyfill has a chance to run.

---

## 12. Environment variables and where they go

| Variable | Who needs it | Side | Where to get it |
|---------|-------------|------|----------------|
| `VITE_PRIVY_APP_ID` | `ChainProvider` | Frontend (public) | [dashboard.privy.io](https://dashboard.privy.io) → App → Settings |
| `VITE_PIMLICO_API_KEY` | `useSmartAccount` | Frontend (public) | [dashboard.pimlico.io](https://dashboard.pimlico.io) → API Keys |
| `VITE_RPC_URL` | `ChainProvider`, `useSmartAccount`, `publicClient` | Frontend (public) | [dashboard.alchemy.com](https://dashboard.alchemy.com) → App → Polygon Amoy → HTTPS |
| `VITE_CONTRACT_ADDRESS` | `useStoreOnChain` | Frontend (public) | Your deployment output |
| `PRIVATE_KEY` | Deployment script only | Server / local only | Your MetaMask/hardware wallet |

`VITE_` prefix means Vite will embed this into the client bundle. Any `VITE_` variable is readable by anyone viewing your page source. This is fine for Privy App IDs and Pimlico keys — they're designed to be public (Privy has domain whitelisting; Pimlico keys are rate-limited).

**Never** put `PRIVATE_KEY` with a `VITE_` prefix. Deployment scripts run in Node.js, not the browser. Use `process.env.PRIVATE_KEY` in deploy scripts.

`.env` file structure:

```env
# ─── Frontend (safe to embed in bundle) ───────────────
VITE_PRIVY_APP_ID=cmn2qglfh000b0cjnfr8h9vkv
VITE_PIMLICO_API_KEY=pim_Aa7pQDAjz7YvQXZ1QgNn99
VITE_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_CONTRACT_ADDRESS=0xEC42312e7C88C0A9a85148405F0636aF26959138

# ─── Server only (NEVER prefix with VITE_) ────────────
PRIVATE_KEY=0xyour_deployer_wallet_private_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key_for_contract_verification
```

---

## 13. Chain IDs and network config

| Chain | ID | Explorer | Faucet | Pimlico support |
|-------|----|----------|--------|-----------------|
| Polygon Amoy | 80002 | [amoy.polygonscan.com](https://amoy.polygonscan.com) | [faucet.polygon.technology](https://faucet.polygon.technology) | ✅ Free tier |
| Polygon Mainnet | 137 | [polygonscan.com](https://polygonscan.com) | — | ✅ Paid |
| Sepolia | 11155111 | [sepolia.etherscan.io](https://sepolia.etherscan.io) | [sepoliafaucet.com](https://sepoliafaucet.com) | ✅ Free tier |
| Base Sepolia | 84532 | [sepolia.basescan.org](https://sepolia.basescan.org) | [bridge.base.org](https://bridge.base.org/deposit) | ✅ Free tier |
| Ethereum Mainnet | 1 | [etherscan.io](https://etherscan.io) | — | ✅ Paid |

The Pimlico URL pattern is always:
```
https://api.pimlico.io/v2/{chainId}/rpc?apikey={YOUR_KEY}
```

`erc4337-kit` builds this internally from the chain you pass to `useSmartAccount`. You don't need to construct it yourself.

### Switching from testnet to mainnet

Only two things change:

1. `chain`: change `polygonAmoy` to `polygon`
2. `rpcUrl`: point to your Alchemy/Infura Polygon mainnet app
3. Redeploy your contract to mainnet and update `VITE_CONTRACT_ADDRESS`
4. Upgrade Pimlico to a paid plan (testnet is free, mainnet isn't)

```jsx
// Testnet
<ChainProvider chain={polygonAmoy} rpcUrl={process.env.VITE_AMOY_RPC} ... />

// Mainnet — only these two props change
<ChainProvider chain={polygon} rpcUrl={process.env.VITE_POLYGON_RPC} ... />
```

---

## 14. Production readiness

### Before shipping to mainnet

- [ ] Contract audited or reviewed by a second developer
- [ ] Tested all contract functions on Polygon Amoy with real transactions
- [ ] Tested logout + re-login — smart account address must be the same
- [ ] Tested error states: what does your UI show when Pimlico is down?
- [ ] Pimlico upgraded from free tier
- [ ] `PRIVATE_KEY` is NOT in any file that gets pushed to git
- [ ] `.env` is in `.gitignore`
- [ ] Contract verified on Polygonscan (optional but professional)

### Monitoring

Watch your Pimlico dashboard for:
- Failed UserOperations (and what AA code they failed with)
- Paymaster balance (set a refill threshold alert)
- Submission latency (should be < 10s on Polygon Amoy)

### Gas cost estimation for Polygon mainnet

Each `storeRecord()` call (one storage slot write + one event emit) costs roughly:
- ~70,000 gas
- At 50 gwei gas price: 70,000 × 50 × 10⁻⁹ MATIC ≈ 0.0035 MATIC ≈ $0.002 USD

This is what you (the app) pay per user transaction. 1,000 user submissions/month ≈ $2/month on Polygon mainnet.

---

## Quick reference

```
Package:          erc4337-kit
EntryPoint:       0x0000000071727De22E5E9d8BAf0edAc6f37da032 (v0.7, all chains)
Chain IDs:        Amoy=80002, Polygon=137, Sepolia=11155111
SA Type:          SimpleSmartAccount (permissionless)

Write txs:        smartAccountClient.sendTransaction({ to, data: calldata, value: 0n })
Encode calldata:  encodeFunctionData({ abi, functionName, args }) from 'viem'
Read contract:    publicClient.readContract({ ..., account: smartAccountAddress })
Hash data:        sha256Hash(string) from 'erc4337-kit'

Critical rules:
  1. Use sendTransaction, NOT writeContract
  2. msg.sender in Solidity = Smart Account address
  3. Always pass account: smartAccountAddress to readContract for user data
  4. Gate UI on isReady, not authenticated
  5. value must be 0n (BigInt), not 0
  6. uint256 args must be BigInt(n), not n

Error lookup:
  AA21 = paymaster key wrong or chain not enabled
  AA31 = paymaster balance empty
  AA23 = wallet signature invalid (re-login)
  AA25 = nonce conflict (wait and retry)
```

---

## External resources

| Resource | URL |
|---------|-----|
| ERC-4337 specification | https://eips.ethereum.org/EIPS/eip-4337 |
| Privy documentation | https://docs.privy.io |
| Pimlico documentation | https://docs.pimlico.io |
| Permissionless.js docs | https://docs.pimlico.io/permissionless |
| Viem documentation | https://viem.sh |
| Polygon Amoy explorer | https://amoy.polygonscan.com |
| JiffyScan (UserOp explorer) | https://jiffyscan.xyz |
| Remix IDE | https://remix.ethereum.org |
| Polygon faucet | https://faucet.polygon.technology |

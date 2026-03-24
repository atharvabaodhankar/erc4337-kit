# Testing erc4337-kit in a Real App

## 🎯 Complete Setup Guide

This guide will walk you through testing your published `erc4337-kit` package in a fresh React app.

---

## Step 1: Create a New React App

```bash
# Create a new Vite + React project
npm create vite@latest test-erc4337-app -- --template react

# Navigate into the project
cd test-erc4337-app
```

---

## Step 2: Install Dependencies

```bash
# Install erc4337-kit (your published package!)
npm install erc4337-kit

# Install peer dependencies
npm install @privy-io/react-auth @privy-io/wagmi viem wagmi @tanstack/react-query

# Install React (if not already installed)
npm install react react-dom

# Install polyfills for browser
npm install buffer process
```

---

## Step 3: Configure Vite

Update `vite.config.js`:

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      '@noble/curves/nist.js': '@noble/curves/nist',
    },
  },
})
```

---

## Step 4: Add Browser Polyfills

Update `index.html` - add this in the `<head>` section BEFORE your app script:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Test ERC4337 Kit</title>
    
    <!-- ADD THIS BEFORE YOUR APP SCRIPT -->
    <script type="module">
      import { Buffer } from 'buffer'
      import process from 'process'
      window.Buffer = Buffer
      window.process = process
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

---

## Step 5: Get API Keys

### 5.1 Privy App ID
1. Go to https://dashboard.privy.io/
2. Sign up / Log in
3. Create a new app
4. Copy your App ID (looks like: `cmn2qglfh000b0cjnfr8h9vkv`)

### 5.2 Pimlico API Key
1. Go to https://dashboard.pimlico.io/
2. Sign up / Log in
3. Create a new project
4. Copy your API Key (looks like: `pim_Aa7pQDAjz7YvQXZ1QgNn99`)
5. Make sure Polygon Amoy testnet is enabled

### 5.3 Alchemy RPC URL
1. Go to https://dashboard.alchemy.com/
2. Sign up / Log in
3. Create a new app
4. Select "Polygon Amoy" as the network
5. Copy your HTTPS URL (looks like: `https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY`)

### 5.4 Deploy Test Contract (Optional)
If you want to test on-chain storage:
1. Copy `node_modules/erc4337-kit/src/contracts/BaseStorage.sol`
2. Deploy to Polygon Amoy using Remix or Hardhat
3. Copy the deployed contract address

---

## Step 6: Create Environment File

Create `.env` in your project root:

```bash
# Privy Configuration
VITE_PRIVY_APP_ID=your_privy_app_id_here

# Pimlico Configuration
VITE_PIMLICO_API_KEY=your_pimlico_api_key_here

# RPC Provider
VITE_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY

# Smart Contract (optional - only if you deployed BaseStorage.sol)
VITE_CONTRACT_ADDRESS=0xYourContractAddressHere
```

**Important**: Replace all placeholder values with your actual API keys!

---

## Step 7: Update main.jsx

Replace `src/main.jsx` with:

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ChainProvider, polygonAmoy } from 'erc4337-kit'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ChainProvider
      privyAppId={import.meta.env.VITE_PRIVY_APP_ID}
      chain={polygonAmoy}
      rpcUrl={import.meta.env.VITE_RPC_URL}
      loginMethods={['google', 'email']}
      appearance={{
        theme: 'dark',
        accentColor: '#7c3aed',
      }}
    >
      <App />
    </ChainProvider>
  </React.StrictMode>,
)
```

---

## Step 8: Create Test Component

Replace `src/App.jsx` with:

```jsx
import { useState } from 'react'
import { useSmartAccount, useStoreOnChain, sha256Hash, polygonAmoy } from 'erc4337-kit'
import './App.css'

// Example ABI for BaseStorage.sol
const STORAGE_ABI = [
  {
    name: 'storeRecord',
    type: 'function',
    inputs: [{ name: 'dataHash', type: 'bytes32' }],
    outputs: [{ name: 'id', type: 'bytes32' }],
  },
]

function App() {
  const [testData, setTestData] = useState('')
  const [hashResult, setHashResult] = useState('')

  // Initialize Smart Account
  const {
    login,
    logout,
    authenticated,
    user,
    smartAccountAddress,
    smartAccountClient,
    isReady,
    isLoading,
    error,
  } = useSmartAccount({
    pimlicoApiKey: import.meta.env.VITE_PIMLICO_API_KEY,
    rpcUrl: import.meta.env.VITE_RPC_URL,
    chain: polygonAmoy,
  })

  // Initialize on-chain storage hook (only if you have a contract deployed)
  const {
    submit,
    txHash,
    recordId,
    isLoading: isSubmitting,
    error: submitError,
  } = useStoreOnChain({
    smartAccountClient,
    contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS,
    abi: STORAGE_ABI,
    functionName: 'storeRecord',
  })

  // Test hash function
  const handleHash = async () => {
    if (!testData) {
      alert('Please enter some data to hash')
      return
    }
    const hash = await sha256Hash(testData)
    setHashResult(hash)
  }

  // Test on-chain storage
  const handleStoreOnChain = async () => {
    if (!hashResult) {
      alert('Please hash some data first')
      return
    }
    if (!import.meta.env.VITE_CONTRACT_ADDRESS) {
      alert('No contract address configured. Set VITE_CONTRACT_ADDRESS in .env')
      return
    }
    await submit([hashResult])
  }

  return (
    <div className="App">
      <h1>🧪 Testing erc4337-kit</h1>

      {/* Authentication Section */}
      <div className="card">
        <h2>1. Authentication</h2>
        {!authenticated ? (
          <button onClick={login}>Login with Google/Email</button>
        ) : (
          <div>
            <p>✅ Logged in as: {user?.email?.address || user?.google?.email}</p>
            <button onClick={logout}>Logout</button>
          </div>
        )}
      </div>

      {/* Smart Account Section */}
      {authenticated && (
        <div className="card">
          <h2>2. Smart Account</h2>
          {isLoading && <p>⏳ Setting up your Smart Account...</p>}
          {error && <p style={{ color: 'red' }}>❌ Error: {error}</p>}
          {isReady && (
            <div>
              <p>✅ Smart Account Ready!</p>
              <p style={{ fontSize: '0.9em', wordBreak: 'break-all' }}>
                Address: {smartAccountAddress}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Hash Function Test */}
      {isReady && (
        <div className="card">
          <h2>3. Test Hash Function</h2>
          <input
            type="text"
            value={testData}
            onChange={(e) => setTestData(e.target.value)}
            placeholder="Enter data to hash"
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
          />
          <button onClick={handleHash}>Generate SHA-256 Hash</button>
          {hashResult && (
            <div style={{ marginTop: '10px' }}>
              <p>✅ Hash generated:</p>
              <code style={{ fontSize: '0.8em', wordBreak: 'break-all' }}>
                {hashResult}
              </code>
            </div>
          )}
        </div>
      )}

      {/* On-Chain Storage Test */}
      {isReady && hashResult && import.meta.env.VITE_CONTRACT_ADDRESS && (
        <div className="card">
          <h2>4. Test Gasless Transaction</h2>
          <button onClick={handleStoreOnChain} disabled={isSubmitting}>
            {isSubmitting ? 'Storing on-chain...' : 'Store Hash On-Chain (Gasless!)'}
          </button>
          {submitError && (
            <p style={{ color: 'red' }}>❌ Error: {submitError}</p>
          )}
          {txHash && (
            <div style={{ marginTop: '10px' }}>
              <p>✅ Transaction successful!</p>
              <p style={{ fontSize: '0.9em' }}>
                Tx Hash:{' '}
                <a
                  href={`https://amoy.polygonscan.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </a>
              </p>
              {recordId && (
                <p style={{ fontSize: '0.9em' }}>
                  Record ID: {recordId.slice(0, 10)}...{recordId.slice(-8)}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Test Results Summary */}
      <div className="card">
        <h2>✅ Test Checklist</h2>
        <ul style={{ textAlign: 'left' }}>
          <li>{authenticated ? '✅' : '⬜'} Authentication works</li>
          <li>{isReady ? '✅' : '⬜'} Smart Account created</li>
          <li>{hashResult ? '✅' : '⬜'} Hash function works</li>
          <li>{txHash ? '✅' : '⬜'} Gasless transaction works</li>
        </ul>
      </div>
    </div>
  )
}

export default App
```

---

## Step 9: Update CSS (Optional)

Update `src/App.css` for better styling:

```css
#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.card {
  padding: 2em;
  margin: 1em 0;
  border: 1px solid #646cff;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
}

button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #7c3aed;
  cursor: pointer;
  transition: border-color 0.25s;
  margin: 0.5em;
}

button:hover {
  border-color: #646cff;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

input {
  border-radius: 8px;
  border: 1px solid #646cff;
  padding: 0.6em;
  font-size: 1em;
  background: rgba(255, 255, 255, 0.1);
  color: inherit;
}

code {
  background: rgba(0, 0, 0, 0.3);
  padding: 0.5em;
  border-radius: 4px;
  display: block;
  margin-top: 0.5em;
}

a {
  color: #7c3aed;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}
```

---

## Step 10: Run the App

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

---

## 🧪 Testing Checklist

### Test 1: Package Installation ✅
- [ ] `npm install erc4337-kit` worked without errors
- [ ] All peer dependencies installed

### Test 2: Imports ✅
- [ ] `ChainProvider` imports correctly
- [ ] `useSmartAccount` imports correctly
- [ ] `useStoreOnChain` imports correctly
- [ ] `sha256Hash` imports correctly
- [ ] `polygonAmoy` imports correctly

### Test 3: Authentication ✅
- [ ] Login button appears
- [ ] Google/Email login works
- [ ] User info displays after login
- [ ] Logout works

### Test 4: Smart Account ✅
- [ ] Smart Account initializes automatically
- [ ] Smart Account address displays
- [ ] No errors in console
- [ ] Loading state shows during initialization

### Test 5: Hash Function ✅
- [ ] Can enter text
- [ ] Hash generates correctly
- [ ] Hash starts with "0x"
- [ ] Hash is 66 characters long
- [ ] Same input produces same hash

### Test 6: Gasless Transaction ✅ (Optional - requires deployed contract)
- [ ] Transaction submits without errors
- [ ] Transaction hash returned
- [ ] Can view transaction on Polygon Amoy explorer
- [ ] User paid $0 in gas fees
- [ ] Record ID returned (if applicable)

---

## 🐛 Troubleshooting

### "Buffer is not defined"
- Make sure you added the polyfill script to `index.html`
- It must be BEFORE your app script

### "Cannot find module 'erc4337-kit'"
- Run `npm install erc4337-kit` again
- Check that package.json includes it in dependencies

### "Smart Account not initializing"
- Check that all environment variables are set correctly
- Verify Privy App ID is correct
- Verify Pimlico API key is correct
- Check browser console for errors

### "Paymaster rejected"
- Verify Pimlico API key is valid
- Check that Polygon Amoy is enabled in Pimlico dashboard
- Make sure you have funds in Pimlico paymaster (free tier should work)

### "Transaction fails"
- Verify contract address is correct
- Check that contract is deployed on Polygon Amoy
- Verify ABI matches your contract

---

## 📊 Expected Results

### Successful Test Output:
```
✅ Authentication works
✅ Smart Account created
✅ Hash function works
✅ Gasless transaction works (if contract deployed)
```

### Console Output (No Errors):
```
✅ Smart Account ready: 0x1234...
✅ Hash: 0xabcd...
✅ Transaction: 0x5678...
```

---

## 🎉 Success Criteria

Your package is working correctly if:
1. ✅ App runs without errors
2. ✅ Login works
3. ✅ Smart Account creates automatically
4. ✅ Hash function generates correct SHA-256 hashes
5. ✅ (Optional) Gasless transactions work

---

## 📝 Notes

### Without Deployed Contract
You can still test:
- Authentication
- Smart Account creation
- Hash function
- All imports and setup

### With Deployed Contract
You can additionally test:
- Gasless transactions
- On-chain storage
- Transaction confirmation
- Block explorer verification

---

## 🚀 Next Steps

After successful testing:
1. ✅ Package works in real app
2. Share with others
3. Create example projects
4. Write blog post
5. Get feedback from community

---

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Verify all environment variables
3. Check Privy/Pimlico dashboards
4. Review the ERC-4337 documentation in the package

---

**Package**: erc4337-kit v0.1.0  
**Test App**: Fresh Vite + React  
**Network**: Polygon Amoy Testnet  
**Cost**: $0 (gasless!)

Happy testing! 🎉

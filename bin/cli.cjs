#!/usr/bin/env node

/**
 * erc4337-kit CLI
 * Usage: npx erc4337-kit init [template]
 *
 * Templates: vite (default), next, react
 */

'use strict'

const fs   = require('fs')
const path = require('path')

// ── Terminal colors (no deps) ──────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  cyan:   '\x1b[36m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  magenta:'\x1b[35m',
  blue:   '\x1b[34m',
}
const clr = (color, text) => `${color}${text}${c.reset}`
const log  = (msg) => console.log(msg)
const ok   = (msg) => log(`  ${clr(c.green, '✓')} ${msg}`)
const info = (msg) => log(`  ${clr(c.cyan,  '→')} ${msg}`)
const warn = (msg) => log(`  ${clr(c.yellow,'!')} ${msg}`)
const err  = (msg) => log(`  ${clr(c.red,   '✗')} ${msg}`)

// ── Arg parsing ────────────────────────────────────────────────────
const args = process.argv.slice(2)
const command  = args[0]
const template = args[1] || 'vite'

if (!command || command === '--help' || command === '-h') {
  printHelp()
  process.exit(0)
}

if (command === 'init') {
  runInit(template)
} else {
  err(`Unknown command: ${command}`)
  printHelp()
  process.exit(1)
}

// ── Help ───────────────────────────────────────────────────────────
function printHelp() {
  log('')
  log(clr(c.bold + c.magenta, '  erc4337-kit') + clr(c.dim, ' — ERC-4337 Account Abstraction for React'))
  log('')
  log(clr(c.bold, '  Usage:'))
  log('    npx erc4337-kit init [template]')
  log('')
  log(clr(c.bold, '  Templates:'))
  log('    vite    (default)  React + Vite starter')
  log('    next               Next.js App Router starter')
  log('    react              Plain Create React App style')
  log('')
  log(clr(c.bold, '  Examples:'))
  log('    npx erc4337-kit init')
  log('    npx erc4337-kit init vite')
  log('    npx erc4337-kit init next')
  log('')
}

// ── Init command ───────────────────────────────────────────────────
function runInit(template) {
  const supported = ['vite', 'next', 'react']
  if (!supported.includes(template)) {
    err(`Unknown template: "${template}". Supported: ${supported.join(', ')}`)
    process.exit(1)
  }

  const cwd = process.cwd()

  log('')
  log(clr(c.bold + c.magenta, '  ⚡ erc4337-kit init'))
  log(clr(c.dim, `  Template: ${template} | Target: ${cwd}`))
  log('')

  const files = getTemplateFiles(template)

  let created = 0
  let skipped = 0

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(cwd, filePath)
    const dir = path.dirname(fullPath)

    // Create parent directories if needed
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Don't overwrite existing files — respect existing project
    if (fs.existsSync(fullPath)) {
      warn(`Skipped (already exists): ${filePath}`)
      skipped++
      continue
    }

    fs.writeFileSync(fullPath, content, 'utf-8')
    ok(clr(c.green, `Created: ${filePath}`))
    created++
  }

  log('')
  log(clr(c.bold, `  Done! ${created} file(s) created, ${skipped} skipped.`))
  log('')
  log(clr(c.bold, '  Next steps:'))
  log('')

  const steps = getNextSteps(template)
  steps.forEach((step, i) => {
    log(`  ${clr(c.cyan, `${i + 1}.`)} ${step}`)
  })

  log('')
  log(clr(c.dim, '  Docs: https://github.com/atharvabaodhankar/erc4337-kit'))
  log('')
}

// ── Next steps per template ────────────────────────────────────────
function getNextSteps(template) {
  const common = [
    'Fill in your .env file with Privy, Pimlico, and Alchemy keys',
    'Deploy your contract and add its address to .env',
  ]

  if (template === 'vite' || template === 'react') {
    return [
      'npm install',
      'npm install erc4337-kit @privy-io/react-auth @privy-io/wagmi viem wagmi @tanstack/react-query buffer process',
      ...common,
      'npm run dev',
    ]
  }
  if (template === 'next') {
    return [
      'npm install',
      'npm install erc4337-kit @privy-io/react-auth @privy-io/wagmi viem wagmi @tanstack/react-query',
      ...common,
      'npm run dev',
    ]
  }
  return common
}

// ── Template file generators ───────────────────────────────────────
function getTemplateFiles(template) {
  if (template === 'vite')  return viteTemplate()
  if (template === 'next')  return nextTemplate()
  if (template === 'react') return reactTemplate()
  return {}
}

// ================================================================
// VITE TEMPLATE
// ================================================================
function viteTemplate() {
  return {
    '.env.example': `# Get your keys from:
# Privy:   https://dashboard.privy.io
# Pimlico:  https://dashboard.pimlico.io
# Alchemy:  https://dashboard.alchemy.com

VITE_PRIVY_APP_ID=your_privy_app_id_here
VITE_PIMLICO_API_KEY=your_pimlico_api_key_here
VITE_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/your_alchemy_key_here
VITE_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
`,

    'vite.config.js': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Required for viem / permissionless to work in browser
    global: 'globalThis',
  },
  resolve: {
    alias: {
      // Required for @noble/curves used by permissionless
      '@noble/curves/nist.js': '@noble/curves/nist',
    },
  },
})
`,

    'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My ERC-4337 App</title>

    <!--
      REQUIRED: Browser polyfills for viem / permissionless.
      This MUST appear before your app script.
    -->
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
`,

    'src/main.jsx': `import React from 'react'
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
      appearance={{ theme: 'dark', accentColor: '#7c3aed' }}
    >
      <App />
    </ChainProvider>
  </React.StrictMode>,
)
`,

    'src/App.jsx': `import { useWallet, useTransaction, polygonAmoy } from 'erc4337-kit'

// ─── Replace with your contract's ABI ──────────────────────────
const MY_ABI = [
  {
    name: 'storeRecord',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'dataHash', type: 'bytes32' }],
    outputs: [],
  },
]
// ────────────────────────────────────────────────────────────────

export default function App() {
  const wallet = useWallet({
    pimlicoApiKey: import.meta.env.VITE_PIMLICO_API_KEY,
    rpcUrl:        import.meta.env.VITE_RPC_URL,
    chain:         polygonAmoy,
  })

  const tx = useTransaction({ smartAccountClient: wallet.smartAccountClient })

  const handleSend = async () => {
    await tx.send({
      to:           import.meta.env.VITE_CONTRACT_ADDRESS,
      abi:          MY_ABI,
      functionName: 'storeRecord',
      // Replace with your actual args:
      args:         ['0x' + '00'.repeat(32)],
    })
  }

  // ── Not logged in ─────────────────────────────────────────────
  if (!wallet.authenticated) {
    return (
      <div className="container">
        <h1>My ERC-4337 App</h1>
        <p>Sign in to get your gasless smart account.</p>
        <button onClick={wallet.login}>Sign In</button>
      </div>
    )
  }

  // ── Loading ───────────────────────────────────────────────────
  if (wallet.isLoading) {
    return (
      <div className="container">
        <p>Setting up your smart account…</p>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────
  if (wallet.error) {
    return (
      <div className="container">
        <p style={{ color: 'red' }}>Error: {wallet.error}</p>
        <button onClick={wallet.logout}>Sign Out & Retry</button>
      </div>
    )
  }

  // ── Ready ─────────────────────────────────────────────────────
  return (
    <div className="container">
      <h1>My ERC-4337 App</h1>

      <div className="card">
        <p><strong>Smart Account</strong></p>
        <p className="address">{wallet.address}</p>
        <p>{wallet.balance.formatted} {wallet.balance.symbol}</p>
        <p className="dim">Network: {wallet.chainName}</p>
      </div>

      <button
        onClick={handleSend}
        disabled={!wallet.isReady || tx.pending}
      >
        {tx.pending ? 'Sending…' : 'Send Gasless Transaction'}
      </button>

      {tx.confirmed && (
        <p className="success">
          ✅ Confirmed! Tx: {tx.txHash?.slice(0, 10)}…
        </p>
      )}

      {tx.failed && (
        <p className="error">❌ {tx.error}</p>
      )}

      <button className="secondary" onClick={wallet.logout}>
        Sign Out
      </button>
    </div>
  )
}
`,

    'src/index.css': `/* erc4337-kit starter styles */
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #0f0f13;
  color: #e2e2e8;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.container {
  max-width: 480px;
  width: 100%;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

h1 { font-size: 1.75rem; font-weight: 700; }

.card {
  background: #1a1a24;
  border: 1px solid #2a2a38;
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.address {
  font-family: monospace;
  font-size: 0.8rem;
  color: #7c3aed;
  word-break: break-all;
}

.dim { color: #666; font-size: 0.875rem; }

button {
  background: #7c3aed;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.875rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
button:hover  { background: #6d28d9; }
button:disabled { background: #3a2060; cursor: not-allowed; }

button.secondary {
  background: transparent;
  border: 1px solid #2a2a38;
  color: #888;
  font-size: 0.875rem;
}
button.secondary:hover { border-color: #444; color: #ccc; }

.success { color: #34d399; font-size: 0.875rem; }
.error   { color: #f87171; font-size: 0.875rem; }
`,
  }
}

// ================================================================
// NEXT.JS TEMPLATE
// ================================================================
function nextTemplate() {
  return {
    '.env.example': `# Get your keys from:
# Privy:   https://dashboard.privy.io
# Pimlico:  https://dashboard.pimlico.io
# Alchemy:  https://dashboard.alchemy.com

NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id_here
NEXT_PUBLIC_PIMLICO_API_KEY=your_pimlico_api_key_here
NEXT_PUBLIC_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/your_alchemy_key_here
NEXT_PUBLIC_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
`,

    'next.config.js': `/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Required for viem / permissionless in Next.js
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    }
    return config
  },
}

module.exports = nextConfig
`,

    'app/providers.jsx': `'use client'

import { ChainProvider, polygonAmoy } from 'erc4337-kit'

export function Providers({ children }) {
  return (
    <ChainProvider
      privyAppId={process.env.NEXT_PUBLIC_PRIVY_APP_ID}
      chain={polygonAmoy}
      rpcUrl={process.env.NEXT_PUBLIC_RPC_URL}
      loginMethods={['google', 'email']}
      appearance={{ theme: 'dark', accentColor: '#7c3aed' }}
    >
      {children}
    </ChainProvider>
  )
}
`,

    'app/layout.jsx': `import { Providers } from './providers'

export const metadata = {
  title: 'My ERC-4337 App',
  description: 'Built with erc4337-kit',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
`,

    'app/page.jsx': `'use client'

import { useWallet, useTransaction, polygonAmoy } from 'erc4337-kit'

const MY_ABI = [
  {
    name: 'storeRecord',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'dataHash', type: 'bytes32' }],
    outputs: [],
  },
]

export default function HomePage() {
  const wallet = useWallet({
    pimlicoApiKey: process.env.NEXT_PUBLIC_PIMLICO_API_KEY,
    rpcUrl:        process.env.NEXT_PUBLIC_RPC_URL,
    chain:         polygonAmoy,
  })

  const tx = useTransaction({ smartAccountClient: wallet.smartAccountClient })

  if (!wallet.authenticated) {
    return (
      <main>
        <h1>My ERC-4337 App</h1>
        <button onClick={wallet.login}>Sign In</button>
      </main>
    )
  }

  if (wallet.isLoading) return <main><p>Setting up wallet…</p></main>

  return (
    <main>
      <h1>My ERC-4337 App</h1>
      <p>Address: {wallet.address}</p>
      <p>Balance: {wallet.balance.formatted} {wallet.balance.symbol}</p>

      <button
        onClick={() => tx.send({
          to: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
          abi: MY_ABI,
          functionName: 'storeRecord',
          args: ['0x' + '00'.repeat(32)],
        })}
        disabled={tx.pending}
      >
        {tx.pending ? 'Sending…' : 'Send Gasless Tx'}
      </button>

      {tx.confirmed && <p>✅ Confirmed: {tx.txHash?.slice(0, 10)}…</p>}
      {tx.failed    && <p>❌ {tx.error}</p>}

      <button onClick={wallet.logout}>Sign Out</button>
    </main>
  )
}
`,
  }
}

// ================================================================
// PLAIN REACT TEMPLATE (CRA-compatible)
// ================================================================
function reactTemplate() {
  const vite = viteTemplate()
  // Same as vite but uses process.env instead of import.meta.env
  return {
    ...vite,
    'src/App.jsx': vite['src/App.jsx']
      .replace(/import\.meta\.env\.VITE_/g, 'process.env.REACT_APP_'),
    'src/main.jsx': `import React from 'react'
import ReactDOM from 'react-dom/client'
import { ChainProvider, polygonAmoy } from 'erc4337-kit'
import App from './App'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    <ChainProvider
      privyAppId={process.env.REACT_APP_PRIVY_APP_ID}
      chain={polygonAmoy}
      rpcUrl={process.env.REACT_APP_RPC_URL}
      loginMethods={['google', 'email']}
    >
      <App />
    </ChainProvider>
  </React.StrictMode>
)
`,
    '.env.example': `REACT_APP_PRIVY_APP_ID=your_privy_app_id_here
REACT_APP_PIMLICO_API_KEY=your_pimlico_api_key_here
REACT_APP_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/your_alchemy_key_here
REACT_APP_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
`,
  }
}

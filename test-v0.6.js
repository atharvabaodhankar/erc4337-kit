import * as pkg from './dist/index.js'
import React from 'react'
import ReactDOMServer from 'react-dom/server'

console.log('🧪 Running v0.6 Integration Tests (Context & Multi-Infrastructure)...')

// Test 1: Config Validation
console.log('✓ Test 1: Testing createERC4337Config with Alchemy and custom endpoints...')
try {
  const config = pkg.createERC4337Config({
    chain: pkg.polygonAmoy,
    rpcUrl: 'https://polygon-amoy.g.alchemy.com/v2/mock-key',
    pimlicoApiKey: 'pim_mock-key',
    alchemyApiKey: 'al_mock-key',
    bundler: 'alchemy',
    paymaster: 'alchemy',
    bundlerUrl: 'https://custom-bundler.mock/rpc',
    paymasterUrl: 'https://custom-paymaster.mock/rpc'
  })

  if (config.bundler !== 'alchemy' || config.paymaster !== 'alchemy') {
    throw new Error('Config bundler/paymaster type incorrect')
  }
  if (config.bundlerUrl !== 'https://custom-bundler.mock/rpc' || config.paymasterUrl !== 'https://custom-paymaster.mock/rpc') {
    throw new Error('Config custom urls not resolved')
  }
  if (config.pimlicoApiKey !== 'pim_mock-key' || config.alchemyApiKey !== 'al_mock-key') {
    throw new Error('Config API keys not resolved')
  }

  console.log('   ✅ createERC4337Config successfully parsed all multi-infra options!')
  console.log()
} catch (err) {
  console.error('❌ createERC4337Config test failed:', err.message)
  process.exit(1)
}

// Test 2: Context Hooks Fallback Mock Validation
console.log('✓ Test 2: Testing Zero-Config Hooks via react-dom/server rendering...')
try {
  const mockSmartAccountState = {
    smartAccountAddress: '0x1234567890123456789012345678901234567890',
    smartAccountClient: {
      sendTransaction: async () => '0xmock-tx-hash',
      waitForTransactionReceipt: async () => ({ status: 'success', transactionHash: '0xmock-tx-hash' })
    },
    pimlicoClient: {
      getUserOperationReceipt: async () => ({ success: true })
    },
    paymasterClient: {
      sponsorUserOperation: async () => ({ paymasterAndData: '0x' })
    },
    login: () => {},
    logout: () => {},
    authenticated: true,
    user: {
      email: { address: 'test@erc4337.kit' },
      linkedAccounts: [{ type: 'wallet', walletClientType: 'privy', address: '0xowner-eoa' }]
    },
    isReady: true,
    isLoading: false,
    error: null
  }

  const mockBalanceState = {
    formatted: '5.432',
    raw: 5432000000000000000n,
    symbol: 'MATIC',
    isLoading: false,
    error: null
  }

  const mockContext = {
    chain: pkg.polygonAmoy,
    rpcUrl: 'https://polygon-amoy.g.alchemy.com/v2/mock',
    bundler: 'pimlico',
    paymaster: 'pimlico',
    smartAccount: mockSmartAccountState,
    balance: mockBalanceState
  }

  // Define a test component that calls the hooks within a valid React context tree
  function TestComponent() {
    // Run useWallet() zero-config
    const wallet = pkg.useWallet()
    if (wallet.address !== mockSmartAccountState.smartAccountAddress) {
      throw new Error(`useWallet address incorrect: ${wallet.address}`)
    }
    if (!wallet.authenticated || wallet.owner !== '0xowner-eoa') {
      throw new Error(`useWallet owner/auth incorrect: ${wallet.owner}`)
    }
    if (wallet.balance.formatted !== '5.432' || wallet.balance.symbol !== 'MATIC') {
      throw new Error('useWallet balance incorrect')
    }
    console.log('   ✅ useWallet() zero-config successfully fell back to context!')

    // Run useTransaction() zero-config
    const tx = pkg.useTransaction()
    if (typeof tx.send !== 'function') {
      throw new Error('useTransaction send is not a function')
    }
    console.log('   ✅ useTransaction() zero-config successfully fell back to context!')

    // Run useBalance() zero-config
    const balance = pkg.useBalance()
    if (balance.symbol !== 'POL') {
      throw new Error('useBalance symbol fallback incorrect')
    }
    console.log('   ✅ useBalance() zero-config successfully fell back to context!')

    return React.createElement('div', null, 'success')
  }

  // Wrap inside the ERC4337Context and render to static markup
  const element = React.createElement(
    pkg.ERC4337Context.Provider,
    { value: mockContext },
    React.createElement(TestComponent)
  )

  const output = ReactDOMServer.renderToStaticMarkup(element)
  
  if (!output.includes('success')) {
    throw new Error('Render output did not include success message')
  }

  console.log('   ✅ All Zero-Config hooks verified successfully in rendered Context!')
  console.log()
} catch (err) {
  console.error('❌ Zero-Config Hooks test failed:', err.message)
  console.error(err.stack)
  process.exit(1)
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('🎉 ALL v0.6 INTEGRATION TESTS PASSED!')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

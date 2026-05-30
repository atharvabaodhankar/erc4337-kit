/**
 * ERC-4337 Structured Error System
 *
 * Replaces opaque error strings with structured objects that include:
 * - code:    short identifier (e.g. 'AA21')
 * - title:   human-friendly name (e.g. 'Paymaster Rejected')
 * - message: what happened
 * - fix:     actionable steps to resolve it
 * - raw:     the original Error object for debugging
 *
 * Usage:
 *   import { parseAAError, ERC4337Error, AA_ERROR_CODES } from 'erc4337-kit'
 *
 *   try {
 *     await smartAccountClient.sendTransaction(...)
 *   } catch (err) {
 *     const structured = parseAAError(err)
 *     console.log(structured.title)    // "Paymaster Rejected"
 *     console.log(structured.fix)      // "Verify your Pimlico API key..."
 *     console.log(structured.code)     // "AA21"
 *   }
 */

// -----------------------------------------------------------------
// Error catalog — all known ERC-4337 / Pimlico / Privy error codes
// -----------------------------------------------------------------

export const AA_ERROR_CODES = {
  // -------- ERC-4337 EntryPoint error codes --------
  AA10: {
    code: 'AA10',
    title: 'Sender Already Constructed',
    message: 'The smart account already exists on-chain, but the UserOp includes initCode.',
    fix: 'Remove the initCode from your UserOperation. The account is already deployed.',
  },
  AA13: {
    code: 'AA13',
    title: 'Init Code Failed',
    message: 'The smart account factory failed during deployment.',
    fix: 'Check your factory contract and ensure the initCode is correct.',
  },
  AA14: {
    code: 'AA14',
    title: 'Init Code Out of Gas',
    message: 'The smart account deployment ran out of gas.',
    fix: 'Increase the gas limit for the UserOperation.',
  },
  AA20: {
    code: 'AA20',
    title: 'Account Not Deployed',
    message: 'The smart account does not exist on-chain yet.',
    fix: 'Include initCode to deploy the account with the first UserOperation.',
  },
  AA21: {
    code: 'AA21',
    title: 'Paymaster Rejected',
    message: 'The paymaster rejected your sponsorship request.',
    fix: 'Verify your Pimlico API key is correct and this chain is enabled in your Pimlico dashboard.',
  },
  AA22: {
    code: 'AA22',
    title: 'Expired Paymaster Op',
    message: 'The paymaster data has expired.',
    fix: 'Retry the transaction — the paymaster signature has a short validity window.',
  },
  AA23: {
    code: 'AA23',
    title: 'Invalid Signature',
    message: 'The UserOperation signature could not be verified.',
    fix: 'Try logging out and back in. The embedded wallet may need to re-sign.',
  },
  AA24: {
    code: 'AA24',
    title: 'Invalid Signature Format',
    message: 'The signature format is invalid for this smart account.',
    fix: 'Ensure you are using the correct account type and signing method.',
  },
  AA25: {
    code: 'AA25',
    title: 'Invalid Account Nonce',
    message: 'The account nonce in the UserOp is incorrect.',
    fix: 'Wait for any pending transactions to be mined, then retry.',
  },
  AA31: {
    code: 'AA31',
    title: 'Paymaster Deposit Too Low',
    message: 'Your Pimlico paymaster balance has run out.',
    fix: 'Log in to your Pimlico dashboard and top up your paymaster deposit balance.',
  },
  AA32: {
    code: 'AA32',
    title: 'Paymaster Expiry',
    message: 'The paymaster stake lock has expired.',
    fix: 'Contact your paymaster provider or retry after a short wait.',
  },
  AA33: {
    code: 'AA33',
    title: 'Paymaster Gas Too Low',
    message: 'The paymaster verification gas limit is too low.',
    fix: 'Increase the verificationGasLimit in your UserOperation.',
  },
  AA40: {
    code: 'AA40',
    title: 'Over Gas Limit',
    message: 'The UserOperation exceeds the block gas limit.',
    fix: 'Reduce the complexity of your transaction or split it into smaller batches.',
  },
  AA41: {
    code: 'AA41',
    title: 'Too Little Verification Gas',
    message: 'The verificationGasLimit is too low for this operation.',
    fix: 'Increase the verificationGasLimit. This usually happens with complex account logic.',
  },
  AA51: {
    code: 'AA51',
    title: 'Prefund Too Low',
    message: 'The smart account does not have enough balance to prefund the gas.',
    fix: 'Add native tokens to the smart account or use a paymaster for gas sponsorship.',
  },

  // -------- Bundler / Pimlico errors --------
  BUNDLER_RATE_LIMIT: {
    code: 'BUNDLER_RATE_LIMIT',
    title: 'Bundler Rate Limited',
    message: 'Too many requests sent to the bundler in a short time.',
    fix: 'Add a short delay between transactions or upgrade your Pimlico plan.',
  },
  BUNDLER_SIMULATION_FAILED: {
    code: 'BUNDLER_SIMULATION_FAILED',
    title: 'Simulation Failed',
    message: 'The bundler simulated your UserOp and it would revert on-chain.',
    fix: 'Check your contract function arguments. The call is reverting before submission.',
  },

  // -------- User actions --------
  USER_REJECTED: {
    code: 'USER_REJECTED',
    title: 'Cancelled',
    message: 'The transaction was cancelled by the user.',
    fix: 'No action needed — the user dismissed the transaction.',
  },

  // -------- Network errors --------
  NETWORK_ERROR: {
    code: 'NETWORK_ERROR',
    title: 'Network Error',
    message: 'Could not reach the RPC or bundler endpoint.',
    fix: 'Check your internet connection, RPC URL, and Pimlico API key.',
  },

  // -------- Gas errors --------
  GAS_TOO_LOW: {
    code: 'GAS_TOO_LOW',
    title: 'Gas Too Low',
    message: 'The gas estimate is too low for this transaction.',
    fix: 'The contract function may be too expensive for the paymaster policy. Try a simpler operation.',
  },

  // -------- Nonce errors --------
  NONCE_ERROR: {
    code: 'NONCE_ERROR',
    title: 'Nonce Conflict',
    message: 'A previous transaction is still pending with the same nonce.',
    fix: 'Wait 30–60 seconds for the pending transaction to be mined, then retry.',
  },

  // -------- On-chain revert --------
  REVERTED: {
    code: 'REVERTED',
    title: 'Transaction Reverted',
    message: 'The transaction was included on-chain but the contract call reverted.',
    fix: 'Check your function arguments. The contract rejected the call.',
  },

  // -------- Fallback --------
  UNKNOWN: {
    code: 'UNKNOWN',
    title: 'Transaction Failed',
    message: 'An unexpected error occurred.',
    fix: 'Open the browser console for the full error. Check your RPC URL and API keys.',
  },
}

// -----------------------------------------------------------------
// ERC4337Error class
// -----------------------------------------------------------------

/**
 * ERC4337Error
 *
 * A structured error class for ERC-4337 failures.
 * Extends the native Error so it can be caught normally with try/catch.
 *
 * @property {string} code    — e.g. 'AA21'
 * @property {string} title   — e.g. 'Paymaster Rejected'
 * @property {string} fix     — actionable resolution steps
 * @property {Error}  raw     — the original error object
 */
export class ERC4337Error extends Error {
  constructor({ code, title, message, fix, raw }) {
    super(message)
    this.name    = 'ERC4337Error'
    this.code    = code
    this.title   = title
    this.fix     = fix
    this.raw     = raw ?? null
  }

  /** Format a user-displayable string */
  toString() {
    return `[${this.code}] ${this.title}: ${this.message}`
  }

  /** Structured object — safe to pass to your UI layer */
  toJSON() {
    return {
      code:    this.code,
      title:   this.title,
      message: this.message,
      fix:     this.fix,
    }
  }
}

// -----------------------------------------------------------------
// parseAAError — the main function to call in catch blocks
// -----------------------------------------------------------------

/**
 * parseAAError
 *
 * Converts a raw Error thrown by viem / permissionless / Pimlico
 * into a structured ERC4337Error with a human-readable code, title,
 * message, and fix suggestion.
 *
 * @param {Error|unknown} err — the caught error
 * @returns {ERC4337Error}
 *
 * @example
 * try {
 *   await smartAccountClient.sendTransaction({ ... })
 * } catch (err) {
 *   const e = parseAAError(err)
 *   setError(e)                    // store structured error in state
 *   console.log(e.title)           // "Paymaster Rejected"
 *   console.log(e.fix)             // "Verify your Pimlico API key..."
 *   console.log(e.code)            // "AA21"
 * }
 */
export function parseAAError(err) {
  const msg = err?.message || err?.shortMessage || err?.toString() || ''

  // Check EntryPoint AA codes in priority order
  const aaCodes = ['AA51', 'AA41', 'AA40', 'AA33', 'AA32', 'AA31', 'AA25', 'AA24', 'AA23', 'AA22', 'AA21', 'AA20', 'AA14', 'AA13', 'AA10']
  for (const code of aaCodes) {
    if (msg.includes(code)) {
      return new ERC4337Error({ ...AA_ERROR_CODES[code], raw: err })
    }
  }

  // Check semantic patterns
  if (msg.includes('user rejected') || msg.includes('User rejected') || msg.includes('user denied')) {
    return new ERC4337Error({ ...AA_ERROR_CODES.USER_REJECTED, raw: err })
  }
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return new ERC4337Error({ ...AA_ERROR_CODES.BUNDLER_RATE_LIMIT, raw: err })
  }
  if (msg.includes('simulation') || msg.includes('simulate')) {
    return new ERC4337Error({ ...AA_ERROR_CODES.BUNDLER_SIMULATION_FAILED, raw: err })
  }
  if (msg.includes('gas') && msg.includes('too low')) {
    return new ERC4337Error({ ...AA_ERROR_CODES.GAS_TOO_LOW, raw: err })
  }
  if (msg.includes('nonce')) {
    return new ERC4337Error({ ...AA_ERROR_CODES.NONCE_ERROR, raw: err })
  }
  if (msg.includes('reverted') || msg.includes('revert')) {
    return new ERC4337Error({ ...AA_ERROR_CODES.REVERTED, raw: err })
  }
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT')) {
    return new ERC4337Error({ ...AA_ERROR_CODES.NETWORK_ERROR, raw: err })
  }

  // Fallback
  return new ERC4337Error({
    code:    'UNKNOWN',
    title:   AA_ERROR_CODES.UNKNOWN.title,
    message: msg || AA_ERROR_CODES.UNKNOWN.message,
    fix:     AA_ERROR_CODES.UNKNOWN.fix,
    raw:     err,
  })
}

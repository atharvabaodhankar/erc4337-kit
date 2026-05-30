import { useState, useCallback, useEffect } from 'react'

// localStorage key for session key storage
const SESSION_STORAGE_KEY = (address) =>
  `erc4337kit:session:${address?.toLowerCase()}`

// -----------------------------------------------------------------
// Duration parser: converts strings like '7d', '24h', '30m' to ms
// -----------------------------------------------------------------
function parseDuration(value) {
  if (typeof value === 'number') return value

  const match = String(value).match(/^(\d+)(ms|s|m|h|d)$/)
  if (!match) throw new Error(`[erc4337-kit] Invalid duration: "${value}". Use format: "7d", "24h", "30m", "60s", "5000ms"`)

  const [, amount, unit] = match
  const n = parseInt(amount, 10)
  const units = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }
  return n * units[unit]
}

// -----------------------------------------------------------------
// createSessionKey (utility — not a hook)
// -----------------------------------------------------------------

/**
 * createSessionKey
 *
 * Generates an ephemeral keypair and stores it in localStorage with an expiry.
 * The session key acts as a temporary signer — useful for:
 * - Games (avoid re-prompting users for every action)
 * - AI agents (autonomous signing within a time window)
 * - Long-running background tasks
 *
 * ⚠️ NOTE ON SECURITY: The private key is stored in localStorage.
 * This is acceptable for low-value, time-limited, testnet use cases.
 * For high-value production applications, consider using a secure enclave
 * or upgrading to a Kernel account with native session key support.
 *
 * ⚠️ NOTE ON ACCOUNT TYPE: True ERC-4337 session keys (with contract-level
 * permission scoping) require a Kernel or Safe smart account. SimpleSmartAccount
 * does not support native session keys. This implementation provides a temporary
 * EOA keypair that can be used as a session signer, but cannot restrict which
 * contracts it can call at the account level.
 *
 * @param {object} options
 * @param {string}          options.smartAccountAddress — scopes the session to one account
 * @param {string|number}   options.expiresIn          — duration: "7d", "24h", "30m", etc.
 * @param {string}          [options.label]            — human label for this session (e.g. 'game-session')
 *
 * @returns {object} {
 *   privateKey,     ← hex private key (0x...)
 *   address,        ← public address derived from the key
 *   expiresAt,      ← Unix timestamp (ms) when the session expires
 *   label,
 *   isValid()       ← returns true if not expired
 * }
 *
 * @example
 * import { createSessionKey } from 'erc4337-kit'
 *
 * const session = await createSessionKey({
 *   smartAccountAddress,
 *   expiresIn: '7d',
 *   label: 'game-session',
 * })
 *
 * console.log('Session key address:', session.address)
 * console.log('Expires:', new Date(session.expiresAt).toLocaleString())
 * console.log('Valid:', session.isValid())
 */
export async function createSessionKey({ smartAccountAddress, expiresIn, label = 'session' }) {
  if (!smartAccountAddress) {
    throw new Error('[erc4337-kit] createSessionKey: smartAccountAddress is required')
  }

  const durationMs = parseDuration(expiresIn)
  const expiresAt = Date.now() + durationMs

  // Generate a random 32-byte private key using Web Crypto API
  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)
  const privateKey = '0x' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')

  // Derive the public address from the private key using viem
  // We do this lazily to avoid import overhead if createSessionKey isn't used
  const { privateKeyToAccount } = await import('viem/accounts')
  const account = privateKeyToAccount(privateKey)

  const session = {
    privateKey,
    address: account.address,
    expiresAt,
    label,
    smartAccountAddress,
    createdAt: Date.now(),
  }

  // Persist to localStorage
  try {
    const key = SESSION_STORAGE_KEY(smartAccountAddress)
    const existing = JSON.parse(localStorage.getItem(key) || '[]')
    existing.push(session)
    localStorage.setItem(key, JSON.stringify(existing))
  } catch {
    console.warn('[erc4337-kit] createSessionKey: Could not persist to localStorage')
  }

  return {
    ...session,
    isValid: () => Date.now() < session.expiresAt,
  }
}

// -----------------------------------------------------------------
// useSessionKey (hook)
// -----------------------------------------------------------------

/**
 * useSessionKey
 *
 * React hook for managing session keys.
 * Handles creation, validation, listing, and revocation.
 *
 * @param {object} params
 * @param {string} params.smartAccountAddress — from useSmartAccount() or useWallet()
 *
 * @returns {object} {
 *   sessions,           ← array of stored sessions for this account
 *   activeSession,      ← most recent non-expired session (or null)
 *   hasActiveSession,   ← boolean
 *   create(options),    ← async (expiresIn, label?) => session
 *   revoke(address),    ← remove a session key by its address
 *   revokeAll(),        ← remove all sessions for this account
 *   isLoading,
 * }
 *
 * @example
 * const { activeSession, hasActiveSession, create } = useSessionKey({ smartAccountAddress })
 *
 * // Start a session
 * if (!hasActiveSession) {
 *   const session = await create({ expiresIn: '24h', label: 'game' })
 *   console.log('Session address:', session.address)
 * }
 *
 * // Check expiry
 * if (activeSession) {
 *   const remaining = activeSession.expiresAt - Date.now()
 *   console.log('Expires in:', Math.round(remaining / 3600000), 'hours')
 * }
 */
export function useSessionKey({ smartAccountAddress }) {
  const [sessions, setSessions] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  const storageKey = SESSION_STORAGE_KEY(smartAccountAddress)

  // Load sessions from localStorage
  const loadSessions = useCallback(() => {
    if (!smartAccountAddress) { setSessions([]); return }
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]')
      // Filter out expired sessions on load
      const valid = stored.filter(s => Date.now() < s.expiresAt)
      setSessions(valid)
      // Prune expired from storage
      if (valid.length !== stored.length) {
        localStorage.setItem(storageKey, JSON.stringify(valid))
      }
    } catch {
      setSessions([])
    }
  }, [smartAccountAddress, storageKey])

  useEffect(() => { loadSessions() }, [loadSessions])

  const create = useCallback(
    async ({ expiresIn, label = 'session' } = {}) => {
      setIsLoading(true)
      try {
        const session = await createSessionKey({ smartAccountAddress, expiresIn, label })
        loadSessions() // refresh list
        return session
      } finally {
        setIsLoading(false)
      }
    },
    [smartAccountAddress, loadSessions]
  )

  const revoke = useCallback(
    (sessionAddress) => {
      try {
        const stored = JSON.parse(localStorage.getItem(storageKey) || '[]')
        const updated = stored.filter(s => s.address.toLowerCase() !== sessionAddress.toLowerCase())
        localStorage.setItem(storageKey, JSON.stringify(updated))
        setSessions(prev => prev.filter(s => s.address.toLowerCase() !== sessionAddress.toLowerCase()))
      } catch { /* ignore */ }
    },
    [storageKey]
  )

  const revokeAll = useCallback(() => {
    try {
      localStorage.removeItem(storageKey)
      setSessions([])
    } catch { /* ignore */ }
  }, [storageKey])

  // Most recent non-expired session
  const activeSession = sessions.length > 0
    ? { ...sessions[sessions.length - 1], isValid: () => Date.now() < sessions[sessions.length - 1].expiresAt }
    : null

  return {
    sessions,
    activeSession,
    hasActiveSession: !!activeSession,
    create,
    revoke,
    revokeAll,
    isLoading,
  }
}

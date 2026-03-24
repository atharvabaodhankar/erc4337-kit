/**
 * SHA-256 hashing utilities for client-side data hashing
 * 
 * These functions hash data BEFORE sending to blockchain,
 * preserving privacy while creating tamper-proof proofs.
 */

/**
 * Hash a string using SHA-256
 * 
 * @param {string} text - The text to hash
 * @returns {Promise<string>} - Hex-encoded hash with 0x prefix
 * 
 * @example
 * const hash = await sha256Hash("my secret data")
 * // Returns: "0x2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae"
 */
export async function sha256Hash(text) {
  if (typeof text !== 'string') {
    throw new Error('sha256Hash: input must be a string')
  }

  const encoded = new TextEncoder().encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Hash a File object using SHA-256
 * 
 * @param {File} file - The file to hash
 * @returns {Promise<string>} - Hex-encoded hash with 0x prefix
 * 
 * @example
 * const fileInput = document.querySelector('input[type="file"]')
 * const file = fileInput.files[0]
 * const hash = await sha256HashFile(file)
 */
export async function sha256HashFile(file) {
  if (!(file instanceof File)) {
    throw new Error('sha256HashFile: input must be a File object')
  }

  const arrayBuffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

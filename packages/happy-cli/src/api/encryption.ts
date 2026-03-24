import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import tweetnacl from 'tweetnacl';

/**
 * Encode a Uint8Array to base64 string
 * @param buffer - The buffer to encode
 * @param variant - The encoding variant ('base64' or 'base64url')
 */
export function encodeBase64(buffer: Uint8Array, variant: 'base64' | 'base64url' = 'base64'): string {
  if (variant === 'base64url') {
    return encodeBase64Url(buffer);
  }
  return Buffer.from(buffer).toString('base64')
}

/**
 * Encode a Uint8Array to base64url string (URL-safe base64)
 * Base64URL uses '-' instead of '+', '_' instead of '/', and removes padding
 */
export function encodeBase64Url(buffer: Uint8Array): string {
  return Buffer.from(buffer)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

/**
 * Decode a base64 string to a Uint8Array
 * @param base64 - The base64 string to decode
 * @param variant - The encoding variant ('base64' or 'base64url')
 * @returns The decoded Uint8Array
 */
export function decodeBase64(base64: string, variant: 'base64' | 'base64url' = 'base64'): Uint8Array {
  if (variant === 'base64url') {
    // Convert base64url to base64
    const base64Standard = base64
      .replaceAll('-', '+')
      .replaceAll('_', '/')
      + '='.repeat((4 - base64.length % 4) % 4);
    return new Uint8Array(Buffer.from(base64Standard, 'base64'));
  }
  return new Uint8Array(Buffer.from(base64, 'base64'));
}



/**
 * Generate secure random bytes
 */
export function getRandomBytes(size: number): Uint8Array {
  return new Uint8Array(randomBytes(size))
}

export function libsodiumPublicKeyFromSecretKey(seed: Uint8Array): Uint8Array {
  // NOTE: This matches libsodium implementation, tweetnacl doesnt do this by default
  const hashedSeed = new Uint8Array(createHash('sha512').update(seed).digest());
  const secretKey = hashedSeed.slice(0, 32);
  return new Uint8Array(tweetnacl.box.keyPair.fromSecretKey(secretKey).publicKey);
}

export function libsodiumEncryptForPublicKey(data: Uint8Array, recipientPublicKey: Uint8Array): Uint8Array {
  // Generate ephemeral keypair for this encryption
  const ephemeralKeyPair = tweetnacl.box.keyPair();
  
  // Generate random nonce (24 bytes for box encryption)
  const nonce = getRandomBytes(tweetnacl.box.nonceLength);
  
  // Encrypt the data using box (authenticated encryption)
  const encrypted = tweetnacl.box(data, nonce, recipientPublicKey, ephemeralKeyPair.secretKey);
  
  // Bundle format: ephemeral public key (32 bytes) + nonce (24 bytes) + encrypted data
  const result = new Uint8Array(ephemeralKeyPair.publicKey.length + nonce.length + encrypted.length);
  result.set(ephemeralKeyPair.publicKey, 0);
  result.set(nonce, ephemeralKeyPair.publicKey.length);
  result.set(encrypted, ephemeralKeyPair.publicKey.length + nonce.length);
  
  return result;
}

/**
 * Encrypt data using the secret key
 * @param data - The data to encrypt
 * @param secret - The secret key to use for encryption
 * @returns The encrypted data
 */
export function encryptLegacy(data: any, secret: Uint8Array): Uint8Array {
  const nonce = getRandomBytes(tweetnacl.secretbox.nonceLength);
  const encrypted = tweetnacl.secretbox(new TextEncoder().encode(JSON.stringify(data)), nonce, secret);
  const result = new Uint8Array(nonce.length + encrypted.length);
  result.set(nonce);
  result.set(encrypted, nonce.length);
  return result;
}

/**
 * Decrypt data using the secret key
 * @param data - The data to decrypt
 * @param secret - The secret key to use for decryption
 * @returns The decrypted data
 */
export function decryptLegacy(data: Uint8Array, secret: Uint8Array): any | null {
  const nonce = data.slice(0, tweetnacl.secretbox.nonceLength);
  const encrypted = data.slice(tweetnacl.secretbox.nonceLength);
  const decrypted = tweetnacl.secretbox.open(encrypted, nonce, secret);
  if (!decrypted) {
    // Decryption failed - returning null is sufficient for error handling
    // Callers should handle the null case appropriately
    return null;
  }
  return JSON.parse(new TextDecoder().decode(decrypted));
}

/**
 * Encrypt data using AES-256-GCM with the data encryption key
 * @param data - The data to encrypt
 * @param dataKey - The 32-byte AES-256 key
 * @returns The encrypted data bundle (nonce + ciphertext + auth tag)
 */
export function encryptWithDataKey(data: any, dataKey: Uint8Array): Uint8Array {
  const nonce = getRandomBytes(12); // GCM uses 12-byte nonces
  const cipher = createCipheriv('aes-256-gcm', dataKey, nonce);

  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = Buffer.concat([
    cipher.update(plaintext),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  // Bundle: version(1) + nonce (12) + ciphertext + auth tag (16)
  const bundle = new Uint8Array(12 + encrypted.length + 16 + 1);
  bundle.set([0], 0);
  bundle.set(nonce, 1);
  bundle.set(new Uint8Array(encrypted), 13);
  bundle.set(new Uint8Array(authTag), 13 + encrypted.length);

  return bundle;
}

/**
 * Decrypt data using AES-256-GCM with the data encryption key
 * @param bundle - The encrypted data bundle
 * @param dataKey - The 32-byte AES-256 key
 * @returns The decrypted data or null if decryption fails
 */
export function decryptWithDataKey(bundle: Uint8Array, dataKey: Uint8Array): any | null {
  if (bundle.length < 1) {
    return null;
  }
  if (bundle[0] !== 0) { // Only verision 0
    return null;
  }
  if (bundle.length < 12 + 16 + 1) { // Minimum: version nonce + auth tag
    return null;
  }


  const nonce = bundle.slice(1, 13);
  const authTag = bundle.slice(bundle.length - 16);
  const ciphertext = bundle.slice(13, bundle.length - 16);

  try {
    const decipher = createDecipheriv('aes-256-gcm', dataKey, nonce);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);

    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch (error) {
    // Decryption failed
    return null;
  }
}

export function encrypt(key: Uint8Array, variant: 'legacy' | 'dataKey', data: any): Uint8Array {
  // --- PLAINTEXT MODE BYPASS ---
  if (process.env.ENABLE_PLAINTEXT_MODE === 'true') {
    // We add a magic prefix "PLAINTEXT:" so the decryptor knows not to decrypt
    const jsonStr = JSON.stringify(data);
    return new TextEncoder().encode(`PLAINTEXT:${jsonStr}`);
  }
  // -----------------------------

  if (variant === 'legacy') {
    return encryptLegacy(data, key);
  } else {
    return encryptWithDataKey(data, key);
  }
}

export function decrypt(key: Uint8Array, variant: 'legacy' | 'dataKey', data: Uint8Array): any | null {
  // --- PLAINTEXT MODE BYPASS ---
  const isPlaintextMode = process.env.ENABLE_PLAINTEXT_MODE === 'true';
  
  if (isPlaintextMode) {
      try {
          const jsonStr = new TextDecoder().decode(data);
          // Just like we did in RpcHandlerManager, we should strip any 'PLAINTEXT:' prefix
          const jsonStartIndex = Math.max(jsonStr.indexOf('{'), jsonStr.indexOf('['));
          if (jsonStartIndex !== -1) {
              const cleanJsonStr = jsonStr.substring(jsonStartIndex);
              return JSON.parse(cleanJsonStr);
          }
      } catch (e) {
          // If pure json parsing fails, fallback to normal decrypt just in case
      }
  }

  // Also check if data starts with "PLAINTEXT:" (which is 10 bytes) for older mode support
  if (data.length > 10) {
    const prefix = new TextDecoder().decode(data.slice(0, 10));
    if (prefix === 'PLAINTEXT:') {
      try {
        const jsonStr = new TextDecoder().decode(data.slice(10));
        return JSON.parse(jsonStr);
      } catch (e) {
        console.error('Failed to parse plaintext payload', e);
        // Fall through to normal decryption instead of returning null
      }
    }
    
    // Web app often sends data with a null byte prefix for versioning (\x00PLAINTEXT:...)
    if (data[0] === 0 && data.length > 11) {
        const prefixWithNull = new TextDecoder().decode(data.slice(1, 11));
        if (prefixWithNull === 'PLAINTEXT:') {
            try {
                const jsonStr = new TextDecoder().decode(data.slice(11));
                return JSON.parse(jsonStr);
            } catch (e) {
                console.error('Failed to parse plaintext payload with null byte', e);
            }
        }
    }
  }
  // -----------------------------

  if (variant === 'legacy') {
    return decryptLegacy(data, key);
  } else {
    return decryptWithDataKey(data, key);
  }
}

/**
 * Generate authentication challenge response
 */
export function authChallenge(secret: Uint8Array): {
  challenge: Uint8Array
  publicKey: Uint8Array
  signature: Uint8Array
} {
  // --- PLAINTEXT MODE BYPASS ---
  if (process.env.ENABLE_PLAINTEXT_MODE === 'true') {
      return {
          challenge: new Uint8Array(32),
          publicKey: new Uint8Array(32),
          signature: new Uint8Array(64)
      };
  }
  // -----------------------------

  const keypair = tweetnacl.sign.keyPair.fromSeed(secret);
  const challenge = getRandomBytes(32);
  const signature = tweetnacl.sign.detached(challenge, keypair.secretKey);

  return {
    challenge,
    publicKey: keypair.publicKey,
    signature
  };
}
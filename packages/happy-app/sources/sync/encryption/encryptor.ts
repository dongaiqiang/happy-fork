import { decryptBox, decryptSecretBox, encryptBox, encryptSecretBox } from "@/encryption/libsodium";
import { encodeBase64, decodeBase64 } from "@/encryption/base64";
import sodium from '@/encryption/libsodium.lib';
import { decodeUTF8, encodeUTF8 } from "@/encryption/text";
import { decryptAESGCMString, encryptAESGCMString } from "@/encryption/aes";

//
// IMPORTANT: Right now there is a bug in the AES implementation and it works only with a normal strings converted to Uint8Array. 
// Any abnormal string might break encoding and decoding utf8.
//

export interface Encryptor {
    encrypt(data: any[]): Promise<Uint8Array[]>;
}

export interface Decryptor {
    decrypt(data: Uint8Array[]): Promise<(any | null)[]>;
}

export class SecretBoxEncryption implements Encryptor, Decryptor {
    private readonly secretKey: Uint8Array;

    constructor(secretKey: Uint8Array) {
        this.secretKey = secretKey;
    }

    async decrypt(data: Uint8Array[]): Promise<(any | null)[]> {
        // Process as batch, not Promise.all - more efficient
        const results: (any | null)[] = [];
        for (const item of data) {
            // --- PLAINTEXT MODE BYPASS ---
            if (item.length > 10) {
                const prefix = new TextDecoder().decode(item.slice(0, 10));
                if (prefix === 'PLAINTEXT:') {
                    try {
                        const jsonStr = new TextDecoder().decode(item.slice(10));
                        results.push(JSON.parse(jsonStr));
                        continue;
                    } catch (e) {
                        console.error('Failed to parse plaintext payload in SecretBoxEncryption', e);
                    }
                }
            }
            // -----------------------------
            results.push(decryptSecretBox(item, this.secretKey));
        }
        return results;
    }

    async encrypt(data: any[]): Promise<Uint8Array[]> {
        // Process as batch, not Promise.all - more efficient
        const results: Uint8Array[] = [];
        
        // --- PLAINTEXT MODE BYPASS ---
        // Check EXPO_PUBLIC env var
        const isPlaintextMode = process.env.EXPO_PUBLIC_ENABLE_PLAINTEXT_MODE === 'true';
        // -----------------------------

        for (const item of data) {
            if (isPlaintextMode) {
                const jsonStr = JSON.stringify(item);
                results.push(new TextEncoder().encode(`PLAINTEXT:${jsonStr}`));
            } else {
                results.push(encryptSecretBox(item, this.secretKey));
            }
        }
        return results;
    }
}

export class BoxEncryption implements Encryptor, Decryptor {
    private readonly privateKey: Uint8Array;
    private readonly publicKey: Uint8Array;

    constructor(seed: Uint8Array) {
        // Use the seed to generate a proper keypair
        const keypair = sodium.crypto_box_seed_keypair(seed);
        this.privateKey = keypair.privateKey;
        this.publicKey = keypair.publicKey;
    }

    async encrypt(data: any[]): Promise<Uint8Array[]> {
        // Process as batch, not Promise.all - more efficient
        const results: Uint8Array[] = [];
        
        // --- PLAINTEXT MODE BYPASS ---
        const isPlaintextMode = process.env.EXPO_PUBLIC_ENABLE_PLAINTEXT_MODE === 'true';
        // -----------------------------

        for (const item of data) {
            if (isPlaintextMode) {
                const jsonStr = JSON.stringify(item);
                // Make sure to match how CLI daemon decrypts: JSON.parse(new TextDecoder().decode(decodeBase64(request.params)))
                // We must prefix it with PLAINTEXT: for some endpoints that still expect it,
                // but the daemon side now strips anything before '{' or '[' anyway
                results.push(new TextEncoder().encode(`PLAINTEXT:${jsonStr}`));
            } else {
                results.push(encryptBox(encodeUTF8(JSON.stringify(item)), this.publicKey));
            }
        }
        return results;
    }

    async decrypt(data: Uint8Array[]): Promise<(any | null)[]> {
        // Process as batch, not Promise.all - more efficient
        const results: (any | null)[] = [];
        for (const item of data) {
            // --- PLAINTEXT MODE BYPASS ---
            const isPlaintextMode = process.env.EXPO_PUBLIC_ENABLE_PLAINTEXT_MODE === 'true';
            if (isPlaintextMode || item.length > 10) {
                // If EXPO_PUBLIC_ENABLE_PLAINTEXT_MODE is true, try to decode as plain JSON directly first
                if (isPlaintextMode) {
                    try {
                        const jsonStr = new TextDecoder().decode(item);
                        // Make sure it looks like JSON before parsing to avoid unnecessary errors
                        if (jsonStr.trim().startsWith('{') || jsonStr.trim().startsWith('[')) {
                            results.push(JSON.parse(jsonStr));
                            continue;
                        }
                    } catch (e) {
                        // Fall back to PLAINTEXT: prefix check
                    }
                }

                const prefix = new TextDecoder().decode(item.slice(0, 10));
                if (prefix === 'PLAINTEXT:') {
                    try {
                        const jsonStr = new TextDecoder().decode(item.slice(10));
                        results.push(JSON.parse(jsonStr));
                        continue;
                    } catch (e) {
                        console.error('Failed to parse plaintext payload in BoxEncryption', e);
                    }
                }
            }
            // -----------------------------

            let decrypted = decryptBox(item, this.privateKey);
            if (!decrypted) {
                results.push(null);
                continue;
            }
            results.push(JSON.parse(decodeUTF8(decrypted)));
        }
        return results;
    }
}

export class AES256Encryption implements Encryptor, Decryptor {
    private readonly secretKey: Uint8Array;
    private readonly secretKeyB64: string;

    constructor(secretKey: Uint8Array) {
        this.secretKey = secretKey;
        this.secretKeyB64 = encodeBase64(secretKey);
    }

    async encrypt(data: any[]): Promise<Uint8Array[]> {
        // Process as batch, not Promise.all - more efficient
        const results: Uint8Array[] = [];
        
        // --- PLAINTEXT MODE BYPASS ---
        const isPlaintextMode = process.env.EXPO_PUBLIC_ENABLE_PLAINTEXT_MODE === 'true';
        // -----------------------------

        for (const item of data) {
            if (isPlaintextMode) {
                // To match AES output format which starts with 0
                const jsonStr = JSON.stringify(item);
                const plaintextBytes = new TextEncoder().encode(`PLAINTEXT:${jsonStr}`);
                let output = new Uint8Array(plaintextBytes.length + 1);
                output[0] = 0;
                output.set(plaintextBytes, 1);
                results.push(output);
            } else {
                // Serialize to JSON string first
                const encrypted = decodeBase64(await encryptAESGCMString(JSON.stringify(item), this.secretKeyB64));
                let output = new Uint8Array(encrypted.length + 1);
                output[0] = 0;
                output.set(encrypted, 1);
                results.push(output);
            }
        }
        return results;
    }

    async decrypt(data: Uint8Array[]): Promise<(any | null)[]> {
        // Process as batch, not Promise.all - more efficient
        const results: (any | null)[] = [];
        for (const item of data) {
            try {
                // --- PLAINTEXT MODE BYPASS ---
                const isPlaintextMode = process.env.EXPO_PUBLIC_ENABLE_PLAINTEXT_MODE === 'true';
                if (isPlaintextMode) {
                    try {
                        const jsonStr = new TextDecoder().decode(item);
                        // Also try to find the first '{' or '[' just like we did on Daemon side
                        const jsonStartIndex = Math.max(jsonStr.indexOf('{'), jsonStr.indexOf('['));
                        if (jsonStartIndex !== -1) {
                            const cleanJsonStr = jsonStr.substring(jsonStartIndex);
                            results.push(JSON.parse(cleanJsonStr));
                            continue;
                        }
                    } catch (e) {}
                }
                
                if (item[0] !== 0) {
                    results.push(null);
                    continue;
                }
                
                const payload = item.slice(1);
                if (payload.length > 10) {
                    const prefix = new TextDecoder().decode(payload.slice(0, 10));
                    if (prefix === 'PLAINTEXT:') {
                        const jsonStr = new TextDecoder().decode(payload.slice(10));
                        results.push(JSON.parse(jsonStr));
                        continue;
                    }
                }
                // -----------------------------

                const decryptedString = await decryptAESGCMString(encodeBase64(payload), this.secretKeyB64);
                if (!decryptedString) {
                    results.push(null);
                } else {
                    // Parse JSON string back to object
                    results.push(JSON.parse(decryptedString));
                }
            } catch (error) {
                results.push(null);
            }
        }
        return results;
    }
}
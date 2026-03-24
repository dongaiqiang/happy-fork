import { getRandomBytes } from 'expo-crypto';
import sodium from '@/encryption/libsodium.lib';

export function authChallenge(secret: Uint8Array) {
    // --- PLAINTEXT MODE BYPASS ---
    if (process.env.EXPO_PUBLIC_ENABLE_PLAINTEXT_MODE === 'true') {
        return {
            challenge: new Uint8Array(32),
            signature: new Uint8Array(64),
            publicKey: new Uint8Array(32)
        };
    }
    // -----------------------------

    const keypair = sodium.crypto_sign_seed_keypair(secret);
    const challenge = getRandomBytes(32);
    const signature = sodium.crypto_sign_detached(challenge, keypair.privateKey);
    return { challenge, signature, publicKey: keypair.publicKey };
}
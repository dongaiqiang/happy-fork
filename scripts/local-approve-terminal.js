const axios = require('axios');
const nacl = require('tweetnacl');
const crypto = require('crypto');

const server = process.env.HAPPY_SERVER_URL || 'http://localhost:3005';
const terminalKeyB64Url = process.env.TERMINAL_KEY;

if (!terminalKeyB64Url) {
  console.error('TERMINAL_KEY is required');
  process.exit(1);
}

const toB64 = (buf) => Buffer.from(buf).toString('base64');
const fromB64Url = (s) => {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b.length % 4 ? '='.repeat(4 - (b.length % 4)) : '';
  return Buffer.from(b + pad, 'base64');
};
const toB64Url = (buf) =>
  Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

async function main() {
  const secret = crypto.randomBytes(32);
  const keypair = nacl.sign.keyPair.fromSeed(secret);
  const challenge = crypto.randomBytes(32);
  const signature = nacl.sign.detached(challenge, keypair.secretKey);

  const authRes = await axios.post(`${server}/v1/auth`, {
    challenge: toB64(challenge),
    publicKey: toB64(keypair.publicKey),
    signature: toB64(signature),
  });

  const token = authRes.data.token;
  const terminalPk = fromB64Url(terminalKeyB64Url);
  const ephem = nacl.box.keyPair();
  const nonce = crypto.randomBytes(nacl.box.nonceLength);
  const encrypted = nacl.box(secret, nonce, terminalPk, ephem.secretKey);
  const bundle = Buffer.concat([
    Buffer.from(ephem.publicKey),
    Buffer.from(nonce),
    Buffer.from(encrypted),
  ]);

  await axios.post(
    `${server}/v1/auth/response`,
    { publicKey: toB64(terminalPk), response: toB64(bundle) },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  console.log(`APP_SECRET_B64URL=${toB64Url(secret)}`);
}

main().catch((e) => {
  if (e.response) {
    console.error(e.response.data);
  } else {
    console.error(e);
  }
  process.exit(1);
});

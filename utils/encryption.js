import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.PROXY_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const CIPHER_ALGORITHM = 'aes-256-cbc';

export function encryptRequest(data) {
  try {
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(ENCRYPTION_KEY.substring(0, 64), 'hex');

    const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, key, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const encryptedWithIv = iv.toString('hex') + ':' + encrypted;
    const base64Encoded = Buffer.from(encryptedWithIv).toString('base64');

    return base64Encoded;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

export function decryptRequest(encodedData) {
  try {
    const decrypted = Buffer.from(encodedData, 'base64').toString('utf8');
    const [ivHex, encryptedHex] = decrypted.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const key = Buffer.from(ENCRYPTION_KEY.substring(0, 64), 'hex');

    const decipher = crypto.createDecipheriv(CIPHER_ALGORITHM, key, iv);
    let decrypted_text = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted_text += decipher.final('utf8');

    return JSON.parse(decrypted_text);
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

export function encodeBase64(data) {
  return Buffer.from(typeof data === 'string' ? data : JSON.stringify(data)).toString('base64');
}

export function decodeBase64(data) {
  return Buffer.from(data, 'base64').toString('utf8');
}

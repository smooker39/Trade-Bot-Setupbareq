// AES-256-GCM Encryption Module for API Key Security
// Military-Grade Encryption for OKX Credentials

import crypto from 'crypto';
import { log } from '../logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;
const VERSION = 1;

interface EncryptedData {
  version: number;
  iv: string;
  encryptedData: string;
  authTag: string;
  salt: string;
}

class EncryptionService {
  private getMasterKey(): string {
    const envKey = process.env.ENCRYPTION_KEY;
    
    if (!envKey) {
      throw new Error('ENCRYPTION_KEY not found in environment variables');
    }
    
    return envKey;
  }

  /**
   * Derive a unique key for each record using per-record salt
   */
  private deriveKey(salt: Buffer): Buffer {
    const masterKey = this.getMasterKey();
    return crypto.pbkdf2Sync(masterKey, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
  }

  /**
   * Encrypt a string using AES-256-GCM with per-record salt
   * Returns a base64-encoded JSON string containing IV, encrypted data, auth tag, and salt
   */
  encrypt(plaintext: string): string {
    try {
      if (!plaintext) {
        throw new Error('Cannot encrypt empty string');
      }

      // Generate unique salt for this record
      const salt = crypto.randomBytes(SALT_LENGTH);
      
      // Derive key using this record's salt
      const key = this.deriveKey(salt);
      
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      const encryptedData: EncryptedData = {
        version: VERSION,
        iv: iv.toString('hex'),
        encryptedData: encrypted,
        authTag: authTag.toString('hex'),
        salt: salt.toString('hex')
      };
      
      // Return as base64-encoded JSON for database storage
      const jsonStr = JSON.stringify(encryptedData);
      return Buffer.from(jsonStr).toString('base64');
    } catch (error: any) {
      log.error(`[ENCRYPTION] Encryption failed: ${error.message}`);
      // Return a safer error message that doesn't include the plaintext
      throw new Error('Encryption failed - please check system configuration');
    }
  }

  /**
   * Decrypt a base64-encoded encrypted string using the stored salt
   */
  decrypt(encryptedBase64: string): string {
    try {
      if (!encryptedBase64) {
        throw new Error('Cannot decrypt empty string');
      }

      // Check if this is already plaintext (for backward compatibility)
      if (!this.isEncrypted(encryptedBase64)) {
        log.warn('[ENCRYPTION] Data appears to be unencrypted - returning as-is (legacy mode)');
        return encryptedBase64;
      }

      // Decode base64 JSON
      const jsonStr = Buffer.from(encryptedBase64, 'base64').toString('utf8');
      const encryptedData: EncryptedData = JSON.parse(jsonStr);
      
      // Use the stored salt to derive the same key
      const salt = Buffer.from(encryptedData.salt, 'hex');
      const key = this.deriveKey(salt);
      
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');
      
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error: any) {
      log.error(`[ENCRYPTION] Decryption failed: ${error.message}`);
      throw new Error('Decryption failed - access denied or corrupted data');
    }
  }

  /**
   * Check if a string appears to be encrypted
   */
  isEncrypted(data: string): boolean {
    try {
      const jsonStr = Buffer.from(data, 'base64').toString('utf8');
      const parsed = JSON.parse(jsonStr);
      return !!(parsed.version && parsed.iv && parsed.encryptedData && parsed.authTag && parsed.salt);
    } catch {
      return false;
    }
  }

  /**
   * Hash a value (one-way, for comparisons)
   */
  hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  /**
   * Check if ENCRYPTION_KEY is configured
   */
  isConfigured(): boolean {
    return !!process.env.ENCRYPTION_KEY;
  }

  /**
   * Generate a secure random encryption key (for initial setup)
   */
  static generateKey(): string {
    return crypto.randomBytes(32).toString('base64');
  }
}

export const encryptionService = new EncryptionService();

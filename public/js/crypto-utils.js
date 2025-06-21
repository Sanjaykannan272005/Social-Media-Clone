/**
 * Utility functions for end-to-end encryption
 */

// Generate a key pair for the current user
async function generateKeyPair() {
  try {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"]
    );
    
    // Export the public key to store in the database
    const publicKeyExported = await window.crypto.subtle.exportKey(
      "spki",
      keyPair.publicKey
    );
    
    // Export the private key to store in local storage
    const privateKeyExported = await window.crypto.subtle.exportKey(
      "pkcs8",
      keyPair.privateKey
    );
    
    // Convert to base64 for storage
    const publicKeyBase64 = arrayBufferToBase64(publicKeyExported);
    const privateKeyBase64 = arrayBufferToBase64(privateKeyExported);
    
    // Store private key in local storage
    localStorage.setItem('privateKey', privateKeyBase64);
    
    return {
      publicKey: publicKeyBase64,
      privateKey: privateKeyBase64
    };
  } catch (error) {
    console.error('Error generating key pair:', error);
    throw error;
  }
}

// Import a public key from base64
async function importPublicKey(publicKeyBase64) {
  try {
    const publicKeyBuffer = base64ToArrayBuffer(publicKeyBase64);
    
    return await window.crypto.subtle.importKey(
      "spki",
      publicKeyBuffer,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      true,
      ["encrypt"]
    );
  } catch (error) {
    console.error('Error importing public key:', error);
    throw error;
  }
}

// Import a private key from base64
async function importPrivateKey(privateKeyBase64) {
  try {
    const privateKeyBuffer = base64ToArrayBuffer(privateKeyBase64);
    
    return await window.crypto.subtle.importKey(
      "pkcs8",
      privateKeyBuffer,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      true,
      ["decrypt"]
    );
  } catch (error) {
    console.error('Error importing private key:', error);
    throw error;
  }
}

// Encrypt a message with a public key
async function encryptMessage(publicKey, message) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    
    const encryptedData = await window.crypto.subtle.encrypt(
      {
        name: "RSA-OAEP"
      },
      publicKey,
      data
    );
    
    return arrayBufferToBase64(encryptedData);
  } catch (error) {
    console.error('Error encrypting message:', error);
    throw error;
  }
}

// Decrypt a message with a private key
async function decryptMessage(privateKey, encryptedMessage) {
  try {
    const encryptedData = base64ToArrayBuffer(encryptedMessage);
    
    const decryptedData = await window.crypto.subtle.decrypt(
      {
        name: "RSA-OAEP"
      },
      privateKey,
      encryptedData
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  } catch (error) {
    console.error('Error decrypting message:', error);
    throw error;
  }
}

// Helper function to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Helper function to convert Base64 to ArrayBuffer
function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
// ---------- Initialisation ---------- \\

import express from 'express';
import chalk from 'chalk';
import fs from 'fs';
import readline from 'readline';
import { unescape } from 'querystring';
import { Certificate } from 'crypto';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// ---------- Whitelisted IP Addresses ---------- \\

const whitelistFilePath = './whitelist.json'

function loadWhitelist() {
    if (fs.existsSync(whitelistFilePath)) {
        const data = fs.readFileSync(whitelistFilePath, 'utf-8')
        return JSON.parse(data)
    }

    // If JSON unavalable
    return [];
}

let whitelist = loadWhitelist()



// ---------- Blacklisted Websites ---------- \\

const blacklistFilePath = './blacklist.json'

function loadBlacklist() {
    if (fs.existsSync(blacklistFilePath)) {
        const data = fs.readFileSync(blacklistFilePath, 'utf-8')
        return JSON.parse(data)
    }

    // If JSON unavalable
    return [];
}

let blacklist = loadBlacklist()



// ---------- Cyphering ---------- \\

function caesarCipher(str, shift, decrypt = false) {
    const offset = decrypt ? -shift : shift;
        return str.split('').map(char => {
            if (char >= 'A' && char <= 'Z') {
                return String.fromCharCode(((char.charCodeAt(0) - 65 + offset + 26) % 26) + 65);
            } else if (char >= 'a' && char <= 'z') {
                return String.fromCharCode(((char.charCodeAt(0) - 97 + offset + 26) % 26) + 97);
            }
        return char; // Return non-alphabetic characters as is
    }).join('');
}

function escapeSpecialChars(str) {
    return str.replace(/[\s\S]/g, function(char) {
        const code = char.codePointAt(0);
        if (code > 0x7F) {
            // Use \u{XXXX} for code points above 0xFFFF (emojis, etc.)
            return code > 0xFFFF
                ? '\\u{' + code.toString(16).toUpperCase() + '}'
                : '\\u' + code.toString(16).padStart(4, '0').toUpperCase();
        }
        // ASCII chars are returned as is
        return char;
    });
}

function unescapeSpecialChars(str) {
    // Replace \u{XXXXXX}
    str = str.replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, code) =>
        String.fromCodePoint(parseInt(code, 16))
    );
    // Replace \uXXXX
    str = str.replace(/\\u([0-9a-fA-F]{4})/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16))
    );
    return str;
}


// ---------- Base64 ---------- \\

function base64(str, direction) {
    if (direction === "encrypt") {
        return Buffer.from(str, 'utf8').toString('base64');
    } else if (direction === "decrypt") {
        return Buffer.from(str, 'base64').toString('utf8');
    }
}



// ---------- Testing ---------- \\

function testEncryption() {
    // Ceasar Cypher
    const testText = "Hello, World! Привет 👋"
    const encryptedText = caesarCipher(escapeSpecialChars(testText), 3)
    const decryptedText = caesarCipher(encryptedText, 3, true)

    if (escapeSpecialChars(testText) == decryptedText) {
        console.log(`Encryption self-test (part 1 of 3): [${chalk.green(`PASS`)}]`)
    } else {
        console.log(`Encryption self-test (part 1 of 3): [${chalk.red(`FAIL`)}]`)
        console.log(`Encrypted text: ${chalk.grey(encryptedText)}`)
        console.log(`Decrypted text: ${chalk.grey(decryptedText)}`)
    }

    // Base64
    const base64Text = base64(escapeSpecialChars(testText), "encrypt")
    const unbase64Text = base64(base64Text, "decrypt")

    if (escapeSpecialChars(testText) == unbase64Text) {
        console.log(`Encryption self-test (part 2 of 3): [${chalk.green(`PASS`)}]`)
    } else {
        console.log(`Encryption self-test (part 2 of 3): [${chalk.red(`FAIL`)}]`)
        console.log(`Base64: ${chalk.grey(base64Text)}`)
        console.log(`Reverse Base64: ${chalk.grey(unbase64Text)}`)
    }

    // Both
    const fullEncryptedText = base64(escapeSpecialChars(testText), "encrypt");
    const fullDecryptedText = base64(fullEncryptedText, "decrypt");

    if (escapeSpecialChars(testText) == fullDecryptedText) {
        console.log(`Encryption self-test (part 3 of 3): [${chalk.green(`PASS`)}]`);
    } else {
        console.log(`Encryption self-test (part 3 of 3): [${chalk.red(`FAIL`)}]`);
        console.log(`Complete encryption: ${chalk.grey(fullEncryptedText)}`);
        console.log(`Reverse complete encryption: ${chalk.grey(fullDecryptedText)}`);
        console.log(`Unescaped: ${chalk.grey(unescapeSpecialChars(fullDecryptedText))}`);
    }

    console.log("")
}


// ---------- Exports ---------- \\

export { whitelist, blacklist, caesarCipher, base64, testEncryption };
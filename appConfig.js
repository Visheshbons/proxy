// ---------- Initialisation ---------- \\

import express from 'express';
import chalk from 'chalk';
import fs from 'fs';



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



// ---------- Exports ---------- \\

export { whitelist, blacklist };
#!/usr/bin/env node
/**
 * Generate QR Code for Mobile Testing
 *
 * Usage: node scripts/qr.mjs [url]
 */

import { networkInterfaces } from 'node:os';
import qrcode from 'qrcode-terminal';

function getLocalIP() {
	const nets = networkInterfaces();

	for (const name of Object.keys(nets)) {
		for (const net of nets[name]) {
			const familyV4 = typeof net.family === 'string' ? 'IPv4' : 4;
			if (net.family === familyV4 && !net.internal) {
				return net.address;
			}
		}
	}

	return 'localhost';
}

// Get URL from args or construct default
const url = process.argv[2] || `http://${getLocalIP()}:5173`;

console.log('\n📱 Scan this QR code with your phone:\n');
qrcode.generate(url, { small: true });
console.log(`\n🔗 ${url}\n`);

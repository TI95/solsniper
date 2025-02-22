import { Keypair } from '@solana/web3.js';

// Создание нового кошелька
const wallet = Keypair.generate();

console.log('Public Key:', wallet.publicKey.toBase58());
console.log('Private Key:', wallet.secretKey);

 
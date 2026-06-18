import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { getConnection } from './connection';

/**
 * Transfers `lamports` SOL from `from` to `to` and waits for confirmation.
 * Isolated from wallet-service so the service can be unit-tested with this mocked.
 * Returns the transaction signature.
 */
export async function transferSol(
  from: Keypair,
  to: PublicKey,
  lamports: number
): Promise<string> {
  const connection: Connection = getConnection();
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: from.publicKey,
      toPubkey: to,
      lamports,
    })
  );
  return sendAndConfirmTransaction(connection, tx, [from]);
}

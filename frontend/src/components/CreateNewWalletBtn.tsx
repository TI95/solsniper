import { useState } from "react";
import { Keypair } from "@solana/web3.js";

export default function WalletGenerator() {
  const [wallet, setWallet] = useState<{
    publicKey: string;
    secretKey: Uint8Array | null;
  }>({
    publicKey: "",
    secretKey: null,
  });

  const generateWallet = () => {
    const newWallet = Keypair.generate();
    setWallet({
      publicKey: newWallet.publicKey.toBase58(),
      secretKey: newWallet.secretKey, // ⚠️ секретный ключ лучше не показывать в UI
    });

    console.log("Public Key:", newWallet.publicKey.toBase58());
    console.log("Private Key:", newWallet.secretKey);
  };

  return (
    <div className="p-4">
      <button
        onClick={generateWallet}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors"
      >
        Создать кошелёк
      </button>

      {wallet.publicKey && (
        <div className="mt-4">
          <p><b>Public Key:</b> {wallet.publicKey}</p>
          <p><b>Secret Key:</b> {wallet.secretKey?.toString()}</p>
        </div>
      )}
    </div>
  );
}
 

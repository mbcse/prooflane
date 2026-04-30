import { Indexer, MemData } from "@0gfoundation/0g-storage-ts-sdk";
import { ethers } from "ethers";
import { storageScanRootUrl } from "./explorers";

export type StoreEvidenceResult = {
  rootHash: string;
  txHash: string;
  storagescanUrl: string;
};

/**
 * Upload JSON evidence to 0G Storage (MemData + indexer upload).
 * Requires ZERO_G_EVM_RPC, ZERO_G_INDEXER_RPC, ZERO_G_STORAGE_PRIVATE_KEY (Galileo-funded wallet).
 * TODO: Production: use KMS for signing key, encryption at rest, rate limits.
 */
export async function storeEvidence(payload: unknown): Promise<StoreEvidenceResult> {
  const rpcUrl = process.env.ZERO_G_EVM_RPC;
  const indexerRpc = process.env.ZERO_G_INDEXER_RPC;
  const pk = process.env.ZERO_G_STORAGE_PRIVATE_KEY;

  if (!rpcUrl || !indexerRpc || !pk) {
    const json = JSON.stringify(payload);
    const hash = Buffer.from(json).toString("hex").slice(0, 64);
    const fakeTx = `0x${"0".repeat(64)}`;
    console.warn(
      "[0G] storeEvidence: ZERO_G_* not set. Using local content hash until keys are configured.",
    );
    return {
      rootHash: `local-${hash.slice(0, 32)}`,
      txHash: fakeTx,
      storagescanUrl: storageScanRootUrl(`local-${hash.slice(0, 16)}`),
    };
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(pk, provider);
  const indexer = new Indexer(indexerRpc);

  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const memData = new MemData(bytes);
  const [, treeErr] = await memData.merkleTree();
  if (treeErr !== null) throw new Error(`Merkle tree: ${treeErr}`);

  const [tx, uploadErr] = await indexer.upload(memData, rpcUrl, signer);
  if (uploadErr !== null) throw new Error(`0G upload: ${uploadErr}`);

  let rootHash: string;
  let txHash: string;
  if (tx && typeof tx === "object" && "rootHash" in tx && "txHash" in tx) {
    rootHash = String((tx as { rootHash: string }).rootHash);
    txHash = String((tx as { txHash: string }).txHash);
  } else {
    throw new Error("Unexpected 0G upload response shape");
  }

  return {
    rootHash,
    txHash,
    storagescanUrl: storageScanRootUrl(rootHash),
  };
}

import { chainTxUrl } from "./explorers";

export type AnchorSnapshotResult = {
  txHash: string;
  explorerUrl: string;
};

/**
 * Anchor a compliance snapshot commitment on-chain.
 * v1: re-use the storage upload transaction as the verifiable anchor (same tx proves blob + chain receipt).
 * TODO: Optional: submit additional DA blob via 0G DA stack (see https://docs.0g.ai/developer-hub/building-on-0g/da-integration).
 */
export async function anchorSnapshot(storageTxHash: string): Promise<AnchorSnapshotResult> {
  return {
    txHash: storageTxHash,
    explorerUrl: chainTxUrl(storageTxHash),
  };
}

import { Indexer, MemData } from "@0gfoundation/0g-storage-ts-sdk";
import { ethers } from "ethers";
import { storageScanRootUrl } from "./explorers";

/** The 0G SDK logs every second while the indexer catches up; suppress unless ZERO_G_VERBOSE_STORAGE=1 */
function withOptionalQuietSdkLogs<T>(run: () => Promise<T>): Promise<T> {
  if (process.env.ZERO_G_VERBOSE_STORAGE === "1") {
    return run();
  }
  const prev = console.log;
  console.log = (...args: unknown[]) => {
    const msg = args.map(String).join(" ");
    if (msg.includes("Waiting for storage node to sync")) return;
    prev.apply(console, args);
  };
  return run().finally(() => {
    console.log = prev;
  });
}

export type StoreEvidenceResult = {
  rootHash: string;
  txHash: string;
  storagescanUrl: string;
  /** Set when upload was skipped: missing env, timeout waiting on indexer sync, or upload error fallback. */
  degraded?: boolean;
};

function localEvidenceStore(payload: unknown): StoreEvidenceResult {
  const json = JSON.stringify(payload);
  const hash = Buffer.from(json).toString("hex").slice(0, 64);
  const fakeTx = `0x${"0".repeat(64)}`;
  return {
    rootHash: `local-${hash.slice(0, 32)}`,
    txHash: fakeTx,
    storagescanUrl: storageScanRootUrl(`local-${hash.slice(0, 16)}`),
    degraded: true,
  };
}

function resolveUploadTimeoutMs(): number | null {
  const raw = process.env.ZERO_G_STORAGE_UPLOAD_TIMEOUT_MS;
  if (raw === undefined || raw === "") return 180_000;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 180_000;
  if (n <= 0) return null;
  return n;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let id: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    id = setTimeout(() => reject(new Error(`${label} exceeded ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, deadline]);
  } finally {
    clearTimeout(id!);
  }
}

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
    console.warn(
      "[0G] storeEvidence: ZERO_G_* not set. Using local content hash until keys are configured.",
    );
    return localEvidenceStore(payload);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(pk, provider);
  const indexer = new Indexer(indexerRpc);

  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const memData = new MemData(bytes);
  const [, treeErr] = await memData.merkleTree();
  if (treeErr !== null) throw new Error(`Merkle tree: ${treeErr}`);

  const timeoutMs = resolveUploadTimeoutMs();
  const runUpload = () =>
    withOptionalQuietSdkLogs(() => indexer.upload(memData, rpcUrl, signer));

  try {
    const raced =
      timeoutMs === null
        ? await runUpload()
        : await withTimeout(runUpload(), timeoutMs, "0G Storage upload (indexer sync)");

    const [tx, uploadErr] = raced;
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(
      `[0G] storeEvidence: upload did not finish (${msg}). Continuing with local content hash so the run can complete.`,
    );
    return localEvidenceStore(payload);
  }
}

/** Galileo testnet explorer helpers. See https://docs.0g.ai/developer-hub/testnet/testnet-overview */

const CHAINSCAN_TESTNET = "https://chainscan-galileo.0g.ai";
const STORAGESCAN_TESTNET = "https://storagescan-galileo.0g.ai";

export function chainTxUrl(txHash: string): string {
  return `${CHAINSCAN_TESTNET}/tx/${txHash}`;
}

export function storageScanRootUrl(rootHash: string): string {
  return `${STORAGESCAN_TESTNET}/?root=${encodeURIComponent(rootHash)}`;
}

/** Galileo testnet explorer; mirrors backend helper, UI-only. */
const CHAINSCAN_TESTNET = "https://chainscan-galileo.0g.ai";

export function chainTxUrl(txHash: string): string {
  return `${CHAINSCAN_TESTNET}/tx/${txHash}`;
}

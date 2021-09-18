import { FlashbotsBundleProvider, FlashbotsBundleTransaction } from "@flashbots/ethers-provider-bundle";

import { BlockTag } from "@ethersproject/abstract-provider";
import { BigNumber } from "ethers";

export async function checkSimulation(
  flashbotsProvider: FlashbotsBundleProvider,
  signedBundle: Array<string>,
  timestamp?: number,
  blockNumber?: BlockTag,
): Promise<[BigNumber, BigNumber]> {
  if (timestamp != null) {
    console.log("Simulating timestamp", timestamp);
  }
  blockNumber = blockNumber ?? "latest";
  const simulationResponse = await flashbotsProvider.simulate(signedBundle, blockNumber, undefined, timestamp);

  if ("results" in simulationResponse) {
    for (let i = 0; i < simulationResponse.results.length; i++) {
      const txSimulation = simulationResponse.results[i];
      if ("error" in txSimulation) {
        throw new Error(`TX #${i} : ${txSimulation.error} ${txSimulation.revert}`);
      }
    }

    const gasUsed = simulationResponse.results.reduce((acc: number, txSimulation) => acc + txSimulation.gasUsed, 0);

    const gasPrice = simulationResponse.coinbaseDiff.div(gasUsed);
    return [gasPrice, BigNumber.from(gasUsed)];
  }

  console.error(`Similuation failed, error code: ${simulationResponse.error.code}`);
  console.error(simulationResponse.error.message);
  throw new Error("Failed to simulate response");
}

export async function printTransactions(
  bundleTransactions: Array<FlashbotsBundleTransaction>,
  signedBundle: Array<string>,
): Promise<void> {
  console.log(
    "--------------------------------\n" +
      (
        await Promise.all(
          bundleTransactions.map(
            async (bundleTx, index) =>
              `TX #${index} (${bundleTx.transaction.nonce ?? "?"}): ${await bundleTx.signer.getAddress()} => ${
                bundleTx.transaction.to
              }`,
          ),
        )
      ).join("\n"),
  );
  console.log("--------------------------------");
}

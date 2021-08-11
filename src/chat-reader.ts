import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL || "http://127.0.0.1:8545";
console.log(ETHEREUM_RPC_URL);

// let provider = new ethers.providers.JsonRpcProvider(ETHEREUM_RPC_URL);
let provider = new ethers.providers.InfuraProvider("mainnet", process.env.INFURA_API_KEY);

async function decodeTxs(blockNumber: number, address: string) {
  let block = await provider.getBlockWithTransactions(blockNumber);
  for (let tx of block.transactions) {
    if (tx.from != address && tx.to != address) {
      continue;
    }
    // Uncomment to only read FROM messages
    // if (tx.from != address) {
    //   continue;
    // }
    if (tx.data == "0x") {
      continue;
    }
    let fromString = "FROM";
    if (tx.from != address && tx.to == address) {
      fromString = "TO";
    }
    if (tx.from == address) {
      console.log("---------------------------");
    }
    try {
      let data = tx.data;
      console.log(`Block ${blockNumber}, ${fromString}, Tx ${tx.hash.slice(0, 8)}: ${ethers.utils.toUtf8String(data)}`);
    } catch (e) {
      console.log(`Block ${blockNumber}, ${fromString}, Tx ${tx.hash.slice(0, 8)}: Unable to decode`);
    }
  }
}

async function main() {
  let startBlock = 12997793;
  // let startBlock = 13005785;
  let latestBlock = await provider.getBlockNumber();

  let address = "0xc8a65fadf0e0ddaf421f28feab69bf6e2e589963";

  for (let blockNumber = startBlock; blockNumber <= latestBlock; blockNumber++) {
    await decodeTxs(blockNumber, address);
    if (blockNumber % 100 == 0) {
      console.log("Scanned to block", blockNumber);
    }
  }

  console.log("Switching to live update");
  provider.on("block", async blockNumber => {
    if (blockNumber % 100 == 0) {
      console.log("Scanned to block", blockNumber);
    }
    await decodeTxs(blockNumber, address);
  });
}

main();

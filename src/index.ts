import { ethers, Wallet, BigNumber } from "ethers";
import * as dotenv from "dotenv";
import { program } from "commander";
import { ERC20_INTERFACE } from "./abis/ERC20-interface";
import { FlashbotsBundleProvider, FlashbotsBundleResolution } from "@flashbots/ethers-provider-bundle";
import { checkSimulation } from "./utils";

dotenv.config();

const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL || "http://127.0.0.1:8545";
console.log(ETHEREUM_RPC_URL);
const FLASHBOTS_RELAY_SIGNING_KEY = process.env.FLASHBOTS_RELAY_SIGNING_KEY || getDefaultRelaySigningKey();

if (FLASHBOTS_RELAY_SIGNING_KEY === "") {
  console.warn(
    "Must provide FLASHBOTS_RELAY_SIGNING_KEY. Please see https://github.com/flashbots/pm/blob/main/guides/searcher-onboarding.md",
  );
  process.exit(1);
}

const NETWORK = process.env.NETWORK || "";
const FLASHBOTS_RELAY = process.env.FLASHBOTS_RELAY || "";

let provider = new ethers.providers.JsonRpcProvider(ETHEREUM_RPC_URL);

// Uncomment to use INFURA provider
// const provider = new ethers.providers.InfuraProvider(
//   // This should be mainnet, kovan, rikenby or ropsten
//   NETWORK,
//   process.env.INFURA_API_KEY,
// );

function getWallet(): Wallet {
  let mnemonic = process.env.MNEMONIC;
  if (mnemonic == null) {
    console.log("THIS IS A TEMP ADDRESS. Please fill in the MNEMONIC field in the .env file");
    let wallet = Wallet.createRandom();
    let mnemonic = wallet.mnemonic;
    console.log("12-word seed: " + mnemonic.phrase);
    return wallet;
  } else {
    let wallet = Wallet.fromMnemonic(mnemonic).connect(provider);
    return wallet;
  }
}

export function getDefaultRelaySigningKey(): string {
  console.warn(
    "You have not specified an explicity FLASHBOTS_RELAY_SIGNING_KEY environment variable. Creating random signing key, this searcher will not be building a reputation for next run",
  );
  return Wallet.createRandom().privateKey;
}

async function sendFBBundle(
  wallet: Wallet,
  signedTx: string,
  blockNumber: number,
  flashbotsProvider: FlashbotsBundleProvider,
): Promise<FlashbotsBundleResolution | undefined> {
  let nonce = await wallet.getTransactionCount();

  let dummyTx = await wallet.populateTransaction({
    to: wallet.address,
    value: 0,
    nonce: nonce + 1,
  });
  let signedDummyTx = await wallet.signTransaction(dummyTx);

  let [gasPrice, gasUsed] = await checkSimulation(flashbotsProvider, [signedTx, signedDummyTx]);

  let bundleToSend = [signedTx];
  if (gasUsed.lt(BigNumber.from(42000))) {
    bundleToSend.push(signedDummyTx);
  }
  try {
    let bundleResponse = await flashbotsProvider.sendRawBundle(bundleToSend, blockNumber);
    console.log("!!! BUNDLE SUBMITTED !!!");
    if ("error" in bundleResponse) {
      console.log("Error in bundle", Error(bundleResponse.error.message));
      return;
    }
    const bundleResolution = await bundleResponse.wait();
    // let checkBundleStatus = flashbotsProvider.getBundleStats(, blockNumber + 1);
    if (bundleResolution == FlashbotsBundleResolution.BundleIncluded) {
      console.log(`### BUNDLE INCLUDED ###`);
      return bundleResolution;
    } else if (bundleResolution == FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
      console.log(`Block passed without inclusion`);
      return bundleResolution;
    } else if (bundleResolution == FlashbotsBundleResolution.AccountNonceTooHigh) {
      console.log(`Account nonce too high`);
    }
  } catch (e) {
    console.log("An error occurred when sending the bundle");
  }
}

program.command("address").action(async options => {
  let wallet = getWallet();
  console.log(wallet.address);
});

program.command("balance [address]").action(async (address: string, options) => {
  if (address == null) {
    address = getWallet().address;
  }
  let balance = await provider.getBalance(address);
  console.log(ethers.utils.formatEther(balance));
});

program
  .command("transfer <to> <amount>")
  .option("-fb, --flashbots")
  .option("-dr, --dry_run")
  .action(async (to: string, amount: string, options) => {
    let wallet = getWallet();
    let feeData = await provider.getFeeData();
    let nonce = await wallet.getTransactionCount();
    let tx = await wallet.populateTransaction({
      to,
      value: ethers.utils.parseEther(amount),
      nonce,
    });
    if (options.dry_run) {
      console.log("DRY RUN");
      console.log("Broadcasting tx");
      console.log(tx);
      return;
    }
    if (options.flashbots) {
      const flashbotsProvider = await FlashbotsBundleProvider.create(provider, wallet, FLASHBOTS_RELAY, NETWORK);

      let signedTx = await wallet.signTransaction(tx);
      provider.on("block", async blockNumber => {
        try {
          console.log(`[${blockNumber}] New block seen`);
          let res = await sendFBBundle(wallet, signedTx, blockNumber + 1, flashbotsProvider);
          if (res != FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
            process.exit(0);
          }
        } catch (err) {
          console.log(`[${blockNumber}] Error processing`, err);
        }
      });
    } else {
      let tx_rec = await wallet.sendTransaction(tx);
      console.log(`Transaction at: https://${NETWORK}.etherscan.io/tx/${tx_rec.hash}`);
      await tx_rec.wait(1);
      console.log("Tx mined");
    }
  });

program
  .command("transfer_token <token> <to> <amount>")
  .option("-fb, --flashbots")
  .option("-dr, --dry_run")
  .action(async (token: string, to: string, amount: string, options) => {
    let wallet = getWallet();

    let erc20 = new ethers.Contract(token, ERC20_INTERFACE, wallet);

    let decimals = await erc20.decimals();
    const amountHex = ethers.utils.parseUnits(amount, decimals);

    let tx = await erc20.transfer(to, amountHex);

    if (options.dry_run) {
      console.log("DRY RUN");
      console.log("Broadcasting tx");
      console.log(tx);
      return;
    }

    if (options.flashbots) {
      const flashbotsProvider = await FlashbotsBundleProvider.create(provider, wallet, FLASHBOTS_RELAY, NETWORK);

      let signedTx = await wallet.signTransaction(tx);
      provider.on("block", async blockNumber => {
        try {
          console.log(`[${blockNumber}] New block seen`);
          let res = await sendFBBundle(wallet, signedTx, blockNumber + 1, flashbotsProvider);
          if (res != FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
            process.exit(0);
          }
        } catch (err) {
          console.log(`[${blockNumber}] Error processing`, err);
        }
      });
    } else {
      let tx_rec = await wallet.sendTransaction(tx);
      console.log(`Transaction at: https://${NETWORK}.etherscan.io/tx/${tx_rec.hash}`);
      await tx_rec.wait(1);
      console.log("Tx mined");
    }
  });

program.command("balance_token <token> [address]").action(async (token: string, address: string, options) => {
  if (address == null) {
    address = getWallet().address;
  }
  let erc20 = new ethers.Contract(token, ERC20_INTERFACE, provider);
  const balance = await erc20.balanceOf(address);
  let decimals = await erc20.decimals();

  console.log("Token Balance:", ethers.utils.formatUnits(balance, decimals));
});

program.command("sign_message <data>").action(async (data: string, options) => {
  let wallet = getWallet();
  let signature = await wallet.signMessage(data);
  console.log("Sig", signature);

  let recoveredAddress = ethers.utils.verifyMessage(data, signature);
  console.log("Address", recoveredAddress);
});

program.command("send_hex_message <text> [to]").action(async (text: string, to: string, options) => {
  let wallet = getWallet();
  if (to == undefined) {
    to = wallet.address;
  }

  let tx = {
    to: to,
    data: ethers.utils.toUtf8Bytes(text),
  };

  let tx_rec = await wallet.sendTransaction(tx);
  console.log(`Transaction at: https://${NETWORK}.etherscan.io/tx/${tx_rec.hash}`);
  await tx_rec.wait(1);
  console.log("Tx mined");
});

program.parse(process.argv);

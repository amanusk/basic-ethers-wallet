import { ethers, Wallet } from "ethers";
import * as dotenv from "dotenv";
import { program } from "commander";
import { ERC20_INTERFACE } from "./abis/ERC20-interface";

dotenv.config();

const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL || "http://127.0.0.1:8545";
console.log(ETHEREUM_RPC_URL);

const NETWORK = process.env.NETWORK || "";

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

program.command("transfer <to> <amount>").action(async (to: string, amount: string, options) => {
  let wallet = getWallet();
  let feeData = await provider.getFeeData();
  let nonce = await wallet.getTransactionCount();
  if (feeData.maxPriorityFeePerGas !== null && feeData.maxFeePerGas !== null) {
    let tx = await wallet.populateTransaction({
      to,
      value: ethers.utils.parseEther(amount),
      nonce,
    });
    console.log("Tx", tx);
    let tx_rec = await wallet.sendTransaction(tx);
    console.log(`Transaction at: https://${NETWORK}.etherscan.io/tx/${tx_rec.hash}`);
    await tx_rec.wait(1);
    console.log("Tx mined");
  }
});

program
  .command("transfer_token <token> <to> <amount>")
  .action(async (token: string, to: string, amount: string, options) => {
    let wallet = getWallet();

    let erc20 = new ethers.Contract(token, ERC20_INTERFACE, wallet);

    let decimals = await erc20.decimals();
    const amountHex = ethers.utils.parseUnits(amount, decimals);

    let tx = await erc20.transfer(to, amountHex);
    console.log(`Transaction at: https://${NETWORK}.etherscan.io/tx/${tx.hash}`);
    await tx.wait(1);
    console.log("Tx mined");
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

program.parse(process.argv);

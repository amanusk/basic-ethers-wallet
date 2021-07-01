import { ethers, Wallet } from 'ethers';
import * as dotenv from 'dotenv';
import { program } from 'commander';
import { ERC20_INTERFACE } from './abis/ERC20-interface';

const provider = new ethers.providers.InfuraProvider(
  // This should be mainnet, kovan, rikenby or ropsten
  'kovan',
  process.env.INFURA_API_KEY,
);

// let url = 'http://192.168.1.25:18545';
// let provider = new ethers.providers.JsonRpcProvider(url);

function getWallet(): Wallet {
  let mnemonic = process.env.MNEMONIC;
  if (mnemonic == null) {
    console.log(
      'THIS IS A TEMP ADDRESS. Please fill in the MNEMONIC field in the .env file',
    );
    let wallet = Wallet.createRandom();
    let mnemonic = wallet.mnemonic;
    console.log('12-word seed: ' + mnemonic.phrase);
    return wallet;
  } else {
    let wallet = Wallet.fromMnemonic(mnemonic).connect(provider);
    return wallet;
  }
}

program.command('address').action(async (options) => {
  let wallet = getWallet();
  console.log(wallet.address);
});

program
  .command('balance [address]')
  .action(async (address: string, options) => {
    if (address == null) {
      address = getWallet().address;
    }
    let balance = await provider.getBalance(address);
    console.log(ethers.utils.formatEther(balance));
  });

program
  .command('transfer <to> <amount>')
  .action(async (to: string, amount: string, options) => {
    let wallet = getWallet();
    let tx = await wallet.sendTransaction({
      to,
      value: ethers.utils.parseEther(amount),
    });
    console.log(
      'Transaction at: ' + 'https://kovan.etherscan.io/tx/' + tx.hash,
    );
    await tx.wait(1);
    console.log('Tx mined');
  });

program
  .command('transfer_token <token> <to> <amount>')
  .action(async (token: string, to: string, amount: string, options) => {
    let wallet = getWallet();

    let erc20 = new ethers.Contract(token, ERC20_INTERFACE, wallet);

    let decimals = await erc20.decimals();
    const amountHex = ethers.utils.parseUnits(amount, decimals);

    let tx = await erc20.transfer(to, amountHex);
    console.log(
      'Transaction at: ' + 'https://kovan.etherscan.io/tx/' + tx.hash,
    );
    await tx.wait(1);
    console.log('Tx mined');
  });

program
  .command('balance_token <token> [address]')
  .action(async (token: string, address: string, options) => {
    if (address == null) {
      address = getWallet().address;
    }
    let erc20 = new ethers.Contract(token, ERC20_INTERFACE, provider);
    const balance = await erc20.balanceOf(address);
    let decimals = await erc20.decimals();

    console.log('Balance:', ethers.utils.formatUnits(balance, decimals));
  });

program.command('sign_message <data>').action(async (data: string, options) => {
  let wallet = await getWallet();
  let signature = await wallet.signMessage(data);
  console.log('Sig', signature);

  let recoveredAddress = ethers.utils.verifyMessage(data, signature);
  console.log('Address', recoveredAddress);
});

dotenv.config();
program.parse(process.argv);

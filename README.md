# Basic Ethers wallet

Basic cli wrapper to work with the ethres wallet class. Basic supported funcitonality:

- Get balance of address ETH + token
- Send ETH/Token
- Sign message

## Installation

```
yarn install
yarn build
```

## Running commands

Get wallet address

```
ts-node ./src/index.ts address
```

Get wallet or any other address balance

```
ts-node ./src/index.ts balance [address]
```

Get ERC20 token balance

```
ts-node ./src/index.ts balance_token <token_address> [address]
```

Transfer ETH from wallet

```
ts-node ./src/index.ts transfer <to> <amount>
```

Transfer ERC20 from wallet

```
ts-node ./src/index.ts transfer_token <token_address> <to> <amount>
```

## Thanks

If you like it than you soulda put a start ⭐ on it

Twitter: [@amanusk\_](https://twitter.com/amanusk_)

## License

MIT

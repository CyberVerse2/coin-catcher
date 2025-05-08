import { http, cookieStorage, createConfig, createStorage } from "wagmi";
import { baseSepolia, base } from "wagmi/chains";
import { coinbaseWallet } from "wagmi/connectors";
import { parseEther, toHex } from 'viem';

export function getConfig() {
  return createConfig({
    chains: [baseSepolia, base],
    connectors: [
      coinbaseWallet({
        appName: "My Sub Account Demo",
        preference: {
          keysUrl: "https://keys-dev.coinbase.com/connect",
          options: "smartWalletOnly",
        },
        subAccounts: {
          enableAutoSubAccounts: false,
          defaultSpendLimits: {
            84532: [
              {
                token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
                allowance: toHex(parseEther('0.01')),
                period: 86400,
              },
            ],
            8453: [
              {
                token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
                allowance: toHex(parseEther('0.01')),
                period: 86400,
              },
            ],
          },
        },
      }),
    ],
    storage: createStorage({
      storage: cookieStorage,
    }),
    ssr: true,
    transports: {
      [baseSepolia.id]: http(),
      [base.id]: http(),
    },
  });
}

declare module "wagmi" {
  interface Register {
    config: ReturnType<typeof getConfig>;
  }
}

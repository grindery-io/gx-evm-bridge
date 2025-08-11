import "./App.css";
import {
  createAppKit,
  useAppKitAccount,
  useAppKitProvider,
  useAppKitNetwork,
  useAppKitTheme,
} from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { polygon, mainnet } from "@reown/appkit/networks";
import { useEffect, useMemo, useState } from "react";
import { BrowserProvider, ethers } from "ethers";
import { CATERC20 } from "./CATERC20";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { ModeToggle } from "./components/mode-toggle";
import { useTheme } from "./components/theme-provider";

// 1. Get projectId
const projectId = "3412d7ac48bc6355f82302fb11dd3679";

// 2. Set the networks
const networks = [polygon, mainnet];

// 3. Create a metadata object - optional
const metadata = {
  name: "GX EVM Bridge",
  description: "GX EVM Bridge",
  url: "https://gx-evm-bridge.grindery.com/", // origin must match your domain & subdomain
  icons: [],
};

// 4. Create a AppKit instance
createAppKit({
  adapters: [new EthersAdapter()],
  networks,
  metadata,
  projectId,
  features: {},
  themeMode: "dark",
});

const gxContract = new ethers.Contract(
  "0x8730762Cad4a27816A467fAc54e3dd1E2e9617A1",
  CATERC20
);

function App() {
  const { theme } = useTheme();
  const { setThemeMode } = useAppKitTheme();
  const [message, setMessage] = useState("");
  const [bridgeAmount, setBridgeAmount] = useState(0);
  const { address, isConnected } = useAppKitAccount();
  const network = useAppKitNetwork();
  const { walletProvider } = useAppKitProvider("eip155");
  const gx = useMemo(
    () =>
      walletProvider
        ? (gxContract.connect(
            new BrowserProvider(walletProvider as any)
          ) as ethers.Contract)
        : null,
    [walletProvider]
  );
  const [balance, setBalance] = useState(-1n);
  const [targetChainId, setTargetChainId] = useState(2);
  const [targetAddress, setTargetAddress] = useState("");

  useEffect(() => {
    setThemeMode(theme === "dark" ? "dark" : "light");
  }, [theme]);

  useEffect(() => {
    setBalance(-1n);
    if (!gx || !address) {
      return;
    }
    gx.balanceOf(address).then((b) => setBalance(b));
    setTargetChainId(network.chainId === 137 ? 2 : 5);
  }, [gx, address, network.chainId]);
  function submit() {
    setMessage("Processing...");
    (async () => {
      if (!isConnected || !address || !gx) throw Error("User disconnected");
      const signer = await new BrowserProvider(
        walletProvider as any
      ).getSigner();
      const gxWithSigner = gx.connect(signer) as ethers.Contract;
      const wormholeBridgeFee = await gxWithSigner.wormholeEstimatedFee(
        targetChainId
      );
      const gasBalance = (await gx.runner?.provider?.getBalance(address)) ?? 0n;
      if (wormholeBridgeFee > gasBalance) {
        throw new Error(
          `Need at least ${ethers.formatEther(
            wormholeBridgeFee
          )} gas fee to pay for provider fee`
        );
      }
      setMessage("Processing...");
      await gxWithSigner.bridgeOut(
        ethers.parseEther(bridgeAmount.toString()),
        targetChainId,
        ethers.zeroPadValue(targetAddress || address, 32),
        ethers.zeroPadValue(await gx.getAddress(), 32),
        { value: wormholeBridgeFee }
      );
    })().then(
      () =>
        setMessage(
          "Transaction submitted, you should receive fund in a few minutes"
        ),
      (e) => {
        console.error(e);
        setMessage(e.toString());
      }
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center relative p-4">
      <div className="absolute right-4 top-4 z-50">
        <ModeToggle />
      </div>
      <div className="container">
        <div className="w-full max-w-[380px] mx-auto p-6 border border-border rounded-lg space-y-8">
          <div>
            <h2 className="text-xl text-center !text-foreground font-bold">
              <img
                src="https://storage.googleapis.com/grindery-assets/token-icons/gx-token-icon%402x.svg"
                alt="GX Token icon"
                className="size-10 block mb-2 mx-auto"
              />{" "}
              Bridge
            </h2>
          </div>
          <div className="flex flex-row flex-wrap items-center justify-center gap-2 !text-foreground ">
            <w3m-button />
            <w3m-network-button />
          </div>
          {address && isConnected && (
            <>
              <div>
                <p className="text-muted-foreground text-sm mb-1">GX amount</p>
                <Input
                  type="text"
                  value={bridgeAmount.toString()}
                  inputMode="numeric"
                  onChange={(e) => {
                    setMessage("");
                    setBridgeAmount(
                      e.currentTarget.value
                        ? parseInt(e.currentTarget.value, 10) || bridgeAmount
                        : 0
                    );
                  }}
                  placeholder="Enter GX amount"
                />
                {balance >= 0 && (
                  <p className="text-muted-foreground text-xs mt-1 text-left">
                    GX balance:{" "}
                    <button
                      className="px-1 py-0.5 hover:bg-muted rounded cursor-pointer hover:text-primary"
                      onClick={() => {
                        setBridgeAmount(Number(ethers.formatEther(balance)));
                      }}
                    >
                      {Number(ethers.formatEther(balance)).toLocaleString()}
                    </button>
                  </p>
                )}
              </div>
              <div>
                <p className="mt-4 text-muted-foreground text-sm mb-1">
                  To address (optional)
                </p>
                <Input
                  type="text"
                  value={targetAddress}
                  placeholder="Leave empty to use connected wallet address"
                  onChange={(e) => {
                    setMessage("");
                    setTargetAddress(e.currentTarget.value);
                  }}
                />
              </div>
              {message && (
                <div
                  className={
                    message.toLowerCase().includes("error")
                      ? "bg-destructive/10 p-4 rounded-lg"
                      : "bg-muted/10 p-4 rounded-lg"
                  }
                >
                  <p
                    className={
                      message.toLowerCase().includes("error")
                        ? "text-destructive text-sm text-center"
                        : "text-muted-foreground text-sm text-center"
                    }
                  >
                    {message}
                  </p>
                </div>
              )}
              <div>
                <Button
                  onClick={submit}
                  disabled={
                    !isConnected ||
                    bridgeAmount <= 0 ||
                    balance < 0 ||
                    ethers.parseEther(bridgeAmount.toString()) > balance ||
                    !!(targetAddress && !ethers.isAddress(targetAddress))
                  }
                  className="cursor-pointer"
                >
                  {`Bridge to ${
                    network.chainId === 137 ? "Ethereum" : "Polygon"
                  }`}
                </Button>
              </div>
            </>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          <a
            href="https://www.grindery.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary hover:underline"
          >
            grindery.com
          </a>
        </p>
      </div>
    </main>
  );
}

export default App;

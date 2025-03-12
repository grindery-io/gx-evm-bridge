import './App.css';
import {
  createAppKit,
  useAppKitAccount,
  useAppKitProvider,
  useAppKitNetwork
} from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { polygon, mainnet } from '@reown/appkit/networks';
import { useEffect, useMemo, useState } from 'react';
import { BrowserProvider, ethers } from 'ethers';
import { CATERC20 } from './CATERC20';

// 1. Get projectId
const projectId = '0e81850aa66598baa09b4629ecbf3f11';

// 2. Set the networks
const networks = [polygon, mainnet];

// 3. Create a metadata object - optional
const metadata = {
  name: 'My Website',
  description: 'My Website description',
  url: 'https://mywebsite.com', // origin must match your domain & subdomain
  icons: ['https://avatars.mywebsite.com/'],
};

// 4. Create a AppKit instance
createAppKit({
  adapters: [new EthersAdapter()],
  networks,
  metadata,
  projectId,
  features: {},
});

const gxContract = new ethers.Contract('0x8730762Cad4a27816A467fAc54e3dd1E2e9617A1', CATERC20);

function App() {
  const [message, setMessage] = useState('');
  const [bridgeAmount, setBridgeAmount] = useState(0);
  const { address, isConnected } = useAppKitAccount();
  const network = useAppKitNetwork();
  const { walletProvider } = useAppKitProvider('eip155');
  const gx = useMemo(() => walletProvider ? gxContract.connect(new BrowserProvider(walletProvider as any)) as ethers.Contract : null, [walletProvider]);
  const [balance, setBalance] = useState(-1n);
  const [targetChainId, setTargetChainId] = useState(2);
  useEffect(() => {
    setBalance(-1n);
    if (!gx || !address) {
      return;
    }
    gx.balanceOf(address).then((b) => setBalance(b));
    setTargetChainId(network.chainId === 137 ? 2 : 5);
  }, [gx, address, network.chainId]);
  function submit() {
    setMessage('Processing...');
    (async () => {
      if (!isConnected || !address || !gx) throw Error('User disconnected');
      const signer = await new BrowserProvider(walletProvider as any).getSigner();
      const gxWithSigner = gx.connect(signer) as ethers.Contract;
      const wormholeBridgeFee = await gxWithSigner.wormholeEstimatedFee(targetChainId);
      const gasBalance = await gx.runner?.provider?.getBalance(address) ?? 0n;
      if (wormholeBridgeFee > gasBalance) {
        throw new Error(`Need at least ${ethers.formatEther(wormholeBridgeFee)} gas fee to pay for provider fee`);
      }
      setMessage('Processing...');
      await gxWithSigner.bridgeOut(
        ethers.parseEther(bridgeAmount.toString()),
        targetChainId,
        ethers.zeroPadValue(address, 32),
        ethers.zeroPadValue(await gx.getAddress(), 32),
        { value: wormholeBridgeFee }
      );
    })().then(
      () => setMessage('Transaction submitted, you should receive fund in a few minutes'),
      (e) => {
        console.error(e);
        setMessage(e.toString());
      }
    );
  }
  return (
    <>
      <p>
        <w3m-button />
        <w3m-network-button />
      </p>
      <p>Bridge amount</p>
      <input
        type="text"
        value={bridgeAmount.toString()}
        inputMode='numeric'
        onChange={(e) => setBridgeAmount(parseInt(e.currentTarget.value, 10) || bridgeAmount)}
      />
      {balance >= 0 && <p>GX balance: {ethers.formatEther(balance)}</p>}
      <p>
        <input
          type="button"
          value={`Bridge to ${targetChainId === 2 ? "Ethereum" : "Polygon"}`}
          onClick={submit}
          disabled={
            !isConnected || bridgeAmount <= 0 || balance < 0 || ethers.parseEther(bridgeAmount.toString()) > balance
          }
        />
      </p>
      <p>{message}</p>
    </>
  );
}

export default App;

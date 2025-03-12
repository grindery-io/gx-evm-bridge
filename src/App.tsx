import './App.css';
import {
  createAppKit,
  useAppKitAccount,
  useAppKitProvider,
} from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { mainnet, polygon } from '@reown/appkit/networks';
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
  const { walletProvider } = useAppKitProvider('eip155');
  const gx = useMemo(() => walletProvider ? gxContract.connect(new BrowserProvider(walletProvider as any)) as ethers.Contract : null, [walletProvider]);
  const [balance, setBalance] = useState(-1n);
  useEffect(() => {
    setBalance(-1n);
    if (!gx || !address) {
      return;
    }
    gx.balanceOf(address).then((b) => setBalance(b));
  }, [gx, address]);
  function submit() {
    setMessage('Processing...');
    (async () => {
      if (!isConnected || !address) throw Error('User disconnected');

      const ethersProvider = new BrowserProvider(walletProvider as any);
      const signer = await ethersProvider.getSigner();
      setMessage('Please approve signature request');
      let signature = await signer.signMessage(
        ethers.getBytes(
          ethers.toUtf8Bytes(
            `${delegateAddress}${Math.floor(Date.now() / 1000 / 3600)}`
          )
        )
      );
      const isEip1271 = ethers.dataLength(signature) !== 65 || ((await signer.provider.getCode(address)) || "0x") !== "0x";
      if (isEip1271) {
        const coder = ethers.AbiCoder.defaultAbiCoder()
        signature = ethers.concat([
          coder.encode(["uint256", "uint256"], [address, 65n]),
          "0x00",
          ethers.dataSlice(coder.encode(["bytes"], [signature]), 32),
        ]);
      }
      setMessage('Processing...');
      await safeApi(ethersProvider._network.chainId.toString(), 'delegates', {
        method: "post",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          safe: safeAddress,
          delegator: address,
          delegate: delegateAddress,
          label: 'Grindery Staff',
          signature,
        }),
      });
    })().then(
      () => setMessage('Success!'),
      (e) => {
        console.error(e);
        setMessage('Error: ' + e.toString());
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
      {balance >= 0 && <p>GX balance: ${ethers.formatEther(balance)}</p>}
      <p>
        <input
          type="button"
          value="Submit"
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

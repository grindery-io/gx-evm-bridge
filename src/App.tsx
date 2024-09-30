import './App.css';
import {
  createAppKit,
  useAppKitAccount,
  useAppKitProvider,
} from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { mainnet, polygon } from '@reown/appkit/networks';
import { useState } from 'react';
import { BrowserProvider, ethers } from 'ethers';

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

async function safeApi(
  chainId: string,
  path: string,
  options: Partial<RequestInit & { query: { [key: string]: string } }> = {}
) {
  const url = new URL(
    `https://safe-client.safe.global/v2/chains/${chainId}/${path}`
  );
  const resp = await fetch(url.toString(), options);
  const body = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new Error(
      `Error when calling safe API (${path}): ${resp.status} - ${JSON.stringify(
        body
      )}`
    );
  }
  return body;
}

function App() {
  const [message, setMessage] = useState('');
  const [safeAddress, setSafeAddress] = useState('');
  const [delegateAddress, setDelegateAddress] = useState('');
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('eip155');
  function submit() {
    setMessage('Processing...');
    (async () => {
      if (!isConnected || !address) throw Error('User disconnected');

      const ethersProvider = new BrowserProvider(walletProvider as any);
      const signer = await ethersProvider.getSigner();
      const msg = {
        "types": {
          "Delegate": [
            { "name": "delegateAddress", "type": "address" },
            { "name": "totp", "type": "uint256" },
          ],
        },
        "primaryType": "Delegate",
        "domain": {
          "name": "Safe Transaction Service",
          "version": "1.0",
          "chainId": ethersProvider._network.chainId,
        },
        "message": {
          "delegateAddress": delegateAddress,
          "totp": Math.floor(Date.now() / 1000 / 3600),
        },
      };
      setMessage('Please approve signature request');
      const isContract = ((await signer.provider.getCode(address)) || "0x") !== "0x";
      let signature: string;
      if (isContract) {
        const hash = ethers.TypedDataEncoder.hash(msg.domain, msg.types, msg.message);
        const contract = new ethers.Contract(safeAddress, ["function approveHash(bytes32 hashToApprove)"], signer);
        await contract.approveHash(hash).then(x => x.wait());
        signature = ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "uint256"], [address, 0n]) + "01";
      } else {
        signature = await signer.signTypedData(msg.domain, msg.types, msg.message);
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
      <p>SAFE address</p>
      <input
        type="text"
        value={safeAddress}
        onChange={(e) => setSafeAddress(e.currentTarget.value)}
      />
      <p>Delegate address</p>
      <input
        type="text"
        value={delegateAddress}
        onChange={(e) => setDelegateAddress(e.currentTarget.value)}
      />
      <p>
        <input
          type="button"
          value="Submit"
          onClick={submit}
          disabled={
            !isConnected ||
            !ethers.isAddress(safeAddress) ||
            !ethers.isAddress(delegateAddress)
          }
        />
      </p>
      <p>{message}</p>
    </>
  );
}

export default App;

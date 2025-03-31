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
import { Address } from '@ton/core';

// 1. Get projectId
const projectId = '3412d7ac48bc6355f82302fb11dd3679';

// 2. Set the networks
const networks = [polygon, mainnet];

// 3. Create a metadata object - optional
const metadata = {
  name: 'GX EVM Bridge',
  description: 'GX EVM Bridge',
  url: 'https://gx-evm-bridge.grindery.com/', // origin must match your domain & subdomain
  icons: [],
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
const bridgeContract = new ethers.Contract('0x9932EDE7E99b738fc577d9B8Cce3CD52E0A838Fb', ['function bridgeToTon(uint256 amount, int32 tonWorkchainId, bytes32 tonAccountId)'])

function App() {
  const [message, setMessage] = useState('');
  const [bridgeAmount, setBridgeAmount] = useState(0);
  const { address, isConnected } = useAppKitAccount();
  const network = useAppKitNetwork();
  const { walletProvider } = useAppKitProvider('eip155');
  const gx = useMemo(() => walletProvider ? gxContract.connect(new BrowserProvider(walletProvider as any)) as ethers.Contract : null, [walletProvider]);
  const [balance, setBalance] = useState(-1n);
  const [targetChainId, setTargetChainId] = useState(2);
  const [tonAddress, setTonAddress] = useState("");
  const parsedTonAddress = useMemo(() => {
    try {
      return Address.parse(tonAddress.trim());
    } catch (e) {
      return null;
    }
  }, [tonAddress]);
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
  function submitBridgeToTon() {
    if (!parsedTonAddress) {
      return;
    }
    setMessage('Processing...');
    (async () => {
      if (!isConnected || !address || !gx) throw Error('User disconnected');
      const signer = await new BrowserProvider(walletProvider as any).getSigner();
      const gxWithSigner = gx.attach("0xC3493D5787d4fF987d56855C64aAd60F382B5959").connect(signer) as ethers.Contract;
      const bridgeWithSigner = bridgeContract.connect(signer) as ethers.Contract;
      setMessage('Processing...');
      const amountWei = ethers.parseEther(bridgeAmount.toString())
      const allowance = await gxWithSigner.allowance(address, bridgeWithSigner.getAddress());
      if (allowance < amountWei) {
        setMessage('Processing (approval tx)...');
        await gxWithSigner.approve(bridgeWithSigner.getAddress(), amountWei).then(x => x.wait());
      }
      setMessage('Processing (bridge tx)...');
      await bridgeWithSigner.bridgeToTon(amountWei, BigInt(parsedTonAddress.workChain), ethers.hexlify(parsedTonAddress.hash));
      setMessage('Transaction submitted, you should receive fund in a few minutes')
    })().catch(
      (e) => {
        console.error(e);
        setMessage(e.toString());
      }
    );
  }
  return (
    <main>
      <div className='container'>
        <p>
          <w3m-button />
          <w3m-network-button />
        </p>
        <p>{message}</p>
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
        {network.chainId === 137 && <div>
          <p>Bridge amount</p>
          <input
            type="text"
            value={bridgeAmount.toString()}
            inputMode='numeric'
            onChange={(e) => setBridgeAmount(parseInt(e.currentTarget.value, 10) || bridgeAmount)}
          />
          {balance >= 0 && <p>GX balance: {ethers.formatEther(balance)}</p>}
          <p>TON address</p>
          <input
            type="text"
            value={tonAddress}
            inputMode='numeric'
            onChange={(e) => setTonAddress(e.currentTarget.value)}
          />
          <p>
            <input
              type="button"
              value={`Bridge to TON`}
              onClick={submitBridgeToTon}
              disabled={
                !parsedTonAddress || !isConnected || bridgeAmount <= 0 || balance < 0 // || ethers.parseEther(bridgeAmount.toString()) > balance
              }
            />
          </p>
        </div>}
      </div>
    </main>
  );
}

export default App;

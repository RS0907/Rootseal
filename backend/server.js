import express from "express";
import { MerkleTree } from "merkletreejs";
import { keccak256, ethers } from "ethers";
import cors from "cors";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

let certificateHashes = []; // temporary in-memory storage

// --- Hardhat Blockchain Config ---
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const provider = new ethers.JsonRpcProvider(RPC_URL);

// 🔑 Load deployer wallet
let wallet;
if (process.env.PRIVATE_KEY) {
  wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`🔐 Using wallet from PRIVATE_KEY: ${wallet.address}`);
} else {
  const accounts = await provider.listAccounts();
  if (accounts.length === 0) {
    console.error("❌ No accounts found on Hardhat node!");
    process.exit(1);
  }
  wallet = await provider.getSigner(accounts[0].address);
  console.log(`🧑‍💻 Using local Hardhat account: ${accounts[0].address}`);
}

// 🔧 Load contract ABI + address
const contractPath = "../artifacts/contracts/rootseal.sol/RootSeal.json";
if (!fs.existsSync(contractPath)) {
  console.error(`❌ Contract ABI not found at ${contractPath}`);
  process.exit(1);
}

const contractJson = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const abi = contractJson.abi;

const contractAddress = process.env.CONTRACT_ADDRESS;
if (!contractAddress) {
  console.error("❌ CONTRACT_ADDRESS missing in .env (deployed RootSeal address)");
  process.exit(1);
}

const rootSeal = new ethers.Contract(contractAddress, abi, wallet);

console.log("🔗 Connected to RootSeal contract:", contractAddress);

// --- ROUTES ---

// ✅ Health check
app.get("/", (req, res) => {
  res.send("✅ Merkle Root Generator API is running...");
});

// ✅ Add certificate hash
app.post("/api/addCertificateHash", async (req, res) => {
  try {
    const { certificateHash } = req.body;

    if (!certificateHash) {
      return res.status(400).json({ message: "Missing certificate hash" });
    }

    certificateHashes.push(certificateHash);
    console.log(`📜 Added certificate hash (${certificateHashes.length}/8):`, certificateHash);

    // ✅ When 8 certificates are reached → create Merkle root
    if (certificateHashes.length === 8) {
      console.log("🌳 Building Merkle tree...");
      const tree = new MerkleTree(certificateHashes, keccak256, { sortPairs: true });
      const root = tree.getHexRoot();
      const proofs = certificateHashes.map((leaf) => tree.getHexProof(leaf));

      console.log("🪶 Merkle Root:", root);

      try {
        const tx = await rootSeal.setMerkleRoot(root, "Batch of 8 certificate hashes");
        console.log("⛓️  Transaction sent:", tx.hash);
        await tx.wait();
        console.log("✅ Root successfully stored on blockchain");

        // Reset for next batch
        certificateHashes = [];

        return res.json({ root, proofs, txHash: tx.hash });
      } catch (err) {
        console.error("❌ Blockchain error:", err);
        return res.status(500).json({ message: "Failed to store root", error: err.message });
      }
    }

    return res.json({
      message: "Certificate hash added successfully",
      currentCount: certificateHashes.length,
    });
  } catch (err) {
    console.error("❌ Server error:", err);
    res.status(500).json({ message: "Internal server error", error: err.message });
  }
});

// --- Start server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`🔗 Connected to Hardhat RPC: ${RPC_URL}`);
});

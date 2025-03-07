import { Metaplex, keypairIdentity, toMetaplexFile } from "@metaplex-foundation/js";
import { Connection, clusterApiUrl, Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import EventEmitter from "eventemitter3";


dotenv.config();

// Load wallet from /wallet.json
const walletPath = "official.json"; // Adjust path if needed
const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
const wallet = Keypair.fromSecretKey(new Uint8Array(secretKey));

// Solana RPC Connection
const connection = new Connection(clusterApiUrl("mainnet-beta"));

// Initialize Metaplex with built-in Arweave (Bundlr) storage
const metaplex = Metaplex.make(connection).use(keypairIdentity(wallet));

// Existing Collection Mint Address
const collectionMint = new PublicKey("CAJtHLcFyf97Jfw1UUr1zwKCAR2vLYRfTW3zmrDhM7VA"); // Replace this

// Function to Load Metadata JSON
function loadMetadata(jsonPath: string) {
    return JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
}

// Upload Image to Arweave
async function uploadImage(imagePath: string) {
    const imageBuffer = fs.readFileSync(imagePath);
    const fileName = path.basename(imagePath); // Extract filename from path
    const metaplexFile = toMetaplexFile(imageBuffer, fileName); // Convert to MetaplexFile

    const imageUri = await metaplex.storage().upload(metaplexFile);
    console.log(`✅ Image Uploaded to Arweave: ${imageUri}`);
    return imageUri;
}

// Upload JSON Metadata to Arweave
async function uploadMetadata(metadata: any, metadataPath: string) {
    const jsonFileName = path.basename(metadataPath);
    const jsonBuffer = Buffer.from(JSON.stringify(metadata));
    const metaplexFile = toMetaplexFile(jsonBuffer, jsonFileName);

    const metadataUri = await metaplex.storage().upload(metaplexFile);
    console.log(`✅ Metadata Uploaded to Arweave: ${metadataUri}`);
    return metadataUri;
}

// Mint NFT and Attach to Collection
async function mintNftToCollection(imagePath: string, metadataPath: string) {
    try {
        console.log("🚀 Loading metadata...");
        let metadata = loadMetadata(metadataPath);
        
        console.log("🚀 Uploading NFT assets to Arweave...");

        // Upload image
        const imageUrl = await uploadImage(imagePath);

        // Update metadata image field
        metadata.image = imageUrl;
        metadata.properties.files[0].uri = imageUrl; // Update properties field

        // Upload updated metadata JSON
        const metadataUri = await uploadMetadata(metadata, metadataPath);

        console.log("🛠️ Minting NFT...");

        // Mint the NFT dynamically using metadata
        const { nft } = await metaplex.nfts().create({
            uri: metadataUri,
            name: metadata.name, // Get name dynamically from JSON
            symbol: metadata.symbol || "NFT", // Use symbol from JSON or default
            sellerFeeBasisPoints: metadata.seller_fee_basis_points || 0, // Match collection config
            collection: collectionMint, // Attach to collection
            isCollection: false,
        });

        console.log(`✅ NFT Minted: ${nft.address.toString()}`);

        // Verify Collection Association
        await metaplex.nfts().verifyCollection({
            mintAddress: nft.address,
            collectionMintAddress: collectionMint,
        });

        console.log(`✅ NFT Added to Collection!`);
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

// Run the function with your file paths
mintNftToCollection("./asset/5.jpg", "./asset/5.json");

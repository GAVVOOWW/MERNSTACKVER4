import { pipeline } from '@xenova/transformers';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Make sure the paths to your models and DB config are correct
import Item from '../models/item.model.js';
import Category from '../models/category.model.js';
import FurnitureType from '../models/furnitureType.model.js';
import { connectDB } from '../config/db.js';

dotenv.config({ path: './.env' });

/**
 * THIS IS THE NEW, MORE DETAILED FUNCTION.
 * It converts numerical and boolean fields into descriptive text.
 */
const generateSearchableText = (item) => {
    let textBlock = `Name: ${item.name}. Type: ${item.furnituretype?.name || ''}. Categories: ${item.category.map(cat => cat.name).join(', ')}. Description: ${item.description}.`;

    const features = [];
    
    // --- NEW LOGIC: Convert Price to descriptive words ---
    if (item.price < 7500) {
        features.push("budget-friendly", "affordable");
    } else if (item.price >= 7500 && item.price < 30000) {
        features.push("mid-range price", "standard price");
    } else {
        features.push("premium", "high-end", "luxury");
    }

    // --- NEW LOGIC: Convert Dimensions to descriptive words ---
    const largestDimension = Math.max(item.length, item.width, item.height);
    if (largestDimension < 60) {
        features.push("compact", "small size", "good for small spaces");
    } else if (largestDimension >= 60 && largestDimension < 150) {
        features.push("standard size", "medium size");
    } else {
        features.push("large", "oversized", "statement piece");
    }

    // --- NEW LOGIC: Add keywords for boolean flags and sales ---
    if (item.is_bestseller) features.push("bestseller", "best-selling");
    if (item.is_customizable) features.push("customizable", "can be customized");
    if (item.isPackage) features.push("package deal", "set of items", "bundle");
    if (item.stock === 0) features.push("currently out of stock");
    if (item.sales > 200) features.push("popular choice", "customer favorite");
    
    // --- NEW LOGIC: Add available materials as keywords ---
    const materialNames = (item.customization_options?.materials || []).map(mat => mat.name);
    if (materialNames.length > 0) {
        features.push(...materialNames); // Add materials like "Narra", "Acacia"
    }

    if(features.length > 0) {
        textBlock += ` Key Features and Properties: ${features.join(', ')}.`;
    }

    return textBlock.replace(/\s+/g, ' ').trim();
};

const generateEmbeddings = async () => {
    console.log("Connecting to the database...");
    await connectDB();
    console.log("Database connected.");

    console.log("Loading the SMALL model (Xenova/bge-small-en-v1.5)...");
    const extractor = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5');
    console.log("Model loaded successfully.");

    console.log("Fetching all items from the database...");
    const items = await Item.find({})
        .populate('category', 'name')
        .populate('furnituretype', 'name');
    
    console.log(`Found ${items.length} items to process. Forcing re-generation with detailed text...`);

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        const textToEmbed = generateSearchableText(item);
        console.log(`(${i + 1}/${items.length}) Generating new embedding for '${item.name}'...`);
        // Uncomment the line below if you want to see the new detailed text for each item
        // console.log(`   -> Text: "${textToEmbed}"`);

        const output = await extractor(textToEmbed, {
            pooling: 'mean',
            normalize: true,
        });
        
        const embedding = Array.from(output.data);
        await Item.findByIdAndUpdate(item._id, { $set: { embedding: embedding } });
    }

    console.log("✅ Detailed embedding re-generation complete for all items!");
    await mongoose.disconnect();
    process.exit(0);
};

generateEmbeddings().catch(err => {
    console.error("❌ A critical error occurred:", err);
    process.exit(1);
});
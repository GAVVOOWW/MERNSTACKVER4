import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Make sure the paths to your models and DB config are correct
import Item from '../models/item.model.js';
import Category from '../models/category.model.js';
import FurnitureType from '../models/furnitureType.model.js';
import { connectDB } from '../config/db.js';

dotenv.config({ path: './.env' });

// Helper to get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const seedDatabase = async () => {
    try {
        console.log("Connecting to the database...");
        await connectDB();
        console.log("Database connected.");

        console.log("Clearing existing data...");
        await Item.deleteMany({});
        await Category.deleteMany({});
        await FurnitureType.deleteMany({});
        console.log("Existing data cleared.");

        console.log("Reading items.json...");
        const itemsPath = path.join(__dirname, '..', 'config', 'items.json');
        const itemsData = JSON.parse(await fs.readFile(itemsPath, 'utf-8'));
        console.log(`Found ${itemsData.length} items in the JSON file.`);

        const categories = new Map();
        const furnitureTypes = new Map();

        // First pass: create all categories and furniture types
        for (const itemData of itemsData) {
            // Handle Categories
            for (const categoryName of itemData.category) {
                if (!categories.has(categoryName)) {
                    const newCategory = new Category({ name: categoryName });
                    await newCategory.save();
                    categories.set(categoryName, newCategory._id);
                    console.log(`Created category: ${categoryName}`);
                }
            }

            // Handle Furniture Type
            const ftName = itemData.furnituretype;
            if (ftName && !furnitureTypes.has(ftName)) {
                const newFt = new FurnitureType({ name: ftName });
                await newFt.save();
                furnitureTypes.set(ftName, newFt._id);
                console.log(`Created furniture type: ${ftName}`);
            }
        }

        console.log("\nStarting to import items...");
        // Second pass: create items with references
        for (const itemData of itemsData) {
            const categoryIds = itemData.category.map(name => categories.get(name));
            const furnitureTypeId = furnitureTypes.get(itemData.furnituretype);

            const newItem = new Item({
                ...itemData,
                category: categoryIds,
                furnituretype: furnitureTypeId,
            });

            await newItem.save();
            console.log(` -> Imported item: ${itemData.name}`);
        }

        console.log("\nDatabase has been successfully seeded!");

    } catch (error) {
        console.error("Error seeding the database:", error);
    } finally {
        console.log("Disconnecting from database...");
        await mongoose.disconnect();
        console.log("Database disconnected.");
        process.exit();
    }
};

seedDatabase(); 
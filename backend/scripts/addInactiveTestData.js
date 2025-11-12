import mongoose from "mongoose";
import dotenv from "dotenv";
import Category from "../models/category.model.js";
import FurnitureType from "../models/furnitureType.model.js";

dotenv.config({ path: '../.env' });

const addInactiveTestData = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        // Add inactive categories
        const inactiveCategories = [
            { name: "Discontinued Items", status: 0 },
            { name: "Seasonal", status: 0 },
            { name: "Clearance", status: 0 }
        ];

        for (const cat of inactiveCategories) {
            const exists = await Category.findOne({ name: cat.name });
            if (!exists) {
                await Category.create(cat);
                console.log(`Created inactive category: ${cat.name}`);
            } else {
                // Update existing to be inactive
                await Category.findOneAndUpdate({ name: cat.name }, { status: 0 });
                console.log(`Updated category to inactive: ${cat.name}`);
            }
        }

        // Add inactive furniture types
        const inactiveFurnitureTypes = [
            { name: "Old Style Desks", status: 0 },
            { name: "Discontinued Chairs", status: 0 },
            { name: "Legacy Tables", status: 0 }
        ];

        for (const ft of inactiveFurnitureTypes) {
            const exists = await FurnitureType.findOne({ name: ft.name });
            if (!exists) {
                await FurnitureType.create(ft);
                console.log(`Created inactive furniture type: ${ft.name}`);
            } else {
                // Update existing to be inactive
                await FurnitureType.findOneAndUpdate({ name: ft.name }, { status: 0 });
                console.log(`Updated furniture type to inactive: ${ft.name}`);
            }
        }

        console.log("\n=== Test Data Summary ===");
        const activeCategories = await Category.find({ status: 1 }).count();
        const inactiveCategoriesCount = await Category.find({ status: 0 }).count();
        const activeFurnitureTypes = await FurnitureType.find({ status: 1 }).count();
        const inactiveFurnitureTypesCount = await FurnitureType.find({ status: 0 }).count();

        console.log(`Categories - Active: ${activeCategories}, Inactive: ${inactiveCategoriesCount}`);
        console.log(`Furniture Types - Active: ${activeFurnitureTypes}, Inactive: ${inactiveFurnitureTypesCount}`);

        console.log("\nTest data added successfully!");
        process.exit(0);
    } catch (error) {
        console.error("Error adding test data:", error);
        process.exit(1);
    }
};

addInactiveTestData(); 
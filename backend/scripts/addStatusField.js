import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import Item from "../models/item.model.js";
import User from "../models/user.model.js";
import Category from "../models/category.model.js";
import FurnitureType from "../models/furnitureType.model.js";

dotenv.config();

(async () => {
    try {
        await connectDB();

        const collections = [
            { name: "Items", model: Item },
            { name: "Users", model: User },
            { name: "Categories", model: Category },
            { name: "FurnitureTypes", model: FurnitureType },
        ];

        for (const { name, model } of collections) {
            console.log(`\n🔄  [Migration] Processing ${name}...`);
            const res = await model.updateMany(
                { status: { $exists: false } },
                { $set: { status: 1 } },
            );
            console.log(`✅  ${name}: matched ${res.matchedCount || res.n} – modified ${res.modifiedCount || res.nModified}`);
        }

        console.log("\n🎉  Migration completed – all documents now have a status field.");
        process.exit(0);
    } catch (err) {
        console.error("❌  Migration failed:", err);
        process.exit(1);
    }
})(); 
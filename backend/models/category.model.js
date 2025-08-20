import mongoose from "mongoose";

const CategorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    // 1 = active, 0 = inactive (soft-delete)
    status: { type: Number, default: 1, enum: [0, 1] },
}, { timestamps: true });

const Category = mongoose.model("Category", CategorySchema);

export default Category; 
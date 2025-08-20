import mongoose from "mongoose";

const FurnitureTypeSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    status: { type: Number, default: 1, enum: [0, 1] },
}, { timestamps: true });

const FurnitureType = mongoose.model("FurnitureType", FurnitureTypeSchema);

export default FurnitureType; 
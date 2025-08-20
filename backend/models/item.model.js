import mongoose from "mongoose";

const MaterialOptionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true }, // e.g., "Acacia", "Narra"
  plank_2x12x10_cost: { type: Number, required: true }, // Cost for a 2"x12"x10ft plank
  plank_3x3x10_cost: { type: Number, required: true },  // Cost for a 3"x3"x10ft plank
}, { _id: false });

const ReviewSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  star: { type: Number, required: true, min: 1, max: 5 },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const ItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  cost: { type: Number, required: true },
  price: { type: Number, required: true },
  imageUrl: {
    type: [String],
    required: true
  },
  category: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  stock: { type: Number, default: 0 },
  furnituretype: { type: mongoose.Schema.Types.ObjectId, ref: 'FurnitureType', required: true },
  status: { type: Number, default: 1, enum: [0, 1] },
  is_bestseller: { type: Boolean, default: false },
  is_customizable: { type: Boolean, default: false },
  is_customizable_price: { type: Number, default: 0 },
  length: { type: Number, required: true },
  height: { type: Number, required: true },
  width: { type: Number, required: true },
  sales: { type: Number, default: 0 },
  isPackage: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  customization_options: {
    labor_cost_per_day: { type: Number, default: 350 }, // Default labor cost per day (PHP)
    estimated_days: { type: Number, default: 7 }, // Default estimated days to complete the item
    materials: { type: [MaterialOptionSchema], default: [] }, // Array of available materials
    profit_margin: { type: Number, default: 0.50 }, // 50% profit margin
    overhead_cost: { type: Number, default: 500 } // Fixed overhead cost (PHP)
  },
  reviews: { type: [ReviewSchema], default: [] }, // Array of reviews for this item
  embedding: {
    type: [Number], // An array of numbers
    index: true    // Good practice, though the Atlas index is what we'll primaril_use
  }
}, { timestamps: true });

const Item = mongoose.model("Item", ItemSchema);

export default Item;
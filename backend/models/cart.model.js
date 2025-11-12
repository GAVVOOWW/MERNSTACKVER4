import mongoose from "mongoose"

const CartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [
    {
      item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
      quantity: {
        type: Number,
        required: true,
        default: 1
      },
      customH: { type: Number },
      customW: { type: Number },
      customL: { type: Number },
      legsFrameMaterial: { type: String },
      tabletopMaterial: { type: String },
      customPrice: { type: Number },
      customizations: { type: mongoose.Schema.Types.Mixed },
    }
  ],
  createdAt: { type: Date, default: Date.now }


});

const Cart = mongoose.model("Cart", CartSchema);

export default Cart;

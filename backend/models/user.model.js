// user.model.js

import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  // --- MODIFIED ADDRESS FIELD ---
  address: {
    fullName: { type: String, default: '' },
    addressLine1: { type: String, default: '' },
    addressLine2: { type: String, default: '' },
    provinceCode: { type: String, default: '' },
    provinceName: { type: String, default: '' },
    cityCode: { type: String, default: '' },
    cityName: { type: String, default: '' },
    brgyCode: { type: String, default: '' },
    brgyName: { type: String, default: '' },
    postalCode: { type: String, default: '' }
  },

  phone: { type: String, required: true },
  // 1 = active, 0 = inactive
  status: { type: Number, default: 1, enum: [0, 1] },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  cart: { type: mongoose.Schema.Types.ObjectId, ref: 'Cart' }
});

const User = mongoose.model("User", UserSchema);

export default User;
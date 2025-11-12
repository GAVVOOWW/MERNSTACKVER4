import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [
        {
            item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
            quantity: { type: Number, required: true },
            price: { type: Number, required: true },
            // Storing custom details directly in the order item
            customH: { type: Number, default: null },
            customW: { type: Number, default: null },
            customL: { type: Number, default: null },
            legsFrameMaterial: { type: String, default: null },
            tabletopMaterial: { type: String, default: null }
        }
    ],
    amount: { type: Number, required: true }, // This will now be the TOTAL amount of the order
    totalWithShipping: { type: Number, default: 0 }, // Total amount including shipping fee
    
    // --- NEW: Down Payment and Balance Fields ---
    downPayment: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },

    // --- NEW: Payment Status Field ---
    paymentStatus: {
        type: String,
        enum: ['Downpayment Received', 'Pending Full Payment', 'Fully Paid',`Refund Requested`, 'Refunded'],
        default: 'Pending'
    },
    
    // --- UPDATED: New Order Status Enum ---
    status: {
        type: String,
        enum: [
            'Pending',              // Default state before any payment
            'On Process',           // For delivery after payment
            'Ready for Pickup',     // For pickup after payment
            'Delivered',            // For delivery after proof
            'Picked Up',            // For pickup after proof
            'Cancelled',
            'Requesting for Refund',
            'Refunded'
        ],
        default: 'Pending'
    },

    deliveryOption: { type: String, required: true, enum: ['shipping', 'pickup'] },
    shippingFee: { type: Number, default: 0 },
    deliveryDate: { type: Date },
    deliveryProof: { type: String }, // URL for the delivery proof image

    // Shipping address details
    address: { type: String },
    phone: { type: String },
    shippingAddress: {
        fullName: String,
        addressLine1: String,
        city: String,
        state: String,
        postalCode: String,
        phone: String,
    },

    transactionId: { type: String },
    transactionHash: { type: String }, // For duplicate checking
    // --- NEW: Admin remarks for cancellation/refund ---
    remarks: { type: String, default: '' },
}, { timestamps: true });

const Order = mongoose.model('Order', OrderSchema);
export default Order;
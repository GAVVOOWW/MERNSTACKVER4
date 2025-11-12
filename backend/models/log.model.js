import mongoose from 'mongoose';

const logSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now,
        required: true,
        index: true
    },
    action: {
        type: String,
        required: true,
        enum: [
            // Order actions
            'order_created',
            'order_updated',
            'order_status_changed',
            'order_delivered',
            'order_cancelled',
            'order_refunded',
            'review_added',

            // Payment actions
            'payment_received',
            'payment_failed',
            'downpayment_received',
            'refund_processed',

            // Item actions
            'item_created',
            'item_updated',
            'item_deleted',
            'item_activated',
            'stock_updated',

            // User actions
            'user_created',
            'user_updated',
            'user_deleted',
            'user_activated',
            'user_role_changed',
            'user_login',
            'user_logout',

            // Category/Type actions
            'category_created',
            'category_updated',
            'category_deleted',
            'category_activated',
            'furnituretype_created',
            'furnituretype_updated',
            'furnituretype_deleted',
            'furnituretype_activated',

            // Admin actions
            'admin_bulk_operation',
            'admin_export_data',
            'delivery_proof_uploaded'
        ],
        index: true
    },
    entityType: {
        type: String,
        required: true,
        enum: ['order', 'item', 'user', 'category', 'furnituretype', 'payment', 'system'],
        index: true
    },
    entityId: {
        type: String,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    userName: {
        type: String,
        required: true
    },
    userRole: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    }
}, {
    timestamps: true
});

// Indexes for efficient querying
logSchema.index({ timestamp: -1 });
logSchema.index({ action: 1, timestamp: -1 });
logSchema.index({ entityType: 1, entityId: 1 });
logSchema.index({ userId: 1, timestamp: -1 });

// Virtual for formatted timestamp
logSchema.virtual('formattedTime').get(function () {
    return this.timestamp.toLocaleString();
});

// Method to get action description
logSchema.methods.getActionDescription = function () {
    const descriptions = {
        'order_created': `created order`,
        'order_updated': `updated order`,
        'order_status_changed': `changed order status`,
        'order_delivered': `marked order as delivered`,
        'order_cancelled': `cancelled order`,
        'order_refunded': `refunded order`,
        'payment_received': `received payment`,
        'payment_failed': `payment failed`,
        'downpayment_received': `received down payment`,
        'refund_processed': `processed refund`,
        'item_created': `created new item`,
        'item_updated': `updated item`,
        'item_deleted': `deleted item`,
        'item_activated': `activated item`,
        'stock_updated': `updated stock`,
        'user_created': `created user account`,
        'user_updated': `updated user`,
        'user_deleted': `deleted user`,
        'user_activated': `activated user`,
        'user_role_changed': `changed user role`,
        'user_login': `logged in`,
        'user_logout': `logged out`,
        'category_created': `created category`,
        'category_updated': `updated category`,
        'category_deleted': `deleted category`,
        'category_activated': `activated category`,
        'furnituretype_created': `created furniture type`,
        'furnituretype_updated': `updated furniture type`,
        'furnituretype_deleted': `deleted furniture type`,
        'furnituretype_activated': `activated furniture type`,
        'admin_bulk_operation': `performed bulk operation`,
        'admin_export_data': `exported data`,
        'delivery_proof_uploaded': `uploaded delivery proof`    };

    return descriptions[this.action] || this.action;
};

const Log = mongoose.model('Log', logSchema);

export default Log;

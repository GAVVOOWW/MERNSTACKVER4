import Log from '../models/log.model.js';

class LoggerService {
    /**
     * Create a log entry
     * @param {Object} params - Log parameters
     * @param {string} params.action - The action performed
     * @param {string} params.entityType - Type of entity affected
     * @param {string} params.entityId - ID of the entity affected
     * @param {Object} params.user - User object (must have _id and name)
     * @param {Object} params.details - Additional details
     * @param {Object} params.req - Express request object (optional)
     */
    static async createLog({ action, entityType, entityId, user, details = {}, req = null }) {
        try {
            const logData = {
                action,
                entityType,
                entityId: entityId?.toString(),
                userId: user?._id,
                userName: user?.name || 'System',
                userRole: user?.role || 'user',
                details
            };

            // Add IP and user agent if request object is provided
            if (req) {
                logData.ipAddress = req.ip || req.connection?.remoteAddress;
                logData.userAgent = req.get('user-agent');
            }

            const log = new Log(logData);
            await log.save();

            console.log(`[LOG] ${user?.name || 'System'} ${log.getActionDescription()} ${entityType} ${entityId || ''}`);

            return log;
        } catch (error) {
            console.error('Error creating log:', error);
            // Don't throw error to prevent disrupting main operations
        }
    }

    /**
     * Log order-related actions
     */
    static async logOrder(action, order, user, details = {}, req = null) {
        return this.createLog({
            action,
            entityType: 'order',
            entityId: order._id,
            user,
            details: {
                orderAmount: order.amount,
                orderStatus: order.status,
                ...details
            },
            req
        });
    }

    /**
     * Log payment-related actions
     */
    static async logPayment(action, order, user, details = {}, req = null) {
        return this.createLog({
            action,
            entityType: 'payment',
            entityId: order._id,
            user,
            details: {
                amount: details.amount || order.amount,
                paymentMethod: details.paymentMethod,
                paymentStatus: details.paymentStatus,
                ...details
            },
            req
        });
    }

    /**
     * Log item-related actions
     */
    static async logItem(action, item, user, details = {}, req = null) {
        return this.createLog({
            action,
            entityType: 'item',
            entityId: item._id,
            user,
            details: {
                itemName: item.name,
                itemPrice: item.price,
                ...details
            },
            req
        });
    }

    /**
     * Log user-related actions
     */
    static async logUser(action, targetUser, performingUser, details = {}, req = null) {
        return this.createLog({
            action,
            entityType: 'user',
            entityId: targetUser._id,
            user: performingUser,
            details: {
                targetUserName: targetUser.name,
                targetUserEmail: targetUser.email,
                ...details
            },
            req
        });
    }

    /**
     * Log category-related actions
     */
    static async logCategory(action, category, user, details = {}, req = null) {
        return this.createLog({
            action,
            entityType: 'category',
            entityId: category._id,
            user,
            details: {
                categoryName: category.name,
                ...details
            },
            req
        });
    }

    /**
     * Log furniture type-related actions
     */
    static async logFurnitureType(action, furnitureType, user, details = {}, req = null) {
        return this.createLog({
            action,
            entityType: 'furnituretype',
            entityId: furnitureType._id,
            user,
            details: {
                typeName: furnitureType.name,
                ...details
            },
            req
        });
    }

    /**
     * Get logs with filters
     */
    static async getLogs(filters = {}, options = {}) {
        const {
            startDate,
            endDate,
            action,
            entityType,
            userId,
            limit = 50,
            skip = 0,
            sort = { timestamp: -1 }
        } = { ...filters, ...options };

        const query = {};

        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }

        if (action) query.action = action;
        if (entityType) query.entityType = entityType;
        if (userId) query.userId = userId;

        const logs = await Log.find(query)
            .sort(sort)
            .limit(limit)
            .skip(skip)
            .populate('userId', 'name email role');

        const total = await Log.countDocuments(query);

        return { logs, total };
    }

    /**
     * Get log statistics
     */
    static async getLogStats(timeRange = '24h') {
        const now = new Date();
        let startTime;

        switch (timeRange) {
            case '1h':
                startTime = new Date(now - 60 * 60 * 1000);
                break;
            case '24h':
                startTime = new Date(now - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                startTime = new Date(now - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startTime = new Date(now - 30 * 24 * 60 * 60 * 1000);
                break;
            default:
                startTime = new Date(now - 24 * 60 * 60 * 1000);
        }

        const stats = await Log.aggregate([
            {
                $match: {
                    timestamp: { $gte: startTime }
                }
            },
            {
                $group: {
                    _id: '$action',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        const totalLogs = await Log.countDocuments({
            timestamp: { $gte: startTime }
        });

        return { stats, totalLogs, timeRange };
    }
}

export default LoggerService;
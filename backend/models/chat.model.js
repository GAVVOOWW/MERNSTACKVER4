// File: models/chat.model.js

import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const chatSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    messages: [messageSchema],
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastMessageAt: {
        type: Date,
        default: Date.now
    }
});

const Chat = mongoose.model('Chat', chatSchema);

export default Chat;
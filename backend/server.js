import express from "express";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import cors from "cors";
import jwt from "jsonwebtoken";
import axios from "axios";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { calculateCustomPrice } from "./utils/priceCalculator.js";


// Model Imports
import User from "./models/user.model.js";
import Cart from "./models/cart.model.js";
import Item from "./models/item.model.js";
import Order from "./models/order.model.js";
import Chat from "./models/chat.model.js";
import Category from "./models/category.model.js";
import FurnitureType from "./models/furnitureType.model.js";
import Log from "./models/log.model.js";

// Middleware & Config Imports
import { connectDB } from "./config/db.js";
import { authenticateToken, authorizeRoles } from "./middleware/auth.js";

// Utils Imports
import LoggerService from "./utils/logger.js";

// =================================================================
// INITIALIZATION
// =================================================================
const app = express();
const server = createServer(app);

dotenv.config(`./.env`);
connectDB();

import { pipeline } from "@xenova/transformers";
import {
  parseQueryWithGroq,
  generateComplementaryRecommendations,
} from "./utils/groqParser.js";
import {
  parseQueryWithGemini,
  generateComplementaryRecommendationsWithGemini,
} from "./utils/geminiParser.js";
import {
  parseQueryWithOpenAI,
  generateComplementaryRecommendationsWithOpenAI,
  generateItemExplanations,
} from "./utils/chatgptParser.js";

const frontendURL = process.env.FRONTEND_URL;

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173", // Local dev environment
      "https://wawa-furniture-shop.onrender.com",
      /https:\/\/merntacktechgurus-1\.onrender\.com$/, // Your specific Render frontend URL
      /https:\/\/.*\.onrender\.com$/, // Any other Render frontend subdomains
      process.env.FRONTEND_URL, // Any custom frontend URL from .env
    ].filter(Boolean), // Filters out undefined/null values
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Configure Multer for in-memory file storage with optimized settings
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1, // Only 1 file at a time
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

// Global error handler for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Please upload an image smaller than 10MB.",
      });
    }
    return res.status(400).json({
      success: false,
      message: "File upload error: " + err.message,
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "File upload error",
    });
  }
  next();
};

// Configure Cloudinary using the credentials from .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// =================================================================
// MIDDLEWARE
// =================================================================

const allowedOrigins = [
  `https://merntacktechgurus-1.onrender.com`,
  `https://wawa-furniture-shop.onrender.com`,
  process.env.FRONTEND_URL, // Your live site on Render
  "http://localhost:5173", // Your local development environment
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like Postman or server-to-server requests)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("This origin is not allowed by CORS"));
    }
  },
};

// Use the new options
app.use(cors(corsOptions));

app.use(express.json());
// --- START OF CHAT API ROUTES ---

// Get all chats for the logged-in admin
app.get(
  "/api/chats",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const chats = await Chat.find({})
        .populate("participants", "name email role")
        // THIS IS THE CRITICAL FIX: Deeply populate the sender within the messages array
        .populate({
          path: "messages.sender",
          select: "name role", // Select the fields you need
        })
        .sort({ lastMessageAt: -1 });
      res.json(chats);
    } catch (err) {
      console.error("Error fetching chats for admin:", err.message);
      res.status(500).send("Server Error");
    }
  }
);

// Delete a chat (admin only)
app.delete(
  "/api/chats/:chatId",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { chatId } = req.params;
      
      // Validate chat ID
      if (!chatId) {
        return res.status(400).json({ 
          success: false, 
          message: "Chat ID is required" 
        });
      }

      // Find and delete the chat
      const deletedChat = await Chat.findByIdAndDelete(chatId);
      
      if (!deletedChat) {
        return res.status(404).json({ 
          success: false, 
          message: "Chat not found" 
        });
      }

      console.log(`Chat ${chatId} deleted by admin ${req.user.id}`);

      // Log the chat deletion
      await LoggerService.logOrder(
        "chat_deleted",
        { _id: chatId, participants: deletedChat.participants },
        req.user,
        {
          chatId: chatId,
          participantsCount: deletedChat.participants.length,
          messagesCount: deletedChat.messages.length,
          adminId: req.user.id,
          adminName: req.user.name,
        },
        req
      );

      res.json({ 
        success: true, 
        message: "Chat deleted successfully",
        deletedChatId: chatId
      });

    } catch (err) {
      console.error("Error deleting chat:", err.message);
      res.status(500).json({ 
        success: false, 
        message: "Server error deleting chat",
        error: err.message 
      });
    }
  }
);

// Load the model once when the server starts for efficiency
let extractor;
(async () => {
  try {
    console.log("Loading semantic search model (Xenova/bge-small-en-v1.5)...");
    extractor = await pipeline(
      "feature-extraction",
      "Xenova/bge-small-en-v1.5"
    );
    console.log("Semantic search model loaded successfully.");
  } catch (err) {
    console.error("Failed to load semantic search model:", err);
  }
})();

// Build a descriptive text block for item embeddings (aligned with scripts/generateEmbeddings.js)
const generateSearchableText = (item) => {
  try {
    // Normalize category names whether populated or not
    let categoryNames = '';
    if (Array.isArray(item?.category)) {
      categoryNames = item.category
        .map((cat) => (cat && typeof cat === 'object' ? cat.name : cat))
        .filter(Boolean)
        .join(', ');
    } else if (item?.category) {
      categoryNames = typeof item.category === 'object' ? item.category.name : item.category;
    }

    const typeName = item?.furnituretype && typeof item.furnituretype === 'object'
      ? item.furnituretype.name
      : (item?.furnituretype || '');

    let textBlock = `Name: ${item?.name || ''}. Type: ${typeName || ''}. Categories: ${categoryNames || ''}. Description: ${item?.description || ''}.`;

    const features = [];

    // Price buckets
    const priceNum = Number(item?.price);
    if (!Number.isNaN(priceNum)) {
      if (priceNum < 7500) {
        features.push('budget-friendly', 'affordable');
      } else if (priceNum >= 7500 && priceNum < 30000) {
        features.push('mid-range price', 'standard price');
      } else {
        features.push('premium', 'high-end', 'luxury');
      }
    }

    // Dimension descriptors
    const len = Number(item?.length);
    const wid = Number(item?.width);
    const hei = Number(item?.height);
    if (![len, wid, hei].some(Number.isNaN)) {
      const largest = Math.max(len, wid, hei);
      if (largest < 60) {
        features.push('compact', 'small size', 'good for small spaces');
      } else if (largest >= 60 && largest < 150) {
        features.push('standard size', 'medium size');
      } else {
        features.push('large', 'oversized', 'statement piece');
      }
    }

    // Flags and sales
    if (item?.is_bestseller) features.push('bestseller', 'best-selling');
    if (item?.is_customizable) features.push('customizable', 'can be customized');
    if (item?.isPackage) features.push('package deal', 'set of items', 'bundle');
    if (Number(item?.stock) === 0) features.push('currently out of stock');
    if (Number(item?.sales) > 200) features.push('popular choice', 'customer favorite');

    // Materials
    const mats = item?.customization_options?.materials || [];
    const materialNames = Array.isArray(mats) ? mats.map((m) => m?.name).filter(Boolean) : [];
    if (materialNames.length > 0) features.push(...materialNames);

    if (features.length > 0) {
      textBlock += ` Key Features and Properties: ${features.join(', ')}.`;
    }

    return textBlock.replace(/\s+/g, ' ').trim();
  } catch (e) {
    return String(item?.name || '');
  }
};

// Smart limit function - AI determines optimal number of results
const getSmartLimit = (command) => {
  const { recommendationType, targetRoom, filters } = command;
  
  // AI logic for determining optimal results
  switch (recommendationType) {
    case "pairing":
      // For pairing, show 3-6 items (chairs, lamps, etc.)
      return 6;
    case "completion":
      // For room completion, show more options (8-12 items)
      return 12;
    case "replacement":
      // For replacement, show variety (6-10 items)
      return 8;
    case "upgrade":
      // For upgrades, show premium options (4-8 items)
      return 6;
    default:
      // Default smart limit based on room
      switch (targetRoom) {
        case "bedroom":
          return 8; // Bed, bedside tables, wardrobe, dresser, etc.
        case "living room":
          return 10; // Sofa, coffee table, side tables, TV stand, etc.
        case "dining room":
          return 6; // Table, chairs, buffet, lighting
        case "office":
          return 6; // Desk, chair, storage, lighting
        default:
          return 8; // General default
      }
  }
};

//sematic search endpoint
// The refactored semantic search endpoint

app.post("/api/items/semantic-search", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query)
      return res
        .status(400)
        .json({ success: false, message: "Query is required." });

    const command = await parseQueryWithOpenAI(query);

    console.log("[AI Parsed Command]:", command);

    const { semanticQuery, limit, sortBy, sortOrder, filters } = command;

    if (!extractor) {
      return res
        .status(503)
        .json({
          success: false,
          message:
            "AI search model is still loading. Please try again in a moment.",
        });
    }

    // AI controls the limit - use AI's suggested limit or smart defaults
    const numResults = parseInt(limit, 10) || getSmartLimit(command);

    // Build a $match stage for any non-vector filters we want to apply *after* similarity scoring

    const postMatchStage = {};

    if (filters) {
      if (filters.maxPrice)
        postMatchStage.price = {
          ...postMatchStage.price,
          $lte: filters.maxPrice,
        };

      if (filters.minPrice)
        postMatchStage.price = {
          ...postMatchStage.price,
          $gte: filters.minPrice,
        };

      if (filters.maxLength)
        postMatchStage.length = { $lte: filters.maxLength };

      if (filters.maxWidth) postMatchStage.width = { $lte: filters.maxWidth };

      if (filters.maxHeight)
        postMatchStage.height = { $lte: filters.maxHeight };

      if (filters.is_bestseller !== undefined)
        postMatchStage.is_bestseller = filters.is_bestseller;

      if (filters.is_customizable !== undefined)
        postMatchStage.is_customizable = filters.is_customizable;

      if (filters.isPackage !== undefined)
        postMatchStage.isPackage = filters.isPackage;
    }

    const pipeline = [];

    const queryEmbedding = await extractor(semanticQuery, {
      pooling: "mean",
      normalize: true,
    });

    // $vectorSearch MUST be the first stage in the pipeline

    pipeline.push({
      $vectorSearch: {
        index: "vector_index",

        path: "embedding",

        queryVector: Array.from(queryEmbedding.data),

        numCandidates: 200,

        limit: numResults,
      },
    });

    // Apply attribute-based filters *after* the similarity search

    if (Object.keys(postMatchStage).length > 0) {
      pipeline.push({ $match: postMatchStage });
    }

    if (sortBy && sortOrder) {
      const sortStage = { $sort: { [sortBy]: sortOrder === "asc" ? 1 : -1 } };

      pipeline.push(sortStage);
    }

    pipeline.push({
      $project: {
        _id: 1,
        name: 1,
        description: 1,
        price: 1,
        imageUrl: 1,
        sales: 1,
        reviews: 1,
        category: 1,
        furnituretype: 1,
        rating: 1,
        score: { $meta: "vectorSearchScore" },
      },
    });

    const results = await Item.aggregate(pipeline);

    // Generate AI explanations for each recommended item
    const resultsWithExplanations = await generateItemExplanations(results, query, command);

    res.json({ success: true, ItemData: resultsWithExplanations, parsedCommand: command, semanticQuery });
  } catch (err) {
    console.error("Error in semantic search route:", err);

    res
      .status(500)
      .json({ success: false, message: "Server error during search." });
  }
});

app.post("/api/items/recommend", async (req, res) => {
  console.log(
    "--- GROQ-POWERED COMPLEMENTARY RECOMMENDATION ENGINE STARTED ---"
  );
  try {
    const { selectedIds } = req.body;
    console.log(
      "[GROQ-REC]: Received request for recommendations based on cart items:",
      selectedIds
    );

    if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
      console.log("[GROQ-REC-ERROR]: No item IDs provided.");
      return res
        .status(400)
        .json({
          success: false,
          message: "Item IDs are required to generate recommendations.",
        });
    }

    // 1. Fetch the cart items with full details
    console.log("[GROQ-REC]: Fetching cart items from database...");
    const cartItems = await Item.find({ _id: { $in: selectedIds } })
      .select("name description category furnituretype price")
      .populate("category", "name")
      .populate("furnituretype", "name");

    if (cartItems.length === 0) {
      console.log("[GROQ-REC-ERROR]: No valid items found in cart.");
      return res
        .status(404)
        .json({ success: false, message: "Cart items not found." });
    }

    console.log(`[GROQ-REC]: Found ${cartItems.length} items in cart`);

    // 2. Use Groq to analyze cart and generate complementary product recommendations
    let complementaryAnalysis;
    try {
      complementaryAnalysis = await generateComplementaryRecommendationsWithOpenAI(
        cartItems
      );
      console.log(
        "[GROQ-REC]: Groq analysis completed:",
        complementaryAnalysis
      );
    } catch (groqError) {
      console.error("[GROQ-REC]: Error calling Groq API:", groqError);
      // Fallback analysis if Groq fails
      complementaryAnalysis = {
        complementaryQuery: "furniture accessories storage lighting",
        reasoning: "General furniture accessories and complements",
        detectedRoom: "general",
        completionLevel: "unknown",
        priorityItems: ["lighting", "storage", "accessories"],
        filters: {},
      };
    }

    // 3. Search for complementary items based on Groq's recommendations
    const searchTerms = complementaryAnalysis.complementaryQuery
      ? complementaryAnalysis.complementaryQuery.split(" ")
      : ["furniture", "accessories"];
    const excludeTerms = complementaryAnalysis.filters?.exclude || [];

    // Build search query
    const searchQueries = searchTerms.map((term) => ({
      $or: [
        { name: { $regex: term, $options: "i" } },
        { description: { $regex: term, $options: "i" } },
      ],
    }));

    // Build exclude query
    const excludeQueries = excludeTerms.map((term) => ({
      $and: [
        { name: { $not: { $regex: term, $options: "i" } } },
        { description: { $not: { $regex: term, $options: "i" } } },
      ],
    }));

    // 4. Find complementary items
    const baseQuery = {
      $and: [
        { $or: searchQueries },
        { _id: { $nin: selectedIds } }, // Exclude cart items
        { status: 1 }, // Only active items
        { stock: { $gt: 0 } }, // Only items in stock
        ...excludeQueries, // Exclude unwanted categories
      ],
    };

    // Apply price filter if specified
    if (complementaryAnalysis.filters?.maxPrice) {
      baseQuery.$and.push({
        price: { $lte: complementaryAnalysis.filters.maxPrice },
      });
    }

    let complementaryItems = await Item.find(baseQuery)
      .populate("category", "name")
      .populate("furnituretype", "name")
      .sort({ sales: -1, createdAt: -1 }) // Prefer popular items
      .limit(3)
      .select(
        "_id name description price imageUrl category furnituretype sales"
      );

    console.log(
      `[GROQ-REC]: Found ${complementaryItems.length} complementary recommendations`
    );

    // 5. If we don't have enough results, try a broader search
    if (complementaryItems.length < 2) {
      console.log("[GROQ-REC]: Expanding search with priority items...");

      const priorityTerms = complementaryAnalysis.priorityItems || [
        "furniture",
        "accessories",
      ];
      if (priorityTerms.length > 0) {
        const broadQuery = {
          $and: [
            {
              $or: priorityTerms.map((term) => ({
                $or: [
                  { name: { $regex: term, $options: "i" } },
                  { description: { $regex: term, $options: "i" } },
                ],
              })),
            },
            { _id: { $nin: selectedIds } },
            { status: 1 },
            { stock: { $gt: 0 } },
          ],
        };

        const additionalItems = await Item.find(broadQuery)
          .populate("category", "name")
          .populate("furnituretype", "name")
          .sort({ is_bestseller: -1, sales: -1 })
          .limit(3 - complementaryItems.length)
          .select(
            "_id name description price imageUrl category furnituretype sales"
          );

        complementaryItems = [...complementaryItems, ...additionalItems];
      }
    }

    // 6. If still no results, get some bestsellers excluding cart items
    if (complementaryItems.length === 0) {
      console.log(
        "[GROQ-REC]: No specific matches found, getting bestsellers..."
      );
      complementaryItems = await Item.find({
        _id: { $nin: selectedIds },
        status: 1,
        stock: { $gt: 0 },
        is_bestseller: true,
      })
        .populate("category", "name")
        .populate("furnituretype", "name")
        .sort({ sales: -1 })
        .limit(3)
        .select(
          "_id name description price imageUrl category furnituretype sales"
        );
    }

    // 7. NEW: Handle AI-specific recommendations if available
    let aiSpecificRecommendations = [];
    if (complementaryAnalysis.specificRecommendations && complementaryAnalysis.specificRecommendations.length > 0) {
      console.log("[GROQ-REC]: Processing AI-specific recommendations...");
      
      // Get the exact items recommended by AI
      const recommendedItemNames = complementaryAnalysis.specificRecommendations.map(rec => rec.itemName);
      console.log("[GROQ-REC]: AI recommended items:", recommendedItemNames);
      
      // First try exact match
      let specificItems = await Item.find({
        name: { $in: recommendedItemNames },
        _id: { $nin: selectedIds }, // Exclude cart items
        status: 1,
        stock: { $gt: 0 }
      })
      .populate("category", "name")
      .populate("furnituretype", "name")
      .select("_id name description price imageUrl category furnituretype sales");

      console.log(`[GROQ-REC]: Found ${specificItems.length} exact matches`);

      // If no exact matches, try fuzzy matching
      if (specificItems.length === 0) {
        console.log("[GROQ-REC]: No exact matches found, trying fuzzy matching...");
        
        for (const recommendedName of recommendedItemNames) {
          // Try to find items that contain keywords from the recommended name
          const keywords = recommendedName.toLowerCase().split(' ').filter(word => word.length > 2);
          
          const fuzzyQuery = {
            $and: [
              { _id: { $nin: selectedIds } },
              { status: 1 },
              { stock: { $gt: 0 } },
              {
                $or: keywords.map(keyword => ({
                  name: { $regex: keyword, $options: "i" }
                }))
              }
            ]
          };

          const fuzzyMatches = await Item.find(fuzzyQuery)
            .populate("category", "name")
            .populate("furnituretype", "name")
            .select("_id name description price imageUrl category furnituretype sales")
            .limit(1);

          if (fuzzyMatches.length > 0) {
            specificItems.push(fuzzyMatches[0]);
            console.log(`[GROQ-REC]: Found fuzzy match for "${recommendedName}": "${fuzzyMatches[0].name}"`);
          }
        }
      }

      // Match AI recommendations with actual items and add reasoning
      aiSpecificRecommendations = specificItems.map(item => {
        const aiRec = complementaryAnalysis.specificRecommendations.find(rec => 
          rec.itemName.toLowerCase() === item.name.toLowerCase()
        );
        
        // If no exact match found, use the first recommendation's reasoning
        const fallbackReason = complementaryAnalysis.specificRecommendations[0]?.reason || 
          "Perfect complement to your selection";
        
        return {
          ...item.toObject(),
          aiReasoning: aiRec ? aiRec.reason : fallbackReason,
          isFuzzyMatch: !aiRec // Flag to indicate this was a fuzzy match
        };
      });

      console.log(`[GROQ-REC]: Final AI-specific recommendations: ${aiSpecificRecommendations.length} items`);
    }

    console.log(
      "--- GROQ-POWERED COMPLEMENTARY RECOMMENDATION ENGINE COMPLETED ---"
    );
    res.json({
      success: true,
      ItemData: complementaryItems,
      aiSpecificRecommendations: aiSpecificRecommendations,
      analysis: {
        reasoning:
          complementaryAnalysis.reasoning ||
          "Recommended items that complement your selection",
        detectedRoom: complementaryAnalysis.detectedRoom || "general",
        completionLevel:
          complementaryAnalysis.completionLevel || "improving your setup",
        specificRecommendations: complementaryAnalysis.specificRecommendations || []
      },
    });
  } catch (err) {
    console.log("--- GROQ-POWERED RECOMMENDATION ENGINE FAILED ---");
    console.error("[GROQ-REC-ERROR]: An error occurred:", err.message);
    console.error("[GROQ-REC-ERROR]: Stack trace:", err.stack);

    // Return a fallback response instead of failing completely
    res.json({
      success: true,
      ItemData: [],
      analysis: {
        reasoning: "Unable to generate specific recommendations at this time",
        detectedRoom: "general",
        completionLevel: "Please browse our catalog for more items",
      },
    });
  }
});

// Get or create a chat for a user with an admin

app.post("/api/chats", authenticateToken, async (req, res) => {
  if (req.user.role !== "user") {
    return res.status(403).json({ msg: "Only users can start chats." });
  }
  try {
    const admin = await User.findOne({ role: "admin" });
    if (!admin) {
      return res.status(404).json({ msg: "No admin available to chat with." });
    }

    let chat = await Chat.findOne({
      participants: { $all: [req.user.id, admin.id] },
    });

    if (!chat) {
      chat = new Chat({
        participants: [req.user.id, admin.id],
        messages: [],
      });
      await chat.save();
    }

    // THIS IS THE CRITICAL FIX: Ensure population happens reliably after finding or creating
    await chat.populate([
      { path: "participants", select: "name role" },
      { path: "messages.sender", select: "name role" },
    ]);

    res.json(chat);
  } catch (err) {
    
    console.error("Error fetching/creating chat for user:", err.message);
    res.status(500).send("Server Error");
  }
});

// --- START OF CHAT API ROUTES ---

// --- WEBSOCKET (SOCKET.IO) LOGIC ---
io.on("connection", (socket) => {
  console.log("A user connected via WebSocket:", socket.id);

  socket.on("joinChat", (chatId) => {
    socket.join(chatId);
    console.log(`User ${socket.id} joined chat room ${chatId}`);
  });

  socket.on("sendMessage", async ({ chatId, senderId, content }) => {
    try {
      const sender = await User.findById(senderId);
      if (!sender) {
        console.error("Sender not found:", senderId);
        return;
      }

      const message = {
        sender: senderId,
        content: content,
        timestamp: new Date(),
      };

      const chat = await Chat.findByIdAndUpdate(
        chatId,
        {
          $push: { messages: message },
          lastMessageAt: new Date(),
        },
        { new: true }
      ).populate("messages.sender", "name role");

      if (chat) {
        const lastMessage = chat.messages[chat.messages.length - 1];
        const messageToSend = {
          ...lastMessage.toObject(),
          chatId: chat._id,
          sender: {
            _id: sender._id,
            name: sender.name,
            role: sender.role,
          },
        };

        io.in(chatId).emit("receiveMessage", messageToSend);
        io.emit("updateChatList");
      } else {
        console.error("Chat not found:", chatId);
      }
    } catch (error) {
      console.error("Error handling sendMessage:", error);
      socket.emit("messageError", {
        chatId,
        error: "Failed to send message",
      });
    }
  });

  socket.on("typing", ({ chatId, isTyping }) => {
    socket.to(chatId).emit("userTyping", {
      chatId,
      userId: socket.id,
      isTyping,
    });
  });

  socket.on("deleteChat", (chatId) => {
    // Notify all connected clients that a chat has been deleted
    io.emit("chatDeleted", chatId);
    console.log(`Chat ${chatId} deletion broadcasted to all clients`);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected from WebSocket:", socket.id);
  });
});
// --- END OF WEBSOCKET LOGIC ---

// --- ANALYTICS API ROUTES ---
// Get summary statistics (MUST be before the parameterized route)
app.get("/api/analytics/summary", authenticateToken, authorizeRoles("admin"), async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get orders for different periods
    const [todayOrders, weekOrders, monthOrders, allOrders] = await Promise.all([
      Order.find({
        createdAt: { $gte: todayStart },
        status: { $nin: ['Cancelled', 'Refunded'] }
      }).populate('items.item'),
      Order.find({
        createdAt: { $gte: weekStart },
        status: { $nin: ['Cancelled', 'Refunded'] }
      }).populate('items.item'),
      Order.find({
        createdAt: { $gte: monthStart },
        status: { $nin: ['Cancelled', 'Refunded'] }
      }).populate('items.item'),
      Order.find({
        status: { $nin: ['Cancelled', 'Refunded'] }
      }).populate('items.item')
    ]);

    const calculateStats = (orders) => {
      let revenue = 0;
      let customizedProfit = 0;
      let normalProfit = 0;

      orders.forEach(order => {
        revenue += order.amount;

        order.items.forEach(orderItem => {
          const item = orderItem.item;
          if (!item) return;

          const itemRevenue = orderItem.price * orderItem.quantity;
          const isCustomized = orderItem.customH || orderItem.customW || orderItem.customL;

          if (isCustomized) {
            // Use your profit margin formula for customized items
            // Get profit margin from item's customization options, fallback to 0.5
            const margin = item.customization_options?.profit_margin || 0.5;
            const margindivider = 1 + margin;
            const cost = itemRevenue / margindivider;
            const profit = itemRevenue - cost;
            customizedProfit += profit;
          } else {
            // Use simple cost calculation for normal items
            const itemCost = item.cost * orderItem.quantity;
            const profit = itemRevenue - itemCost;
            normalProfit += profit;
          }
        });
      });

      return {
        revenue: parseFloat(revenue.toFixed(2)),
        customizedProfit: parseFloat(customizedProfit.toFixed(2)),
        normalProfit: parseFloat(normalProfit.toFixed(2)),
        totalProfit: parseFloat((customizedProfit + normalProfit).toFixed(2)),
        orderCount: orders.length,
        averageOrderValue: orders.length > 0 ? parseFloat((revenue / orders.length).toFixed(2)) : 0
      };
    };

    res.json({
      success: true,
      summary: {
        today: calculateStats(todayOrders),
        week: calculateStats(weekOrders),
        month: calculateStats(monthOrders),
        allTime: calculateStats(allOrders)
      }
    });

  } catch (error) {
    console.error("Error fetching summary analytics:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ success: false, message: "Failed to fetch summary data", error: error.message });
  }
});

// Get customized orders analytics (MUST be before the parameterized route)
app.get("/api/analytics/custom-orders", authenticateToken, authorizeRoles("admin"), async (req, res) => {
  try {
    // Find all orders with at least one customized item
    const orders = await Order.find({
      status: { $nin: ["Cancelled", "Refunded"] },
    })
      .populate("user", "name email")
      .populate("items.item");

    const customOrders = [];

    orders.forEach((order) => {
      order.items.forEach((orderItem) => {
        const item = orderItem.item;
        // Show ALL orders of customizable items (whether they have custom dimensions or not)
        if (item?.is_customizable) {
          // Calculate custom order profit using your formula
          const customPrice = orderItem.price * orderItem.quantity;
          // Get profit margin from item's customization options, fallback to 0.5
          const margin = item?.customization_options?.profit_margin || 0.5;
          const margindivider = 1 + margin;
          const cost = customPrice / margindivider;
          const profit = customPrice - cost;

          // Check if this order has custom dimensions
          const hasCustomDimensions = orderItem.customH || orderItem.customW || orderItem.customL;

          customOrders.push({
            orderId: order._id,
            customer: order.user?.name || order.user?.email || "N/A",
            date: order.createdAt,
            itemName: item?.name || "Unknown Item",
            customPrice,
            margin,
            cost: parseFloat(cost.toFixed(2)),
            profit: parseFloat(profit.toFixed(2)),
            hasCustomDimensions, // Add this info for reference
          });
        }
      });
    });

    res.json({ success: true, customOrders });
  } catch (error) {
    console.error("Error fetching custom orders analytics:", error);
    res.status(500).json({ success: false, message: "Failed to fetch custom orders analytics" });
  }
});

// Get analytics data for different time periods
app.get("/api/analytics/:period", authenticateToken, authorizeRoles("admin"), async (req, res) => {
  try {
    const { period } = req.params; // hourly, daily, weekly, monthly
    console.log("Analytics request for period:", period);

    const now = new Date();
    let startDate;

    // Determine time range based on period
    switch (period) {
      case 'hourly':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
        break;
      case 'daily':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 4 * 7 * 24 * 60 * 60 * 1000); // Last 4 weeks
        break;
      case 'monthly':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // Last 12 months
        break;
      default:
        return res.status(400).json({ success: false, message: "Invalid period" });
    }

    // Fetch orders with populated items
    console.log("Fetching orders from:", startDate);
    const orders = await Order.find({
      createdAt: { $gte: startDate },
      status: { $nin: ['Cancelled', 'Refunded'] }
    }).populate('items.item');
    console.log("Found", orders.length, "orders");

    // If no orders found, return empty data
    if (orders.length === 0) {
      console.log("No orders found, returning empty analytics data");
      return res.json({
        success: true,
        period,
        analytics: [],
        itemSales: []
      });
    }

    // Process data for analytics
    const analyticsData = [];
    const itemSalesMap = new Map();

    // Group orders by time period
    const groupedOrders = {};

    orders.forEach(order => {
      try {
        const date = new Date(order.createdAt);
        let key;

        switch (period) {
          case 'hourly':
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
            break;
          case 'daily':
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            break;
          case 'weekly':
            const weekNumber = Math.ceil((date.getDate() + new Date(date.getFullYear(), date.getMonth(), 1).getDay()) / 7);
            key = `Week ${weekNumber}, ${date.getFullYear()}`;
            break;
          case 'monthly':
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            break;
        }

        if (!groupedOrders[key]) {
          groupedOrders[key] = {
            period: key,
            orders: [],
            totalRevenue: 0,
            totalOrders: 0,
            customizedProfit: 0,
            normalProfit: 0
          };
        }

        groupedOrders[key].orders.push(order);
      } catch (orderError) {
        console.error("Error processing order:", order._id, orderError);
      }
    });

    // Calculate metrics for each period
    console.log("Processing", Object.keys(groupedOrders).length, "time periods");
    Object.values(groupedOrders).forEach(group => {
      group.orders.forEach(order => {
        group.totalRevenue += order.amount;
        group.totalOrders += 1;

        order.items.forEach(orderItem => {
          try {
            const item = orderItem.item;
            if (!item) {
              console.log("Warning: Order item without populated item found");
              return;
            }

            // Calculate profit using correct formula
            const itemRevenue = orderItem.price * orderItem.quantity;
            const isCustomized = orderItem.customH || orderItem.customW || orderItem.customL;

            if (isCustomized) {
              // Use your profit margin formula for customized items
              // Get profit margin from item's customization options, fallback to 0.5
              const margin = item.customization_options?.profit_margin || 0.5;
              const margindivider = 1 + margin;
              const cost = itemRevenue / margindivider;
              const profit = itemRevenue - cost;
              group.customizedProfit += profit;
            } else {
              // Use simple cost calculation for normal items
              const itemCost = item.cost * orderItem.quantity;
              const profit = itemRevenue - itemCost;
              group.normalProfit += profit;
            }

            // Track item sales - ONLY for non-customizable items in regular sales table
            if (!item.is_customizable) {
              const itemId = item._id.toString();
              if (!itemSalesMap.has(itemId)) {
                itemSalesMap.set(itemId, {
                  itemId: itemId,
                  name: item.name,
                  costPrice: item.cost,
                  sellingPrice: item.price,
                  totalSold: 0,
                  totalRevenue: 0,
                  totalProfit: 0
                });
              }

              const itemData = itemSalesMap.get(itemId);
              itemData.totalSold += orderItem.quantity;
              itemData.totalRevenue += itemRevenue;

              // Calculate profit for normal items only
              const itemCost = item.cost * orderItem.quantity;
              const profit = itemRevenue - itemCost;
              itemData.totalProfit += profit;
            }
          } catch (itemError) {
            console.error("Error processing order item:", itemError);
          }
        });
      });

      // Calculate average order amount
      group.averageOrderAmount = group.totalOrders > 0 ? group.totalRevenue / group.totalOrders : 0;

      analyticsData.push({
        period: group.period,
        averageOrderAmount: parseFloat(group.averageOrderAmount.toFixed(2)),
        revenue: parseFloat(group.totalRevenue.toFixed(2)),
        customizedProfit: parseFloat(group.customizedProfit.toFixed(2)),
        normalProfit: parseFloat(group.normalProfit.toFixed(2)),
        totalProfit: parseFloat((group.customizedProfit + group.normalProfit).toFixed(2)),
        orderCount: group.totalOrders
      });
    });

    // Sort analytics data by period
    console.log("Sorting analytics data...");
    analyticsData.sort((a, b) => {
      const dateA = new Date(a.period.replace('Week ', ''));
      const dateB = new Date(b.period.replace('Week ', ''));
      return dateA - dateB;
    });

    // Convert item sales map to array
    console.log("Converting item sales map to array...");
    const itemSales = Array.from(itemSalesMap.values()).map(item => ({
      ...item,
      totalRevenue: parseFloat(item.totalRevenue.toFixed(2)),
      totalProfit: parseFloat(item.totalProfit.toFixed(2))
    }));

    res.json({
      success: true,
      period,
      analytics: analyticsData,
      itemSales: itemSales.sort((a, b) => b.totalProfit - a.totalProfit) // Sort by profit
    });

  } catch (error) {
    console.error("Error fetching analytics:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ success: false, message: "Failed to fetch analytics data", error: error.message });
  }
});

// --- END OF ANALYTICS API ROUTES ---

//PATMONGO API------------------------------------------------------------
app.post(
  "/api/create-checkout-session",
  authenticateToken,
  async (req, res) => {
    console.log("=== PAYMONGO CHECKOUT SESSION CREATION STARTED ===");

    // The amount and shippingFee now come directly from the frontend's calculation
    const { amount, items, shippingFee, deliveryOption } = req.body;

    // --- Validation remains the same ---
    if (!process.env.PAYMONGO_SECRET_KEY || !process.env.FRONTEND_URL) {
      return res.status(500).json({ error: "Payment configuration error." });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Items are required." });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valid amount is required." });
    }
    console.log("Request validation passed.");

    try {
      // --- THIS IS THE CORRECTED LOGIC ---
      // 1. Create line items from the products
      const line_items = items.map((item) => ({
        amount: Math.round(item.price * 100), // Convert to centavos
        currency: "PHP",
        name: item.name,
        quantity: item.quantity,
      }));

      // 2. If there is a shipping fee, add it as its own line item
      if (deliveryOption === "shipping" && shippingFee > 0) {
        line_items.push({
          amount: Math.round(shippingFee * 100),
          currency: "PHP",
          name: "Shipping Fee",
          quantity: 1,
        });
      }

      // 3. The total amount for the checkout session should match the grandTotal from the frontend
      const totalAmountInCentavos = Math.round(amount * 100);

      const frontendUrl = process.env.FRONTEND_URL.replace(/\/$/, "");

      const checkoutData = {
        data: {
          attributes: {
            line_items,
            payment_method_types: ["gcash", "card"],
            success_url: `${frontendUrl}/success`,
            cancel_url: `${frontendUrl}/cancel`,
            send_email_receipt: true,
            show_line_items: true,
            // The API expects the total amount to be here as well for some validations
            amount: totalAmountInCentavos,
          },
        },
      };

      console.log(
        "Creating PayMongo checkout session with data:",
        JSON.stringify(checkoutData, null, 2)
      );

      const response = await axios.post(
        "https://api.paymongo.com/v1/checkout_sessions",
        checkoutData,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${Buffer.from(
              `${process.env.PAYMONGO_SECRET_KEY}:`
            ).toString("base64")}`,
          },
        }
      );

      console.log("=== PAYMONGO RESPONSE RECEIVED ===");
      res.json({ checkoutUrl: response.data.data.attributes.checkout_url });
    } catch (error) {
      console.log("=== PAYMONGO ERROR ===");
      console.error(
        "Paymongo error details:",
        error.response?.data?.errors || error.message
      );
      res.status(500).json({
        error: "Payment failed",
        details: error.response?.data?.errors || "An unknown error occurred.",
      });
    }
  }
);
// Update webhook to clear cart on successful payment
app.post(
  "/api/paymongo-webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["paymongo-signature"];
    const payload = req.body;

    try {
      // Verify webhook signature (implement according to Paymongo docs)
      const event = JSON.parse(payload.toString());

      if (event.type === "checkout_session.completed") {
        const sessionId = event.data.attributes.data.id;
        const order = await Order.findOne({
          transactionId: sessionId,
        }).populate("user", "name email");

        if (order) {
          // Update order status
          order.status = "On Process";
          await order.save();

          const itemIds = order.items.map((item) => item._id);

          await Cart.findOneAndUpdate(
            { user: order.user },
            { $pull: { items: { _id: { $in: itemIds } } } }
          );

          // Update sales count for all items in the order
          for (const orderItem of order.items) {
            await Item.findByIdAndUpdate(orderItem.item, {
              $inc: { sales: orderItem.quantity }
            });
          }

          console.log(`Order ${order._id} marked as paid, cart cleared, and sales updated`);

          // Log the payment received
          await LoggerService.logPayment(
            "payment_received",
            order,
            order.user,
            {
              paymentMethod: "PayMongo",
              sessionId,
              amount: order.amount,
            }
          );
        }
      }

      res.status(200).end();
    } catch (err) {
      console.error("Webhook error:", err);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

// Add endpoint to handle canceled payments
app.put("/api/orders/:id/cancel", authenticateToken, async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: "cancelled" },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Verify the order belongs to the requesting user
    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update order status when user returns from payment
app.get("/api/orders/:id/status", authenticateToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("user", "name email")
      .populate("items.item");

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Verify the order belongs to the requesting user
    if (
      order.user._id.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    res.json({
      ...order.toObject(),
      address: order.address,
      phone: order.phone,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all orders for a user
app.get("/api/user/orders", authenticateToken, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .sort("-createdAt")
      .populate("items.item");

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit delivery proof and complete order
app.post(
  "/api/orders/:id/delivery-proof",
  authenticateToken,
  authorizeRoles("admin"),
  upload.single("deliveryProof"),
  async (req, res) => {
    try {
      const orderId = req.params.id;

      // Check for multer errors
      if (req.fileValidationError) {
        return res
          .status(400)
          .json({ success: false, message: req.fileValidationError });
      }

      if (!req.file) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Delivery proof image is required",
          });
      }

      console.log(
        `Processing delivery proof upload for order ${orderId}. File size: ${(
          req.file.size /
          1024 /
          1024
        ).toFixed(2)}MB`
      );

      // Upload image to Cloudinary with optimizations
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "delivery_proofs",
          // Optimization settings for faster uploads
          quality: "auto:good", // Automatic quality optimization
          fetch_format: "auto", // Automatic format conversion (WebP when supported)
          width: 1200, // Max width to reduce file size
          height: 1200, // Max height to maintain aspect ratio
          crop: "limit", // Don't upscale, only downscale if needed
          flags: "progressive", // Progressive JPEG for faster loading
          resource_type: "image", // Explicitly set as image
        },
        async (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            return res
              .status(500)
              .json({ success: false, message: "Failed to upload image" });
          }

          try {
            // ----------------------------------------------------
            //  Determine the correct final status based on how the
            //  customer will receive the item(s). If the order's
            //  deliveryOption is "shipping" we mark it as Delivered,
            //  otherwise (store pickup) we mark it as Picked Up.
            // ----------------------------------------------------

            // Fetch the order first to inspect its delivery option
            const existingOrder = await Order.findById(orderId).select("deliveryOption");
            const finalStatus = existingOrder?.deliveryOption === "pickup" ? "Picked Up" : "Delivered";

            // Update order with delivery proof and correct status
            const updatedOrder = await Order.findByIdAndUpdate(
              orderId,
              {
                status: finalStatus,
                deliveryProof: result.secure_url,
                deliveryDate: new Date(),
              },
              { new: true }
            )
              .populate("user", "name email")
              .populate("items.item", "name price");

            if (!updatedOrder) {
              return res
                .status(404)
                .json({ success: false, message: "Order not found" });
            }

            console.log(
              `Delivery proof submitted for order ${orderId}:`,
              result.secure_url
            );

            // Log the delivery proof upload
            await LoggerService.logOrder(
              "delivery_proof_uploaded",
              updatedOrder,
              req.user,
              {
                deliveryProofUrl: result.secure_url,
                customerName: updatedOrder.user?.name,
                customerEmail: updatedOrder.user?.email,
                previousStatus: "On Process",
                newStatus: updatedOrder.status,
              },
              req
            );

            res.json({
              success: true,
              message: "Delivery proof submitted and order completed",
              OrderData: updatedOrder,
              deliveryProofUrl: result.secure_url,
            });
          } catch (updateError) {
            console.error(
              "Error updating order with delivery proof:",
              updateError
            );
            res
              .status(500)
              .json({ success: false, message: "Failed to update order" });
          }
        }
      );

      uploadStream.end(req.file.buffer);
    } catch (err) {
      console.error("Error submitting delivery proof:", err.message);
      res
        .status(500)
        .json({
          success: false,
          message: "Server error submitting delivery proof",
        });
    }
  }
);

// Updated Order Creation Route
app.post("/api/orders", authenticateToken, async (req, res) => {
  console.log("=== BACKEND ORDER CREATION STARTED ===");
  console.log("Request body:", req.body);
  console.log("User ID from token:", req.user.id);

  const {
    items,
    amount,
    totalWithShipping,
    transactionHash,
    deliveryOption,
    shippingFee,
    scheduledDate,
    shippingInfo,
  } = req.body;
  const userId = req.user.id;

  console.log("Order creation request received:", {
    userId,
    amount,
    totalWithShipping,
    deliveryOption,
    itemsCount: items?.length,
    hasShippingInfo: !!shippingInfo,
    transactionHash,
  });

  try {
    // --- Duplicate check logic remains the same ---
    if (transactionHash) {
      console.log("Checking for duplicate order with hash:", transactionHash);
      const existingOrderByHash = await Order.findOne({
        transactionHash: transactionHash,
      });
      if (existingOrderByHash) {
        console.log("Duplicate order detected by transaction hash");
        return res.status(200).json({
          message: "Order already exists",
          orderId: existingOrderByHash._id,
          isDuplicate: true,
        });
      }
    }

    console.log("=== FETCHING USER DETAILS ===");
    const user = await User.findById(userId);
    if (!user) {
      console.log("ERROR: User not found with ID:", userId);
      return res.status(404).json({ error: "User not found" });
    }

    // Address processing logic remains the same...
    let orderAddress;
    let orderPhone;
    let orderShippingAddress = null;

    if (deliveryOption === "shipping" && shippingInfo) {
      orderAddress = `${shippingInfo.addressLine1}, ${shippingInfo.brgyName}, ${shippingInfo.cityName}, ${shippingInfo.postalCode}`;
      orderPhone = shippingInfo.phone;
      orderShippingAddress = {
        fullName: shippingInfo.fullName,
        addressLine1: shippingInfo.addressLine1,
        city: shippingInfo.cityName,
        state: shippingInfo.provinceName,
        postalCode: shippingInfo.postalCode,
        phone: shippingInfo.phone,
      };
    } else {
      if (user.address && typeof user.address === "object") {
        const addr = user.address;
        orderAddress = `${addr.addressLine1 || ""}, ${addr.brgyName || ""}, ${addr.cityName || ""
          }, ${addr.postalCode || ""}`
          .replace(/^,\s*/, "")
          .replace(/,\s*,/g, ",");
      } else {
        orderAddress = user.address || "No address provided";
      }
      orderPhone = user.phone || "No phone provided";
    }

    if (!orderAddress || orderAddress.trim() === "") {
      orderAddress = "Address not provided";
    }
    if (!orderPhone || orderPhone.trim() === "") {
      orderPhone = "Phone not provided";
    }

    console.log("=== PROCESSING ITEMS FOR ORDER ===");
    const processedItems = items.map((item) => {
      const newItem = {
        item: item.id || item.item,
        quantity: item.quantity,
        price: item.price,
        customH:
          item.customH ?? item.custom_details?.dimensions?.height ?? null,
        customW: item.customW ?? item.custom_details?.dimensions?.width ?? null,
        customL:
          item.customL ?? item.custom_details?.dimensions?.length ?? null,
        legsFrameMaterial:
          item.legsFrameMaterial ?? item.custom_details?.material3x3 ?? null,
        tabletopMaterial:
          item.tabletopMaterial ?? item.custom_details?.material2x12 ?? null,
      };
      return newItem;
    });

    // === NEW: DOWN PAYMENT SYSTEM LOGIC ===
    console.log("=== DETERMINING ITEM TYPES AND ORDER STATUS ===");

    const itemIds = processedItems.map((item) => item.item);
    const itemDetails = await Item.find({ _id: { $in: itemIds } });

    const hasCustomizableItems = itemDetails.some((item) => item.is_customizable);
    console.log("Has customizable items:", hasCustomizableItems);

    // --- FIXED PAYMENT CALCULATION LOGIC ---
    // We now respect the paymentType ("full_payment"|"down_payment") and the actual amount paid that the
    // frontend sends via `paidAmount`. This prevents the backend from incorrectly marking a *full payment*
    // for customizable carts as a partial / down-payment.
    const { paymentType = "full_payment", paidAmount } = req.body; // paidAmount == amount actually charged now

    let downPayment = 0;
    let balance = 0;
    let paymentStatus = "Pending";
    let initialStatus = "Pending";

    if (hasCustomizableItems) {
      if (paymentType === "full_payment") {
        // Customer settled the entire amount for customized items upfront
        downPayment = amount; // full amount becomes the initial payment
        balance = 0;
        paymentStatus = "Fully Paid";
        initialStatus = deliveryOption === "pickup" ? "Ready for Pickup" : "On Process";
      } else {
        // Customer chose down-payment (30% of custom + full of normal) – the frontend already computed `paidAmount`
        downPayment = paidAmount; // amount actually charged now
        balance = amount - downPayment;
        paymentStatus = "Downpayment Received";
        initialStatus = "On Process";
      }
    } else {
      // No customizable items → always full payment
      downPayment = amount;
      balance = 0;
      paymentStatus = "Fully Paid";
      initialStatus = deliveryOption === "pickup" ? "Ready for Pickup" : "On Process";
    }

    console.log("Payment breakdown (fixed):", {
      totalAmount: amount,
      downPayment,
      balance,
      paymentStatus,
      initialStatus,
      paymentType,
      paidAmount,
    });

    // Create the order with new payment fields
    const orderData = {
      user: userId,
      amount,
      totalWithShipping,
      downPayment,
      balance,
      paymentStatus,
      status: initialStatus,
      transactionHash: transactionHash,
      items: processedItems,
      address: orderAddress,
      phone: orderPhone,
      shippingAddress: orderShippingAddress,
      deliveryOption: deliveryOption,
      shippingFee: shippingFee || 0,
      deliveryDate: scheduledDate ? new Date(scheduledDate) : null,
    };

    console.log("=== FINAL ORDER DATA ===");
    console.log("Order data to save:", orderData);

    const order = new Order(orderData);
    await order.save();

    console.log("=== ORDER SAVED SUCCESSFULLY ===");
    console.log("Order saved successfully:", {
      orderId: order._id,
      userId: order.user,
      deliveryOption: deliveryOption,
      status: order.status,
      paymentStatus: order.paymentStatus,
      downPayment: order.downPayment,
      balance: order.balance,
    });

    // Log the order creation
    await LoggerService.logOrder(
      "order_created",
      order,
      req.user,
      {
        customerName: user.name,
        customerEmail: user.email,
        deliveryOption,
        paymentStatus: order.paymentStatus,
        itemsCount: processedItems.length,
        hasCustomizableItems,
      },
      req
    );

    res.status(201).json(order);
  } catch (error) {
    console.log("=== ORDER CREATION ERROR ===");
    console.error("Error creating order:", error);
    res.status(500).json({
      error: "Failed to create order.",
      details: error.message,
    });
  }
});

app.post(
  "/api/orders/:id/complete-payment",
  authenticateToken,
  async (req, res) => {
    try {
      const { id: orderId } = req.params;
      const userId = req.user.id;

      const order = await Order.findById(orderId).populate("items.item");

      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: "Order not found." });
      }

      if (order.user.toString() !== userId) {
        return res
          .status(403)
          .json({
            success: false,
            message: "You are not authorized to pay for this order.",
          });
      }

      // Use the same logic as the frontend to calculate remaining balance
      let customizedTotal = 0;
      order.items.forEach((item) => {
        const itemTotal = (item.price || 0) * item.quantity;
        if (item.item.is_customizable) {
          customizedTotal += itemTotal;
        }
      });

      const amountToPay = Math.round(order.balance * 100);

      if (amountToPay <= 0) {
        return res
          .status(400)
          .json({
            success: false,
            message: "No remaining balance to be paid.",
          });
      }

      const frontendUrl = process.env.FRONTEND_URL.replace(/\/$/, "");

      const paymongoResponse = await axios.post(
        "https://api.paymongo.com/v1/checkout_sessions",
        {
          data: {
            attributes: {
              send_email_receipt: true,
              show_description: true,
              show_line_items: true,
              amount: amountToPay,
              line_items: [
                {
                  currency: "PHP",
                  amount: amountToPay,
                  description: `Remaining balance for Order #${order._id
                    .toString()
                    .slice(-8)}`,
                  name: `Full Payment for Order #${order._id
                    .toString()
                    .slice(-8)}`,
                  quantity: 1,
                },
              ],
              payment_method_types: ["card", "gcash"],
              description: `Payment for Order #${order._id
                .toString()
                .slice(-8)}`,
              success_url: `${frontendUrl}/orders/${order._id}?payment=success`,
              cancel_url: `${frontendUrl}/orders/${order._id}?payment=cancelled`,
            },
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${Buffer.from(
              `${process.env.PAYMONGO_SECRET_KEY}:`
            ).toString("base64")}`,
          },
        }
      );
      order.transactionHash = paymongoResponse.data.data.id;
      order.paymentStatus = "Fully Paid";
      order.balance = 0;
      order.downPayment = order.totalWithShipping;
      await order.save();
      console.log(`[Complete Payment] Saved new transaction hash ${order.transactionHash} for order ${order._id}`);


      res.json({
        checkoutUrl: paymongoResponse.data.data.attributes.checkout_url,
      });
    } catch (error) {
      console.error("Error creating complete payment session:", error);
      res
        .status(500)
        .json({
          success: false,
          message: "Server error creating complete payment session",
        });
    }
  }
);

//confirms order after paymongo
app.put("/api/orders/:id/confirm", async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }
  order.status = "On Process";
  await order.save();
  res.json(order);
});

// Request refund endpoint
app.put(
  "/api/orders/:id/request-refund",
  authenticateToken,
  async (req, res) => {
    console.log("=== BACKEND REFUND REQUEST STARTED ===");
    console.log("Order ID:", req.params.id);
    console.log("User ID:", req.user.id);
    console.log("User role:", req.user.role);

    try {
      const order = await Order.findById(req.params.id).populate("items.item");

      if (!order) {
        console.log("ERROR: Order not found");
        return res.status(404).json({ error: "Order not found" });
      }

      console.log("Order found:", {
        id: order._id,
        status: order.status,
        user: order.user,
        itemsCount: order.items.length,
      });

      // Verify the order belongs to the requesting user
      if (order.user.toString() !== req.user.id) {
        console.log("ERROR: User not authorized to refund this order");
        return res
          .status(403)
          .json({ error: "Unauthorized to refund this order" });
      }

      // Check if order is in "On Process" status
      if (order.status !== "On Process") {
        console.log(
          "ERROR: Order is not in 'On Process' status. Current status:",
          order.status
        );
        return res.status(400).json({
          error:
            "Refund requests can only be made for orders that are currently being processed",
        });
      }

      // Check if any items are customized
      const hasCustomizedItems = order.items.some((item) => {
        const isCustomized = item.item?.is_customizable || false;
        console.log(
          `Item ${item.item?.name}: is_customizable = ${isCustomized}`
        );
        return isCustomized;
      });

      console.log("Has customized items:", hasCustomizedItems);

      if (hasCustomizedItems) {
        console.log(
          "ERROR: Order contains customized items. Refund not allowed."
        );
        return res.status(400).json({
          error:
            "Refund requests cannot be made for orders containing customized items",
        });
      }

      // Update order status to "Requesting for Refund"
      console.log("Updating order status to 'Requesting for Refund'");
      order.status = "Requesting for Refund";
      order.paymentStatus = "Refund Requested"; // Update payment status
      await order.save();

      console.log("=== REFUND REQUEST SUCCESSFUL ===");
      console.log("Order status updated to:", order.status);

      res.json({
        success: true,
        message: "Refund request submitted successfully",
        order: order,
      });
    } catch (error) {
      console.log("=== REFUND REQUEST ERROR ===");
      console.error("Error processing refund request:", error);
      res.status(500).json({
        error: "Failed to process refund request",
        details: error.message,
      });
    }
  }
);
//PAYMONGO API END ------------------------------------------------------

//USERS API----------------------------------------------------------------

// registration
// Enhanced Registration Route with Better Validation and Error Handling
app.post("/api/registeruser", async (req, res) => {
  console.log("=== REGISTRATION REQUEST RECEIVED ===");
  console.log("Request body:", req.body);

  const { name, email, password, phone, role, recaptcha } = req.body; // Add recaptcha

  // Enhanced validation with specific error messages
  const validationErrors = [];

  if (!name || name.trim().length < 2) {
    validationErrors.push("Name must be at least 2 characters long");
  }

  if (!email || !email.trim()) {
    validationErrors.push("Email is required");
  } else if (!/\S+@\S+\.\S+/.test(email)) {
    validationErrors.push("Please provide a valid email address");
  }

  if (!password) {
    validationErrors.push("Password is required");
  } else if (password.length < 6) {
    validationErrors.push("Password must be at least 6 characters long");
  } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    validationErrors.push(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    );
  }

  if (!phone || phone.trim().length < 10) {
    validationErrors.push("Please provide a valid phone number");
  }

  // Removed address validation

  // Return validation errors if any
  if (validationErrors.length > 0) {
    console.log("❌ Validation failed:", validationErrors);
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: validationErrors,
    });
  }

  try {
    // --- NEW: reCAPTCHA Server-Side Verification ---
    if (!recaptcha) {
      console.log("❌ reCAPTCHA token missing");
      return res.status(400).json({
        success: false,
        message: "reCAPTCHA verification is required.",
      });
    }

    const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY || '6Lcso4ErAAAAAEyS8iu8noRFyrQqwPknY4tTAR8j';
    if (!recaptchaSecret) {
      console.error("❌ RECAPTCHA_SECRET_KEY is not set in the environment variables.");
      // This is a server configuration issue, so we shouldn't expose details to the client.
      return res.status(500).json({
        success: false,
        message: "Server error during registration. Please try again later.",
      });
    }
    
    const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${recaptchaSecret}&response=${recaptcha}&remoteip=${req.ip}`;
    
    const { data: recaptchaResult } = await axios.post(verificationUrl);

    if (!recaptchaResult.success) {
      console.log("❌ reCAPTCHA verification failed:", recaptchaResult['error-codes']);
      return res.status(400).json({
        success: false,
        message: "Failed to verify reCAPTCHA. Please try again.",
      });
    }
    
    console.log("✅ reCAPTCHA verified successfully.");
    // --- END: reCAPTCHA Verification ---

    // Check for existing user (case insensitive)
    console.log("🔍 Checking for existing user with email:", email);
    const existingUser = await User.findOne({
      email: { $regex: new RegExp(`^${email.trim()}$`, "i") },
    });

    if (existingUser) {
      console.log("❌ User already exists with email:", email);
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists. Please use a different email or try logging in.",
      });
    }

    console.log("✅ Email is available");
    console.log("🔐 Hashing password...");

    // Hash password with proper salt rounds
    const saltRounds = 12; // Increased for better security
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    console.log("✅ Password hashed successfully");

    // Prepare user data (removed address)
    const userData = {
      name: name.trim(),
      email: email.trim().toLowerCase(), // Normalize email
      phone: phone.trim(),
      password: hashedPassword,
      role: role || "user",
    };

    console.log("💾 Creating new user...");
    const newUser = new User(userData);
    const savedUser = await newUser.save();

    console.log("✅ User created successfully:", {
      id: savedUser._id,
      email: savedUser.email,
      role: savedUser.role,
    });

    // Create cart for the user
    console.log("🛒 Creating cart for user...");
    const newCart = new Cart({
      user: savedUser._id,
      items: [],
    });
    const savedCart = await newCart.save();

    // Link cart to user
    savedUser.cart = savedCart._id;
    await savedUser.save();

    console.log("✅ Cart created and linked to user");
    console.log("=== REGISTRATION SUCCESSFUL ===");

    // Return success response (don't include password)
    const userResponse = {
      id: savedUser._id,
      name: savedUser.name,
      email: savedUser.email,
      phone: savedUser.phone,
      role: savedUser.role,
      cart: savedCart._id,
    };

    res.status(201).json({
      success: true,
      message: "Account created successfully! You can now log in.",
      UserData: {
        user: userResponse,
        cart: savedCart,
      },
    });
  } catch (error) {
    console.log("=== REGISTRATION ERROR ===");
    console.error("Registration error:", error);

    // Handle specific MongoDB errors
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      const message =
        field === "email"
          ? "An account with this email already exists"
          : `This ${field} is already in use`;

      return res.status(409).json({
        success: false,
        message,
      });
    }

    if (error.name === "ValidationError") {
      // Mongoose validation error
      const validationErrors = Object.values(error.errors).map(
        (e) => e.message
      );
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    // Generic server error
    res.status(500).json({
      success: false,
      message: "Server error during registration. Please try again.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Update logged-in user's address
app.put("/api/user/address", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found." });

    const info = req.body;
    user.address = {
      fullName: info.fullName,
      addressLine1: info.addressLine1,
      addressLine2: info.addressLine2,
      provinceCode: info.province,
      provinceName: info.provinceName,
      cityCode: info.city,
      cityName: info.cityName,
      brgyCode: info.brgy,
      brgyName: info.brgyName,
      postalCode: info.postalCode,
    };
    if (info.phone) user.phone = info.phone;

    await user.save();
    res.json({
      success: true,
      message: "Address updated",
      address: user.address,
    });
  } catch (err) {
    console.error("Error updating address:", err.message);
    res.status(500).json({ error: "Server error while updating address." });
  }
});
// read all users (active by default, or filter by status)
app.get("/api/allusers", async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const showOnlyInactive = req.query.showOnlyInactive === "true";

    let filter = {};
    if (showOnlyInactive) {
      filter = { status: 0 };
    } else if (!includeInactive) {
      filter = { status: 1 };
    }

    console.log(
      `[GET /api/allusers] includeInactive=${includeInactive}, showOnlyInactive=${showOnlyInactive}`
    );
    const users = await User.find(filter);
    res.json({ success: true, UserData: users });
  } catch (err) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error fetching users",
        error: err.message,
      });
  }
});
// login ng user with encryption
app.post("/api/login", async (req, res) => {
  console.log("=== LOGIN REQUEST RECEIVED ===");
  console.log("Request body:", req.body);
  console.log("Headers:", req.headers);

  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    console.log("❌ Missing email or password");
    return res.status(400).json({
      success: false,
      message: "Please fill in all fields",
    });
  }

  try {
    console.log("🔍 Searching for user with email:", email);

    // Find user by email (case insensitive)
    const user = await User.findOne({
      email: { $regex: new RegExp(`^${email}$`, "i") },
    });

    if (!user) {
      console.log("❌ User not found with email:", email);
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    console.log("✅ User found:", {
      id: user._id,
      email: user.email,
      role: user.role,
      hasPassword: !!user.password,
    });

    // Check if password exists
    if (!user.password) {
      console.log("❌ User has no password set");
      return res.status(401).json({
        success: false,
        message: "Account setup incomplete. Please contact support.",
      });
    }

    console.log("🔐 Comparing passwords...");
    console.log("Provided password length:", password.length);
    console.log("Stored hash exists:", !!user.password);

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    console.log("Password match result:", isMatch);

    if (!isMatch) {
      console.log("❌ Password does not match");
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    console.log("✅ Password matches, generating token...");

    // Check JWT_SECRET
    if (!process.env.JWT_SECRET) {
      console.log("❌ JWT_SECRET not configured");
      return res.status(500).json({
        success: false,
        message: "Server configuration error",
      });
    }

    // Issue JWT
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    console.log("✅ Token generated successfully");
    console.log("=== LOGIN SUCCESSFUL ===");

    // Log the user login
    await LoggerService.logUser(
      "user_login",
      user,
      user,
      {
        loginTime: new Date(),
        ipAddress: req.ip || req.connection?.remoteAddress,
      },
      req
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      userId: user._id,
      role: user.role,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.log("=== LOGIN ERROR ===");
    console.error("Login error:", error);
    console.error("Error stack:", error.stack);

    res.status(500).json({
      success: false,
      message: "Server error during login",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});
// read one user
app.get("/api/singleusers/:id", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate({
      path: "cart",
      populate: { path: "items.item" },
    });

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    res.json({ success: true, UserData: user });
  } catch (err) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error fetching user",
        error: err.message,
      });
  }
});
// =update a user
app.put("/api/updateusers/:id", async (req, res) => {
  try {
    const updates = req.body;
    const updatedUser = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    });

    if (!updatedUser)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    res.json({ success: true, message: "User updated", UserData: updatedUser });
  } catch (err) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error updating user",
        error: err.message,
      });
  }
});
// delete user saka cart
app.delete(
  "/api/deleteusers/:id",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      console.log(`🗑️  [Soft-Delete] Disabling User ${req.params.id}`);
      const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        { status: 0 },
        { new: true }
      );

      if (!updatedUser)
        return res
          .status(404)
          .json({ success: false, message: "User not found" });

      // Optionally remove / archive their cart as well
      await Cart.findByIdAndDelete(updatedUser.cart);

      res.json({
        success: true,
        message: "User disabled and cart removed",
        UserData: updatedUser,
      });
    } catch (err) {
      console.error("Error disabling user:", err.message);
      res
        .status(500)
        .json({
          success: false,
          message: "Error disabling user",
          error: err.message,
        });
    }
  }
);

//ITEMS API----------------------------------------------------------------

// create item
app.post(
  "/api/items",
  authenticateToken,
  authorizeRoles("admin"),
  upload.array("images", 2),
  async (req, res) => {
    // The middleware upload.array('images', 2) expects up to 2 files in a field named 'images'
    try {
      if (!req.files || req.files.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "At least one image is required." });
      }

      // Upload each file to Cloudinary and collect the URLs
      const uploadPromises = req.files.map(
        (file) =>
          new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              { folder: "products" },
              (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
              }
            );
            uploadStream.end(file.buffer);
          })
      );

      const imageUrls = await Promise.all(uploadPromises);

      let bodyData = { ...req.body };
      // Parse boolean is_customizable
      if (typeof bodyData.is_customizable !== "undefined") {
        bodyData.is_customizable =
          bodyData.is_customizable === "true" ||
          bodyData.is_customizable === true;
      }

      if (bodyData.customization_options) {
        if (typeof bodyData.customization_options === "string") {
          try {
            bodyData.customization_options = JSON.parse(
              bodyData.customization_options
            );
          } catch (e) { }
        }
      }

      // Ensure numeric conversions and default cost if missing
      if (bodyData.price) bodyData.price = Number(bodyData.price);
      if (bodyData.stock) bodyData.stock = Number(bodyData.stock);
      if (bodyData.length) bodyData.length = Number(bodyData.length);
      if (bodyData.height) bodyData.height = Number(bodyData.height);
      if (bodyData.width) bodyData.width = Number(bodyData.width);

      if (
        typeof bodyData.cost === "undefined" &&
        typeof bodyData.price !== "undefined"
      ) {
        bodyData.cost = bodyData.price; // default cost same as base price if not supplied
      }

      // Create new item with array of image URLs
      const newItem = new Item({ ...bodyData, imageUrl: imageUrls });
      await newItem.save();

      // Generate embedding for the new item (non-blocking best-effort)
      try {
        const textToEmbed = generateSearchableText(newItem);
        if (!extractor) {
          console.warn("Embedding model not loaded yet; skipping embedding for new item", newItem._id);
        } else if (textToEmbed && textToEmbed.length > 0) {
          const output = await extractor(textToEmbed, { pooling: "mean", normalize: true });
          const embedding = Array.from(output.data);
          await Item.findByIdAndUpdate(newItem._id, { $set: { embedding } });
        }
      } catch (embedErr) {
        console.error("Failed to generate embedding for new item:", embedErr?.message || embedErr);
      }

      // Log the item creation
      await LoggerService.logItem(
        "item_created",
        newItem,
        req.user,
        {
          itemName: newItem.name,
          price: newItem.price,
          stock: newItem.stock,
          isCustomizable: newItem.is_customizable,
        },
        req
      );

      res.status(201).json({ success: true, ItemData: newItem });
    } catch (err) {
      console.error("Error creating item:", err);
      res
        .status(500)
        .json({ success: false, message: "Server error creating item." });
    }
  }
);
// read item all (active by default, or filter by status)
app.get("/api/items", async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const showOnlyInactive = req.query.showOnlyInactive === "true";

    let filter = {};
    if (showOnlyInactive) {
      filter = { status: 0 };
    } else if (!includeInactive) {
      filter = { status: 1 };
    }

    console.log(
      `[GET /api/items] includeInactive=${includeInactive}, showOnlyInactive=${showOnlyInactive} -> filter`,
      filter
    );

    const items = await Item.find(filter)
      .populate("category", "name status")
      .populate("furnituretype", "name status");
    res.json({ success: true, ItemData: items });
  } catch (err) {
    console.error("Error fetching items:", err.message);
    res
      .status(500)
      .json({ success: false, message: "Server error fetching items" });
  }
});
// read specific item
app.get("/api/items/:id", async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
      .populate("category", "name")
      .populate("furnituretype", "name");
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }
    res.json({ success: true, Itemdata: item });
  } catch (err) {
    console.error("Error fetching item:", err.message);
    res
      .status(500)
      .json({ success: false, message: "Server error fetching item" });
  }
});
// update a item
app.put(
  "/api/items/:id",
  authenticateToken,
  authorizeRoles("admin"),
  upload.array("images", 5),
  async (req, res) => {
    try {
      let updates = {
        name: req.body.name,
        description: req.body.description,
        price: req.body.price,
        category: req.body.category,
        furnituretype: req.body.furnituretype,
        length: req.body.length,
        height: req.body.height,
        width: req.body.width,
        stock: req.body.stock,
        is_bestseller: req.body.is_bestseller,
        isPackage: req.body.isPackage,
      };

      // Handle customization fields
      if (typeof req.body.is_customizable !== "undefined") {
        updates.is_customizable =
          req.body.is_customizable === "true" ||
          req.body.is_customizable === true;
      }

      if (req.body.customization_options) {
        let customOpts = req.body.customization_options;
        // If came as string from multipart, parse JSON
        if (typeof customOpts === "string") {
          try {
            customOpts = JSON.parse(customOpts);
          } catch (e) {
            /* ignore parse error */
          }
        }
        updates.customization_options = customOpts;
      }

      // If new images were uploaded, process them
      if (req.files && req.files.length > 0) {
        // Upload each file to Cloudinary and collect the URLs
        const uploadPromises = req.files.map(
          (file) =>
            new Promise((resolve, reject) => {
              const uploadStream = cloudinary.uploader.upload_stream(
                { folder: "products" },
                (error, result) => {
                  if (error) return reject(error);
                  resolve(result.secure_url);
                }
              );
              uploadStream.end(file.buffer);
            })
        );

        const imageUrls = await Promise.all(uploadPromises);
        updates.imageUrl = imageUrls;
      }
      // If no new images uploaded, keep existing imageUrl (don't update it)

      const updated = await Item.findByIdAndUpdate(req.params.id, updates, {
        new: true,
      });
      if (!updated) {
        return res
          .status(404)
          .json({ success: false, message: "Item not found" });
      }

      // --- NEW LOGIC: Re-generate embedding on update ---
      try {
        // We need to re-fetch to get populated fields for the text generation
        const itemForEmbedding = await Item.findById(updated._id)
          .populate('category', 'name')
          .populate('furnituretype', 'name');
        
        const textToEmbed = generateSearchableText(itemForEmbedding);
        
        if (!extractor) {
          console.warn(`Embedding model not ready, skipping embedding update for item ${updated._id}`);
        } else if (textToEmbed && textToEmbed.length > 0) {
          console.log(`[Embed Update] Regenerating embedding for '${updated.name}'...`);
          const output = await extractor(textToEmbed, { pooling: "mean", normalize: true });
          const embedding = Array.from(output.data);
          // Update the item with the new embedding without another findByIdAndUpdate
          updated.embedding = embedding;
          await updated.save();
          console.log(`[Embed Update] Successfully updated embedding for '${updated.name}'.`);
        }
      } catch (embedErr) {
        // Log the error but don't fail the entire request, as the main update succeeded
        console.error(`[Embed Update] Failed to update embedding for item ${updated._id}:`, embedErr?.message || embedErr);
      }
      // --- END NEW LOGIC ---

      // Log the item update
      await LoggerService.logItem(
        "item_updated",
        updated,
        req.user,
        {
          itemName: updated.name,
          updatedFields: Object.keys(updates).filter(
            (key) => updates[key] !== undefined
          ),
        },
        req
      );

      res.json({ success: true, ItemData: updated });
    } catch (err) {
      console.error("Error updating item:", err.message);
      res
        .status(500)
        .json({ success: false, message: "Server error updating item" });
    }
  }
);
// --- SOFT-DELETE ITEM (status → 0) ---
app.delete(
  "/api/items/:id",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      console.log(`🗑️  [Soft-Delete] Request to disable Item ${req.params.id}`);
      const updated = await Item.findByIdAndUpdate(
        req.params.id,
        { status: 0 },
        { new: true }
      );

      if (!updated) {
        console.log("⚠️  Item not found – nothing disabled");
        return res
          .status(404)
          .json({ success: false, message: "Item not found" });
      }

      console.log(`✅  Item ${updated._id} status set to 0 (inactive)`);

      // Log the item deletion
      await LoggerService.logItem(
        "item_deleted",
        updated,
        req.user,
        {
          itemName: updated.name,
          previousStatus: 1,
          newStatus: 0,
        },
        req
      );

      res.json({
        success: true,
        message: "Item disabled (soft-deleted)",
        ItemData: updated,
      });
    } catch (err) {
      console.error("❌  Error soft-deleting item:", err.message);
      res
        .status(500)
        .json({
          success: false,
          message: "Error disabling item",
          error: err.message,
        });
    }
  }
);

//ORDERS MANAGEMENT API--------------------------------------------------------

// Get all orders for the admin dashboard
app.get(
  "/api/orders",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const orders = await Order.find({})
        .sort({ createdAt: -1 }) // Show newest orders first
        .populate("user", "name email") // Populate user's name and email
        .populate(
          "items.item",
          "name price is_customizable customization_options"
        );
      res.json({ success: true, OrderData: orders });
    } catch (err) {
      console.error("Error fetching all orders:", err.message);
      res
        .status(500)
        .json({ success: false, message: "Server error fetching orders" });
    }
  }
);

// Update an order's status (e.g., to 'shipped', 'completed')
app.put(
  "/api/orders/:id/status",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res
          .status(400)
          .json({ success: false, message: "Status is required" });
      }

      const updatedOrder = await Order.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true }
      )
        .populate("user", "name email")
        .populate("items.item", "name price");

      if (!updatedOrder) {
        return res
          .status(404)
          .json({ success: false, message: "Order not found" });
      }

      // Log the status change
      await LoggerService.logOrder(
        "order_status_changed",
        updatedOrder,
        req.user,
        {
          previousStatus: updatedOrder.status,
          newStatus: status,
          customerName: updatedOrder.user?.name,
          customerEmail: updatedOrder.user?.email,
        },
        req
      );

      res.json({
        success: true,
        message: "Order status updated",
        OrderData: updatedOrder,
      });
    } catch (err) {
      console.error("Error updating order status:", err.message);
      res
        .status(500)
        .json({ success: false, message: "Server error updating status" });
    }
  }
);

//CART MANAGEMENT API--------------------------------------------------------

// Show all items in a user's cart (protected)
app.get("/api/cart/:userId/items", authenticateToken, async (req, res) => {
  // Only allow the user or an admin to access this cart
  if (
    req.user.role !== "admin" &&
    req.user._id.toString() !== req.params.userId
  ) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }
  try {
    const user = await User.findById(req.params.userId).populate({
      path: "cart",
      populate: {
        path: "items.item",
        model: "Item",
      },
    });

    if (!user || !user.cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    res.json({
      success: true,
      message: "Cart items retrieved successfully",
      items: user.cart.items,
    });
  } catch (err) {
    console.error("Error fetching cart:", err.message);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
});
// Adding item to Cart
app.post("/api/cart/:userId/add", authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const {
    itemId,
    quantity = 1,
    customH,
    customW,
    customL,
    legsFrameMaterial,
    tabletopMaterial,
  } = req.body;

  console.log(`[CART ADD] Request for User: ${userId}, Item: ${itemId}`);
  if (customH && customW && customL) {
    console.log(
      `[CART ADD] Custom Dimensions Received: H:${customH}, W:${customW}, L:${customL}`
    );
  } else {
    console.log(`[CART ADD] Standard item add request.`);
  }

  if (!itemId || quantity <= 0) {
    return res.status(400).json({
      success: false,
      message: "Item ID and positive quantity are required",
    });
  }

  try {
    // Find user and ensure they exist
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Find the item and check stock
    const item = await Item.findById(itemId);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    // Find user's cart
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      console.log(
        `[CART ADD] No cart found for User: ${userId}. Creating new cart.`
      );
      cart = new Cart({ user: userId, items: [] });
    }

    const isCustom = customH && customW && customL;

    // --- MODIFIED LOGIC ---
    if (isCustom) {
      // For custom items, ALWAYS add as a new line item. Do not stack.
      console.log(`[CART ADD] Adding new custom item to cart.`);
      cart.items.push({
        item: itemId,
        quantity,
        customH,
        customW,
        customL,
        legsFrameMaterial,
        tabletopMaterial,
        customPrice: req.body.customPrice,
        customizations: req.body.customizations || null,
      });
    } else {
      // For standard items, check if one already exists to stack quantity.
      const existingItemIndex = cart.items.findIndex(
        (i) =>
          i.item.toString() === itemId && !i.customH && !i.customW && !i.customL // Ensure it's a standard item
      );

      if (existingItemIndex !== -1) {
        // Update quantity of existing standard item
        const newQuantity = cart.items[existingItemIndex].quantity + quantity;
        if (newQuantity > item.stock) {
          return res
            .status(400)
            .json({
              success: false,
              message: `Max Stock Reached! (${item.stock})`,
            });
        }
        cart.items[existingItemIndex].quantity = newQuantity;
        console.log(
          `[CART ADD] Stacked quantity for standard item. New quantity: ${newQuantity}`
        );
      } else {
        // Add new standard item
        if (quantity > item.stock) {
          return res
            .status(400)
            .json({
              success: false,
              message: `Not enough stock! Available: ${item.stock}`,
            });
        }
        cart.items.push({ item: itemId, quantity });
        console.log(`[CART ADD] Added new standard item to cart.`);
      }
    }

    await cart.save();
    console.log(`[CART ADD] Cart saved successfully for User: ${userId}.`);
    await cart.populate("items.item");

    res.status(200).json({
      success: true,
      message: "Item added to cart",
      CartData: cart,
    });
  } catch (err) {
    console.error("[CART ADD] Error adding to cart:", err.message);
    res.status(500).json({
      success: false,
      message: "Server error adding item to cart",
      error: err.message,
    });
  }
});

// delete a item from cart
app.delete(
  "/api/cart/:userId/item/:itemId",
  authenticateToken,
  async (req, res) => {
    const { userId, itemId } = req.params;

    try {
      // Validate ObjectIds
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid user ID format" });
      }
      if (!mongoose.Types.ObjectId.isValid(itemId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid item ID format" });
      }

      // Check if user has permission to modify this cart
      if (req.user.role !== "admin" && req.user.id !== userId) {
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });
      }

      // Find user's cart
      const cart = await Cart.findOne({ user: userId });

      if (!cart) {
        return res
          .status(404)
          .json({ success: false, message: "Cart not found for user" });
      }

      // Filter out the item
      const initialLength = cart.items.length;
      cart.items = cart.items.filter((i) => i.item.toString() !== itemId);

      if (cart.items.length === initialLength) {
        return res
          .status(404)
          .json({ success: false, message: "Item not found in cart" });
      }

      // Save and return updated cart
      await cart.save();

      // Try to populate, but handle errors gracefully
      try {
        const populatedCart = await cart.populate("items.item");
        res.json({
          success: true,
          message: "Item removed from cart",
          CartData: populatedCart,
        });
      } catch (populateError) {
        console.error(
          "Error populating cart after deletion:",
          populateError.message
        );
        // Return without population if it fails
        res.json({
          success: true,
          message: "Item removed from cart",
          CartData: cart,
        });
      }
    } catch (err) {
      console.error("Error deleting item from cart:", err.message);
      console.error("Full error:", err);
      res.status(500).json({
        success: false,
        message: "Server error deleting item from cart",
        error: err.message,
        details: process.env.NODE_ENV === "development" ? err.stack : undefined,
      });
    }
  }
);
// Increase or decrease item quantity in cart
app.put(
  "/api/cart/:userId/item/:itemId/increase",
  authenticateToken,
  async (req, res) => {
    const { userId, itemId } = req.params;

    try {
      const cart = await Cart.findOne({ user: userId });

      if (!cart) {
        return res
          .status(404)
          .json({ success: false, message: "Cart not found" });
      }

      const cartItem = cart.items.find((i) => i.item.toString() === itemId);

      if (!cartItem) {
        return res
          .status(404)
          .json({ success: false, message: "Item not in cart" });
      }

      cartItem.quantity += 1;

      await cart.save();
      const populated = await cart.populate("items.item");

      res.json({
        success: true,
        message: "Item quantity increased",
        CartData: populated,
      });
    } catch (err) {
      console.error("Error increasing quantity:", err.message);
      res
        .status(500)
        .json({ success: false, message: "Server error", error: err.message });
    }
  }
);
// Decrease item quantity in cart
app.put(
  "/api/cart/:userId/item/:itemId/decrease",
  authenticateToken,
  async (req, res) => {
    const { userId, itemId } = req.params;

    try {
      const cart = await Cart.findOne({ user: userId });

      if (!cart) {
        return res
          .status(404)
          .json({ success: false, message: "Cart not found" });
      }

      const cartItem = cart.items.find((i) => i.item.toString() === itemId);

      if (!cartItem) {
        return res
          .status(404)
          .json({ success: false, message: "Item not in cart" });
      }

      cartItem.quantity -= 1;

      // Remove item if quantity is now 0 or less
      if (cartItem.quantity <= 0) {
        cart.items = cart.items.filter((i) => i.item.toString() !== itemId);
      }

      await cart.save();
      const populated = await cart.populate("items.item");

      res.json({
        success: true,
        message: "Item quantity decreased",
        CartData: populated,
      });
    } catch (err) {
      console.error("Error decreasing quantity:", err.message);
      res
        .status(500)
        .json({ success: false, message: "Server error", error: err.message });
    }
  }
);

//STOCK MANAGEMENT API---------------------------------------------------

//decrease stock and increase sales of items
app.post("/api/items/decrease-stock", async (req, res) => {
  try {
    const { items } = req.body; // [{ itemId, quantity }]
    if (!Array.isArray(items)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid items array" });
    }
    for (const entry of items) {
      await Item.findByIdAndUpdate(entry.itemId, {
        $inc: { 
          stock: -Math.abs(entry.quantity),
          sales: Math.abs(entry.quantity) // Increase sales count
        },
      });
    }
    res.json({ success: true });
  } catch (err) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error decreasing stock",
        error: err.message,
      });
  }
});

// Fetch cart by ID
app.get("/api/cart/:id", authenticateToken, async (req, res) => {
  try {
    const cart = await Cart.findById(req.params.id).populate("items.item");
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }
    res.json(cart);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//================================================================
// CATEGORY & FURNITURE TYPE API
//================================================================

// --------- Category Endpoints ---------

// Get all categories (active by default)
app.get("/api/categories", async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const showOnlyInactive = req.query.showOnlyInactive === "true";

    let filter = {};
    if (showOnlyInactive) {
      filter = { status: 0 };
    } else if (!includeInactive) {
      filter = { status: 1 };
    }

    console.log(
      `[GET /api/categories] includeInactive=${includeInactive}, showOnlyInactive=${showOnlyInactive}, filter:`,
      filter
    );
    const categories = await Category.find(filter).sort("name");
    console.log(
      `[GET /api/categories] Found ${categories.length} categories with status filter:`,
      filter
    );
    res.json({ success: true, CategoryData: categories });
  } catch (err) {
    console.error("Error fetching categories:", err.message);
    res
      .status(500)
      .json({ success: false, message: "Server error fetching categories" });
  }
});

// Create category (admin only)
app.post(
  "/api/categories",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { name } = req.body;
      if (!name)
        return res
          .status(400)
          .json({ success: false, message: "Name is required" });

      // Ensure uniqueness
      const exists = await Category.findOne({ name });
      if (exists)
        return res
          .status(409)
          .json({ success: false, message: "Category already exists" });

      const newCategory = new Category({ name });
      await newCategory.save();
      res.status(201).json({ success: true, CategoryData: newCategory });
    } catch (err) {
      console.error("Error creating category:", err.message);
      res
        .status(500)
        .json({ success: false, message: "Server error creating category" });
    }
  }
);

// Update category (admin only)
app.put(
  "/api/categories/:id",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { name } = req.body;
      const updated = await Category.findByIdAndUpdate(
        req.params.id,
        { name },
        { new: true }
      );
      if (!updated)
        return res
          .status(404)
          .json({ success: false, message: "Category not found" });
      res.json({ success: true, CategoryData: updated });
    } catch (err) {
      console.error("Error updating category:", err.message);
      res
        .status(500)
        .json({ success: false, message: "Server error updating category" });
    }
  }
);

// Delete category (admin only) with safety check
app.delete(
  "/api/categories/:id",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      console.log(`🗑️  [Soft-Delete] Disabling Category ${req.params.id}`);
      const updated = await Category.findByIdAndUpdate(
        req.params.id,
        { status: 0 },
        { new: true }
      );
      if (!updated) {
        console.log("⚠️  Category not found – nothing disabled");
        return res
          .status(404)
          .json({ success: false, message: "Category not found" });
      }
      res.json({
        success: true,
        message: "Category disabled",
        CategoryData: updated,
      });
    } catch (err) {
      console.error("Error disabling category:", err.message);
      res
        .status(500)
        .json({ success: false, message: "Server error disabling category" });
    }
  }
);

// --------- Furniture Type Endpoints ---------

// Get all furniture types (active by default)
app.get("/api/furnituretypes", async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const showOnlyInactive = req.query.showOnlyInactive === "true";

    let filter = {};
    if (showOnlyInactive) {
      filter = { status: 0 };
    } else if (!includeInactive) {
      filter = { status: 1 };
    }

    console.log(
      `[GET /api/furnituretypes] includeInactive=${includeInactive}, showOnlyInactive=${showOnlyInactive}, filter:`,
      filter
    );
    const types = await FurnitureType.find(filter).sort("name");
    console.log(
      `[GET /api/furnituretypes] Found ${types.length} furniture types with status filter:`,
      filter
    );
    res.json({ success: true, FurnitureTypeData: types });
  } catch (err) {
    console.error("Error fetching furniture types:", err.message);
    res
      .status(500)
      .json({
        success: false,
        message: "Server error fetching furniture types",
      });
  }
});

// Create furniture type (admin only)
app.post(
  "/api/furnituretypes",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { name } = req.body;
      if (!name)
        return res
          .status(400)
          .json({ success: false, message: "Name is required" });
      const exists = await FurnitureType.findOne({ name });
      if (exists)
        return res
          .status(409)
          .json({ success: false, message: "Furniture type already exists" });
      const newType = new FurnitureType({ name });
      await newType.save();
      res.status(201).json({ success: true, FurnitureTypeData: newType });
    } catch (err) {
      console.error("Error creating furniture type:", err.message);
      res
        .status(500)
        .json({
          success: false,
          message: "Server error creating furniture type",
        });
    }
  }
);

// Update furniture type
app.put(
  "/api/furnituretypes/:id",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { name } = req.body;
      const updated = await FurnitureType.findByIdAndUpdate(
        req.params.id,
        { name },
        { new: true }
      );
      if (!updated)
        return res
          .status(404)
          .json({ success: false, message: "Furniture type not found" });
      res.json({ success: true, FurnitureTypeData: updated });
    } catch (err) {
      console.error("Error updating furniture type:", err.message);
      res
        .status(500)
        .json({
          success: false,
          message: "Server error updating furniture type",
        });
    }
  }
);

// Delete furniture type with safety
app.delete(
  "/api/furnituretypes/:id",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      console.log(`🗑️  [Soft-Delete] Disabling FurnitureType ${req.params.id}`);
      const updated = await FurnitureType.findByIdAndUpdate(
        req.params.id,
        { status: 0 },
        { new: true }
      );
      if (!updated) {
        console.log("⚠️  Furniture type not found – nothing disabled");
        return res
          .status(404)
          .json({ success: false, message: "Furniture type not found" });
      }
      res.json({
        success: true,
        message: "Furniture type disabled",
        FurnitureTypeData: updated,
      });
    } catch (err) {
      console.error("Error disabling furniture type:", err.message);
      res
        .status(500)
        .json({
          success: false,
          message: "Server error disabling furniture type",
        });
    }
  }
);

//================================================================
// END CATEGORY & FURNITURE TYPE API
//================================================================

// ======================= PSGC GEOLOCATION PROXY ENDPOINTS =======================
app.get("/api/psgc/provinces", async (req, res) => {
  try {
    const { data } = await axios.get("https://psgc.gitlab.io/api/provinces/");
    // Optionally filter Metro Manila (NCR) and Rizal if query param provided
    const { filter } = req.query; // e.g., ?filter=metro
    let provinces = data;
    if (filter === "metro-rizal") {
      provinces = data.filter((p) =>
        ["Metro Manila", "Rizal"].includes(p.name)
      );
    }
    // Inject synthetic entry for Metro Manila / NCR if not present
    const hasNCR = provinces.some((p) => p.code === "NCR");
    if (!hasNCR) {
      provinces.unshift({ code: "NCR", name: "Metro Manila" });
    }
    res.json(provinces);
  } catch (err) {
    console.error("PSGC provinces fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch provinces" });
  }
});

app.get("/api/psgc/provinces/:provinceCode/cities", async (req, res) => {
  try {
    const { provinceCode } = req.params;
    const { data } = await axios.get(
      `https://psgc.gitlab.io/api/provinces/${provinceCode}/cities-municipalities/`
    );
    res.json(data);
  } catch (err) {
    console.error("PSGC cities fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch cities" });
  }
});

app.get("/api/psgc/cities/:cityCode/barangays", async (req, res) => {
  try {
    const { cityCode } = req.params;
    const { data } = await axios.get(
      `https://psgc.gitlab.io/api/cities-municipalities/${cityCode}/barangays/`
    );
    res.json(data);
  } catch (err) {
    console.error("PSGC barangays fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch barangays" });
  }
});

app.get("/api/psgc/regions/:regionCode/cities", async (req, res) => {
  try {
    const { regionCode } = req.params;
    const { data } = await axios.get(
      `https://psgc.gitlab.io/api/regions/${regionCode}/cities-municipalities/`
    );
    res.json(data);
  } catch (err) {
    console.error("PSGC region cities fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch region cities" });
  }
});
// ======================= END PSGC GEOLOCATION PROXY ENDPOINTS =======================

// ---- Custom Price Calculation Endpoint ----
app.post("/api/items/:id/calculate-price", async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item || !item.is_customizable) {
      return res.status(404).json({ message: "Customizable item not found." });
    }

    const {
      length,
      width,
      height,
      laborDays,
      materialName3x3,
      materialName2x12,
    } = req.body;
    if (
      !length ||
      !width ||
      !height ||
      !laborDays ||
      !materialName3x3 ||
      !materialName2x12
    ) {
      return res
        .status(400)
        .json({
          message: "Missing required dimension or material information.",
        });
    }

    const mat3 = item.customization_options?.materials?.find(
      (m) => m.name === materialName3x3
    );
    const mat2 = item.customization_options?.materials?.find(
      (m) => m.name === materialName2x12
    );

    if (!mat3 || !mat2) {
      return res
        .status(400)
        .json({
          message: "Selected materials are not available for this item.",
        });
    }

    const costs = {
      labor_cost_per_day: item.customization_options.labor_cost_per_day,
      plank_3x3_cost: mat3.plank_3x3x10_cost,
      plank_2x12_cost: mat2.plank_2x12x10_cost,
      profit_margin: item.customization_options.profit_margin,
      overhead_cost: item.customization_options.overhead_cost,
    };

    const priceDetails = calculateCustomPrice(
      { length, width, height },
      laborDays,
      costs
    );
    res.json(priceDetails);
  } catch (error) {
    console.error("Price calculation error:", error);
    res.status(500).json({ message: "Server error during price calculation." });
  }
});
// ---- End Custom Price Endpoint ----

// ===================== ACTIVATION ENDPOINTS =====================

// Reactivate item
app.put(
  "/api/items/:id/activate",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      console.log(`🔄  [Activate] Re-enabling Item ${req.params.id}`);
      const updated = await Item.findByIdAndUpdate(
        req.params.id,
        { status: 1 },
        { new: true }
      );
      if (!updated)
        return res
          .status(404)
          .json({ success: false, message: "Item not found" });
      res.json({ success: true, message: "Item activated", ItemData: updated });
    } catch (err) {
      console.error("Error activating item:", err.message);
      res
        .status(500)
        .json({ success: false, message: "Server error activating item" });
    }
  }
);

// Reactivate category
app.put(
  "/api/categories/:id/activate",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      console.log(`🔄  [Activate] Re-enabling Category ${req.params.id}`);
      const updated = await Category.findByIdAndUpdate(
        req.params.id,
        { status: 1 },
        { new: true }
      );
      if (!updated)
        return res
          .status(404)
          .json({ success: false, message: "Category not found" });
      res.json({
        success: true,
        message: "Category activated",
        CategoryData: updated,
      });
    } catch (err) {
      console.error("Error activating category:", err.message);
      res
        .status(500)
        .json({ success: false, message: "Server error activating category" });
    }
  }
);

// Reactivate furniture type
app.put(
  "/api/furnituretypes/:id/activate",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      console.log(`🔄  [Activate] Re-enabling FurnitureType ${req.params.id}`);
      const updated = await FurnitureType.findByIdAndUpdate(
        req.params.id,
        { status: 1 },
        { new: true }
      );
      if (!updated)
        return res
          .status(404)
          .json({ success: false, message: "Furniture type not found" });
      res.json({
        success: true,
        message: "Furniture type activated",
        FurnitureTypeData: updated,
      });
    } catch (err) {
      console.error("Error activating furniture type:", err.message);
      res
        .status(500)
        .json({
          success: false,
          message: "Server error activating furniture type",
        });
    }
  }
);

// Reactivate user
app.put(
  "/api/users/:id/activate",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      console.log(`🔄  [Activate] Re-enabling User ${req.params.id}`);
      const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        { status: 1 },
        { new: true }
      );
      if (!updatedUser)
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      res.json({
        success: true,
        message: "User activated",
        UserData: updatedUser,
      });
    } catch (err) {
      console.error("Error activating user:", err.message);
      res
        .status(500)
        .json({ success: false, message: "Server error activating user" });
    }
  }
);
// =================== END ACTIVATION ENDPOINTS ===================

// ===================== LOG ENDPOINTS =====================

// Get logs with filters (admin only)
app.get(
  "/api/logs",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const {
        startDate,
        endDate,
        action,
        entityType,
        userId,
        page = 1,
        limit = 50,
      } = req.query;

      const skip = (page - 1) * limit;

      const { logs, total } = await LoggerService.getLogs(
        {
          startDate,
          endDate,
          action,
          entityType,
          userId,
        },
        {
          limit: parseInt(limit),
          skip: parseInt(skip),
        }
      );

      res.json({
        success: true,
        logs,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / limit),
      });
    } catch (err) {
      console.error("Error fetching logs:", err.message);
      res
        .status(500)
        .json({ success: false, message: "Server error fetching logs" });
    }
  }
);

// Get log statistics (admin only)
app.get(
  "/api/logs/stats",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { timeRange = "24h" } = req.query;
      const stats = await LoggerService.getLogStats(timeRange);
      res.json({ success: true, ...stats });
    } catch (err) {
      console.error("Error fetching log stats:", err.message);
      res
        .status(500)
        .json({ success: false, message: "Server error fetching log stats" });
    }
  }
);

// =================== END LOG ENDPOINTS ===================

// TEMPORARY TEST ENDPOINT - Remove after testing
app.get("/api/test/make-utility-inactive", async (req, res) => {
  try {
    const utility = await Category.findOneAndUpdate(
      { name: "Utility" },
      { status: 0 },
      { new: true }
    );

    if (utility) {
      console.log("Updated Utility category to inactive:", utility);
      res.json({
        success: true,
        message: "Utility category is now inactive",
        category: utility,
      });
    } else {
      res.json({
        success: false,
        message: "Utility category not found",
      });
    }
  } catch (err) {
    console.error("Error updating utility category:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});
// Add review to an item
app.post("/api/items/:id/reviews", authenticateToken, async (req, res) => {
  try {
    const { description, star } = req.body;
    const itemId = req.params.id;
    const userId = req.user.id;

    // Validate input
    if (!description || !star) {
      return res.status(400).json({
        success: false,
        message: "Description and star rating are required"
      });
    }

    if (star < 1 || star > 5) {
      return res.status(400).json({
        success: false,
        message: "Star rating must be between 1 and 5"
      });
    }

    // Check if item exists
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    // Check if user has already reviewed this item
    const existingReview = item.reviews.find(review => 
      review.userId && review.userId.toString() === userId
    );

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this item"
      });
    }

    // Add the review with user information
    const newReview = {
      description,
      star,
      userId: userId,
      userName: req.user.name,
      createdAt: new Date()
    };

    item.reviews.push(newReview);
    await item.save();

    // Log the review action
    await Log.create({
      action: 'review_added',
      entityType: 'item',
      entityId: itemId,
      userId: userId,
      userName: req.user.name,
      userRole: req.user.role,
      details: {
        itemName: item.name,
        rating: star,
        reviewLength: description.length
      }
    });

    res.json({
      success: true,
      message: "Review added successfully",
      review: newReview
    });

  } catch (error) {
    console.error("Error adding review:", error);
    res.status(500).json({
      success: false,
      message: "Server error while adding review"
    });
  }
});

// Get reviews for an item
app.get("/api/items/:id/reviews", async (req, res) => {
  try {
    const itemId = req.params.id;

    const item = await Item.findById(itemId).select('reviews');
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    res.json({
      success: true,
      reviews: item.reviews || []
    });

  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching reviews"
    });
  }
});

// Update review (only by the user who created it)
app.put("/api/items/:id/reviews/:reviewId", authenticateToken, async (req, res) => {
  try {
    const { description, star } = req.body;
    const itemId = req.params.id;
    const reviewId = req.params.reviewId;
    const userId = req.user.id;

    // Validate input
    if (!description || !star) {
      return res.status(400).json({
        success: false,
        message: "Description and star rating are required"
      });
    }

    if (star < 1 || star > 5) {
      return res.status(400).json({
        success: false,
        message: "Star rating must be between 1 and 5"
      });
    }

    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    // Find the review
    const reviewIndex = item.reviews.findIndex(review => 
      review._id.toString() === reviewId
    );

    if (reviewIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Review not found"
      });
    }

    const review = item.reviews[reviewIndex];

    // Check if user owns this review
    if (review.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own reviews"
      });
    }

    // Update the review
    item.reviews[reviewIndex] = {
      ...review.toObject(),
      description,
      star,
      updatedAt: new Date()
    };

    await item.save();

    res.json({
      success: true,
      message: "Review updated successfully",
      review: item.reviews[reviewIndex]
    });

  } catch (error) {
    console.error("Error updating review:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating review"
    });
  }
});

// Delete review (only by the user who created it or admin)
app.delete("/api/items/:id/reviews/:reviewId", authenticateToken, async (req, res) => {
  try {
    const itemId = req.params.id;
    const reviewId = req.params.reviewId;
    const userId = req.user.id;
    const userRole = req.user.role;

    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    // Find the review
    const reviewIndex = item.reviews.findIndex(review => 
      review._id.toString() === reviewId
    );

    if (reviewIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Review not found"
      });
    }

    const review = item.reviews[reviewIndex];

    // Check if user owns this review or is admin
    if (review.userId.toString() !== userId && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own reviews"
      });
    }

    // Remove the review
    item.reviews.splice(reviewIndex, 1);
    await item.save();

    res.json({
      success: true,
      message: "Review deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting review:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting review"
    });
  }
});


// Debug endpoint to check database items
app.get("/api/debug/items", async (req, res) => {
  try {
    const items = await Item.find({ status: 1, stock: { $gt: 0 } })
      .populate("category", "name")
      .populate("furnituretype", "name")
      .select("name furnituretype category stock is_bestseller")
      .limit(10);
    
    res.json({
      success: true,
      items: items.map(item => ({
        name: item.name,
        furnitureType: item.furnituretype?.name || 'No type',
        category: item.category?.name || 'No category',
        stock: item.stock,
        isBestseller: item.is_bestseller
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Enhanced debug endpoint to see all available items for AI recommendations
app.get("/api/debug/inventory-catalog", async (req, res) => {
  try {
    const allItems = await Item.find({ 
      status: 1, 
      stock: { $gt: 0 } 
    })
    .populate('category', 'name')
    .populate('furnituretype', 'name')
    .select('name description price category furnituretype is_bestseller is_customizable stock sales')
    .lean();

    const inventoryCatalog = allItems.map(item => ({
      name: item.name,
      description: item.description || '',
      price: item.price,
      category: item.category?.name || 'Unknown',
      furnitureType: item.furnituretype?.name || 'Unknown',
      isBestseller: item.is_bestseller,
      isCustomizable: item.is_customizable,
      stock: item.stock,
      sales: item.sales
    }));

    res.json({
      success: true,
      totalItems: inventoryCatalog.length,
      inventoryCatalog: inventoryCatalog
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// listen to server
server.listen(process.env.PORT || 5001, () => {
  //3
  console.log(`Server is running on port ${process.env.PORT || 5001}`);
});
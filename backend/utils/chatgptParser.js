import OpenAI from "openai";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize the OpenAI client
// It's best practice to use environment variables for your API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY, 
});


export async function parseQueryWithOpenAI(userInput) {
    // Fetch all available items from the database for context
    const Item = (await import('../models/item.model.js')).default;
    const Category = (await import('../models/category.model.js')).default;
    const FurnitureType = (await import('../models/furnitureType.model.js')).default;

    const allItems = await Item.find({ 
        status: 1, 
        stock: { $gt: 0 } 
    })
    .populate('category', 'name')
    .populate('furnituretype', 'name')
    .select('name description price category furnituretype is_bestseller is_customizable stock sales rating reviews')
    .lean();

    // Create a comprehensive inventory catalog for the AI
    const inventoryCatalog = allItems.map(item => {
        // Calculate review metrics
        const reviewCount = Array.isArray(item.reviews) ? item.reviews.length : 0;
        const averageRating = item.rating || 4.0;
        const reviewScore = reviewCount > 0 ? (averageRating * Math.log10(reviewCount + 1)) : averageRating;
        
        // Extract review insights (get recent positive reviews)
        let reviewInsights = "";
        if (Array.isArray(item.reviews) && item.reviews.length > 0) {
            const positiveReviews = item.reviews
                .filter(review => (review.star || review.rating) >= 4)
                .slice(0, 3); // Get up to 3 recent positive reviews
            
            const reviewHighlights = positiveReviews.map(review => {
                const reviewText = review.description || review.comment || review.review || "";
                return reviewText.substring(0, 100); // First 100 characters
            }).filter(text => text.length > 10); // Only meaningful reviews
            
            if (reviewHighlights.length > 0) {
                reviewInsights = reviewHighlights.join(" | ");
            }
        }
        
        return {
            _id: item._id.toString(),
            name: item.name,
            description: item.description,
            price: item.price,
            category: Array.isArray(item.category) && item.category.length > 0 ? item.category[0].name : 'Unknown',
            furnitureType: item.furnituretype?.name || 'Unknown',
            isBestseller: item.is_bestseller,
            isCustomizable: item.is_customizable,
            isPackage: item.isPackage, // <-- Added for package support
            stock: item.stock,
            sales: item.sales,
            rating: averageRating,
            reviewCount: reviewCount,
            reviewScore: reviewScore, // Combined rating and review count score
            reviewInsights: reviewInsights // Actual review content highlights
        };
    });

    // This detailed system prompt guides the model to understand user intent deeply.
    const systemPrompt = `
        You are an intelligent furniture shopping assistant for "Wawa Furniture," a Filipino e-commerce store. Your job is to understand what customers REALLY need based on their context, lifestyle, and furniture relationships. 
        Think like a knowledgeable salesperson who understands furniture pairing, room design, and customer intent.
        you are also critical thinker and known for your intelligence and understanding every little details.

        An important rules is that you should be able to recommend ALL of the items that exactly or might fit the customer's query.
        for example, 
        
        i need a pair for my CHAIR, i also need kitchen furnitures and bedframe for my 20 x20sqm 
        condo im looking for more wooden easthetics

        ##I AM EXPECTING YOU TO SHOW AND THINK LIKE THIS:
        - tables that fit the query for the query "i need a pair for my CHAIR" it also must be wooden because the customer is looking for more wooden easthetics and also consider the size of the condo because of the  query"for my 20 x20sqm 
        condo"
        {
            itemName: 'Acacia Wood Ladder Bookshelf',
            reason: 'A stylish, airy wooden shelving unit for extra storage or display, fitting the wooden aesthetic and maximizing vertical space in a condo.'
          }
        (other tables that fit the query.....)


        - kitchen furnitures that fit the query for the query "i also need kitchen furnitures" it also must be wooden because the customer is looking for more wooden easthetics and conssidering the size of the condo
          {
            itemName: 'Acacia Kitchen Island Table',
            reason: 'Provides extra counter space and storage with a beautiful wooden finish.'
          },    
          
          (other kitchen furnitures that fit the query.....)
        
          - bedframes that fit the query for the query "and bedframes" it also must be wooden but you can also show other bedframes that has different materials because of your reasons it maybe because ofthe size you may show some other alternatives
          {
            itemName: 'Acacia Wood Bedframe',
            reason: 'A sturdy, stylish wooden bedframe that complements the wooden theme and provides ample storage space.'
          },
          
          (other bedframes that fit the query.....)
         
          atleast 3 pairs of items that fit the query

        ### AVAILABLE INVENTORY CATALOG:
        Here are ALL the items currently available in stock, and their attributes please analyze:
        ${JSON.stringify(inventoryCatalog, null, 2)}

        ### Your Core Understanding:
        
        **Furniture Relationships & Pairing Logic:**
        - Office table → needs office chairs, desk lamps, file cabinets
        - Dining table → needs dining chairs, buffet/sideboard
        - Coffee table → needs sofas, armchairs, side tables
        - Bed → needs bedside tables, wardrobes, dressers
        - Sofa → needs coffee tables, side tables, TV stands
        - Study desk → needs office chairs, bookshelves, desk organizers

        **Context Understanding:**
        - "pair for my table" = chairs (office/dining based on context)
        - "complete my living room" = missing furniture pieces for living room
        - "match my bedroom" = complementary bedroom furniture
        - "goes with my sofa" = coffee tables, side tables, cushions
        - "storage for my room" = wardrobes, cabinets, shelves
        - "comfortable seating" = chairs, sofas, armchairs

        **Lifestyle & Space Understanding:**
        - Small space = compact, multi-functional furniture
        - Family home = durable, kid-friendly options
        - Office space = professional, ergonomic furniture
        - Modern home = contemporary, minimalist designs
        - Traditional home = classic, wooden furniture

        ### Output JSON Schema:
        Respond with ONLY this JSON structure. Include ONLY the fields that are relevant to the query:
        \`\`\`json
        {
          "semanticQuery": "what the customer actually needs (inferred from context) - for complex queries with multiple needs, combine all search terms",
          "customerIntent": "brief explanation of what you understood",
          "recommendationType": "pairing|completion|replacement|upgrade|multi_category",
          "targetRoom": "living room|bedroom|office|dining room|kitchen|bathroom|multiple",
          "limit": number,
          "sortBy": "price|sales|createdAt",
          "sortOrder": "asc|desc", 
          "filters": {
            "maxPrice": number,
            "minPrice": number,
            "maxLength": number,
            "maxWidth": number, 
            "maxHeight": number,
            "materials": ["material1", "material2"],
            "styles": ["style1", "style2"],
            "is_bestseller": boolean,
            "is_customizable": boolean,
            "isPackage": boolean
          },
          "explanationTemplate": "A friendly, conversational explanation template that will be used to explain why each recommended item is perfect for the customer's needs. Use placeholders like {itemName}, {category}, {features}, {benefits}. Example: 'This {itemName} is perfect for your {targetRoom} because {benefits}!'",
          "specificRecommendations": [
            {
              "itemId": "EXACT ID FROM INVENTORY CATALOG",
              "itemName": "EXACT NAME FROM INVENTORY CATALOG",
              "reason": "Why this specific item is the best choice - include review quality AND specific review insights (e.g., 'highly rated by customers', 'based on reviews, customers love its comfort and durability', 'reviewers say it's perfect for small spaces').",
              "developerReasoning": "Detailed explanation for why this item should be shown: prioritize items with high reviewScore, use reviewInsights to mention what customers actually said, consider rating, reviewCount, price, sales performance, stock availability, customer fit, and competitive advantages. Always reference actual review content when available."
            }
          ]
        }
        \`\`\`

        ### Smart Examples:

        **Input:** "looking for a pair for my newly bought office table"
        **Output:**
        \`\`\`json
        {
          "semanticQuery": "office chairs",
          "customerIntent": "Customer needs chairs to pair with their new office table",
          "recommendationType": "pairing",
          "targetRoom": "office",
          "limit": 5,
          "specificRecommendations": [
            {
              "itemId": "EXACT ID FROM INVENTORY CATALOG",
              "itemName": "EXACT NAME FROM INVENTORY CATALOG",
              "reason": "Perfect ergonomic chair to match the executive desk",
              "developerReasoning": "This chair is a bestseller and has excellent ergonomic features, making it perfect for long work hours."
            },
            {
              "itemId": "EXACT ID FROM INVENTORY CATALOG",
              "itemName": "EXACT NAME FROM INVENTORY CATALOG",
              "reason": "Comfortable seating for long work hours",
              "developerReasoning": "This chair is comfortable and has a modern design, making it a great choice for office environments."
            },
            {
              "itemId": "EXACT ID FROM INVENTORY CATALOG",
              "itemName": "EXACT NAME FROM INVENTORY CATALOG",
              "reason": "Breathable and modern office seating",
              "developerReasoning": "This chair is made of breathable materials and has a sleek design, perfect for modern office settings."
            }
          ]
        }
        \`\`\`
        
        **Input:** "show me 3 bestseller dining chairs under 25000"
        **Output:**
        \`\`\`json
        {
          "semanticQuery": "dining chairs",
          "customerIntent": "Customer wants popular dining chairs within budget",
          "recommendationType": "replacement",
          "targetRoom": "dining room",
          "limit": 3,
          "filters": {
            "is_bestseller": true,
            "maxPrice": 25000
          },
          "specificRecommendations": [
            {
              "itemId": "EXACT ID FROM INVENTORY CATALOG",
              "itemName": "EXACT NAME FROM INVENTORY CATALOG",
              "reason": "Popular bestseller within budget",
              "developerReasoning": "This chair is a popular bestseller and offers excellent value for money."
            }
          ]
        }
        \`\`\`

        **Input:** "complete my living room setup"
        **Output:**
        \`\`\`json
        {
          "semanticQuery": "sofa coffee table side tables TV stand lighting",
          "customerIntent": "Customer wants to complete their living room with essential furniture pieces",
          "recommendationType": "completion",
          "targetRoom": "living room",
          "limit": 6,
          "specificRecommendations": [
            {
              "itemId": "EXACT ID FROM INVENTORY CATALOG",
              "itemName": "EXACT NAME FROM INVENTORY CATALOG",
              "reason": "Perfect centerpiece for the living room",
              "developerReasoning": "This coffee table is a popular choice for living rooms and provides a great focal point."
            },
            {
              "itemId": "EXACT ID FROM INVENTORY CATALOG",
              "itemName": "EXACT NAME FROM INVENTORY CATALOG",
              "reason": "Essential for entertainment setup",
              "developerReasoning": "This TV stand is a must-have for any living room entertainment setup."
            },
            {
              "itemId": "EXACT ID FROM INVENTORY CATALOG",
              "itemName": "EXACT NAME FROM INVENTORY CATALOG",
              "reason": "Perfect accent piece for your living room",
              "developerReasoning": "This side table is a stylish and functional piece that can be used for various purposes."
            }
          ]
        }
        \`\`\`

        **Input:** "i need a pair for my CHAIR, i also need kitchen furnitures and bedframe for my 20 x20sqm condo im looking for more wooden easthetics"
        **Output:**
        \`\`\`json
        {
          "semanticQuery": "wooden tables side tables kitchen furniture kitchen island dining table bedframe bed wooden furniture condo small space",
          "customerIntent": "Customer needs multiple furniture types for a small condo: tables to pair with chair, kitchen furniture, and bedframe, all with wooden aesthetic",
          "recommendationType": "multi_category",
          "targetRoom": "multiple",
          "limit": 12,
          "filters": {
            "materials": ["wood", "mahogany", "acacia", "narra", "gemelina"]
          },
          "specificRecommendations": [
            {
              "itemId": "EXACT ID FROM INVENTORY CATALOG",
              "itemName": "EXACT NAME FROM INVENTORY CATALOG",
              "reason": "Perfect wooden side table to pair with your chair, compact for condo living",
              "developerReasoning": "This side table is a compact and stylish option that fits well in a condo and pairs nicely with the chair."
            },
            {
              "itemId": "EXACT ID FROM INVENTORY CATALOG",
              "itemName": "EXACT NAME FROM INVENTORY CATALOG",
              "reason": "Beautiful wooden kitchen island providing extra counter space and storage",
              "developerReasoning": "This kitchen island is a beautiful and functional piece that provides ample counter space and storage."
            },
            {
              "itemId": "EXACT ID FROM INVENTORY CATALOG",
              "itemName": "EXACT NAME FROM INVENTORY CATALOG",
              "reason": "Classic wooden bedside table with storage, perfect for small condo bedrooms",
              "developerReasoning": "This bedside table is a classic and practical option that provides convenient storage in a small condo bedroom."
            }
          ]
        }
        \`\`\`

        ### Important Rules:
        1. **ONLY RECOMMEND AVAILABLE ITEMS** - Only suggest items that exist in the inventory catalog above
        2. **USE EXACT ITEM NAMES** - Reference the exact names from the inventory
        3. **CHECK STOCK AVAILABILITY** - Only recommend items with stock > 0
        4. **PRIORITIZE HIGHLY REVIEWED ITEMS** - Always favor items with higher ratings and more reviews:
           - Items with rating ≥ 4.5 and reviewCount ≥ 10 are PREMIUM choices
           - Items with rating ≥ 4.0 and reviewCount ≥ 5 are GOOD choices
           - Items with high reviewScore (rating × log10(reviews + 1)) are BEST overall
           - **USE ACTUAL REVIEW CONTENT** when available - reference what customers specifically said (e.g., "based on reviews, customers love its durability", "reviewers mention it's perfect for small spaces", "reviewers say it has good quality materials" )
           - Mention review quality and specific insights from reviewInsights field
        5. **Infer the REAL need** - don't just parse words literally.
        6. **Understand furniture relationships** - what naturally goes together.
        7. **Consider Filipino context** - space constraints, budget consciousness.
        8. **Price context**: "cheap/mura" = under 15000, "affordable" = under 25000, "premium/mahal" = over 50000.
        9. **Size context**: "small space" = compact furniture, "family size" = larger furniture.
        10. **MULTI-PART QUERIES**: When customer asks for multiple things (e.g., "tables AND kitchen furniture AND bedframe"), combine ALL search terms in semanticQuery to get diverse results
        11. **Smart limit control**: Set appropriate limit based on query intent:
            - "pairing" queries: choose how many items are appropriate (chairs, lamps, etc.)
            - "completion" queries: choose how many items are appropriate (room setup)
            - "multi_category" queries: higher limit (8-15) to cover all requested categories
            - "replacement" queries: choose how many items are appropriate (variety)
            - "upgrade" queries: choose how many items are appropriate (premium options)
            - Specific numbers mentioned: use that number
           

        ### Your Mission:
        Understand the customer like a helpful furniture expert would. What do they REALLY need to solve their furniture problem or complete their space? Use the inventory catalog to provide specific, actionable recommendations.
        refer to the items list above to provide specific, actionable recommendations and reccomend all of the items that fits the customer's query.
        you are working with Xenova ai so make sure to use the correct format and structure for the output that you send to xenova for it to understand properly,
        make sure that the words you are sending to xenova is based on the inventory catalog (very important).
        the more data you put in and the more specific you are, the better the output will be.
        refer to the inventory catalog, understand, and think for 5 times put 5 why questions for your output and if you are now very sure, then provide the output.
    `;

    try {
        console.log("=== FULL AI SYSTEM PROMPT ===");
        console.log(systemPrompt);
        console.log("=== END OF AI SYSTEM PROMPT ===");
        console.log("Sending query to OpenAI...");
        const response = await openai.chat.completions.create({
            model: "gpt-4o", // Or "gpt-3.5-turbo" for a faster, more cost-effective option
            response_format: { type: "json_object" }, // Enable JSON Mode
            messages: [
                { "role": "system", "content": systemPrompt },
                { "role": "user", "content": `Customer Query: "${userInput}"` }
            ],
            temperature: 0.3, // Lower temperature for more deterministic, predictable output
        });

        console.log("OpenAI response received.");
        const jsonResult = JSON.parse(response.choices[0].message.content);
        return jsonResult;

    } catch (error) {
        console.error("OpenAI parsing error:", error);
        // Fallback strategy in case of an API error
        return { semanticQuery: userInput, filters: {}, limit: 12 };
    }
}

export async function generateComplementaryRecommendationsWithOpenAI(cartItems) {
    // Build a clear description of the cart contents for the AI
    const cartDescription = cartItems.map(item => {
        const category = item.category?.name || 'Unknown';
        const furnitureType = item.furnituretype?.name || 'Unknown';
        return `${item.name} (${category} - ${furnitureType})`;
    }).join(', ');

    // Fetch all available items from the database
    const Item = (await import('../models/item.model.js')).default;
    const Category = (await import('../models/category.model.js')).default;
    const FurnitureType = (await import('../models/furnitureType.model.js')).default;

    const allItems = await Item.find({ 
        status: 1, 
        stock: { $gt: 0 } 
    })
    .populate('category', 'name')
    .populate('furnituretype', 'name')
    .select('name description price category furnituretype is_bestseller is_customizable stock sales rating reviews')
    .lean();

    // Create a comprehensive inventory catalog for the AI
    const inventoryCatalog = allItems.map(item => {
        // Calculate review metrics
        const reviewCount = Array.isArray(item.reviews) ? item.reviews.length : 0;
        const averageRating = item.rating || 4.0;
        const reviewScore = reviewCount > 0 ? (averageRating * Math.log10(reviewCount + 1)) : averageRating;
        
        // Extract review insights (get recent positive reviews)
        let reviewInsights = "";
        if (Array.isArray(item.reviews) && item.reviews.length > 0) {
            const positiveReviews = item.reviews
                .filter(review => (review.star || review.rating) >= 4)
                .slice(0, 3); // Get up to 3 recent positive reviews
            
            const reviewHighlights = positiveReviews.map(review => {
                const reviewText = review.description || review.comment || review.review || "";
                return reviewText.substring(0, 100); // First 100 characters
            }).filter(text => text.length > 10); // Only meaningful reviews
            
            if (reviewHighlights.length > 0) {
                reviewInsights = reviewHighlights.join(" | ");
            }
        }
        
        return {
            name: item.name,
            description: item.description || '',
            price: item.price,
            category: Array.isArray(item.category) && item.category.length > 0 ? item.category[0].name : 'Unknown',
            furnitureType: item.furnituretype?.name || 'Unknown',
            isBestseller: item.is_bestseller,
            isCustomizable: item.is_customizable,
            isPackage: item.isPackage, // <-- Added for package support
            stock: item.stock,
            sales: item.sales,
            rating: averageRating,
            reviewCount: reviewCount,
            reviewScore: reviewScore, // Combined rating and review count score
            reviewInsights: reviewInsights // Actual review content highlights
        };
    });

    const systemPrompt = `
        You are a direct and logical furniture recommendation engine for "Wawa Furniture". Your single purpose is to analyze a customer's shopping cart MAKING SURE EVERYTHING IN THE CART IS ACCOUNTED THIS (IS IMPORTANT!) FOR and suggest the next single most logical item to complete their setup. You must follow a strict hierarchical logic.
        
        ### AVAILABLE INVENTORY CATALOG:
        Here are ALL the items currently available in stock:
        ${JSON.stringify(inventoryCatalog, null, 2)}
        
        ### Input Format:
        You will receive the cart's contents in this format:
        - item: [Item Name], type: [Furniture Type], category: [Category Name]
        - item: [Item Name], type: [Furniture Type], category: [Category Name]
        
        ### Core Recommendation Logic (Follow this order STRICTLY):
        
        1.  **Check for a Set (e.g., Table + Chairs).**
            * **IF** the cart contains both a primary table (dining table, office desk) AND matching chairs (dining chairs, office chair)...
            * **THEN** your #1 priority is to recommend **storage**.
                * For a dining set, recommend a "buffet", "sideboard", or "cabinet".
                * For an office set, recommend a "file cabinet", "bookshelf", or "storage shelf".
            * **Reasoning:** The user is furnishing a room. After the main set, storage is the next essential piece.
        
        2.  **Check for a Primary Item (e.g., Table, Bed, Sofa).**
            * **IF** the cart contains a primary item BUT NOT its direct companion...
            * **THEN** recommend the missing companion.
                * Cart has a **table/desk** -> Recommend matching **chairs**.
                * Cart has a **sofa/couch** -> Recommend a **coffee table** or **side table**.
                * Cart has a **bed** -> Recommend **bedside tables** or a **dresser**.
            * **Reasoning:** The user has the main piece; they now need the most essential item that pairs with it.
        
        3.  **Check for a Secondary Item (e.g., Chairs).**
            * **IF** the cart contains ONLY secondary items like chairs, lamps, or side tables...
            * **THEN** recommend the primary item they pair with.
                * Cart has **chairs** -> Recommend a matching **table/desk**.
                * Cart has a **side table** -> Recommend a **sofa** or **armchair**.
                * Cart has a **bookshelf** -> Recommend a **desk** or **lounge chair**.
            * **Reasoning:** The user has an accessory; they need the main furniture to build around.
        
        ### CRITICAL RULES FOR SPECIFIC RECOMMENDATIONS:
        1. **ONLY USE EXACT ITEM NAMES** from the inventory catalog above
        2. **MATCH THE ITEM NAME EXACTLY** - case sensitive
        3. **VERIFY THE ITEM EXISTS** in the catalog before recommending
        4. **PRIORITIZE HIGHLY REVIEWED ITEMS** - Always favor items with higher ratings and more reviews:
           - Items with rating ≥ 4.5 and reviewCount ≥ 10 are TOP choices
           - Items with rating ≥ 4.0 and reviewCount ≥ 5 are GOOD choices
           - Items with high reviewScore (rating × log10(reviews + 1)) are BEST overall
           - **USE ACTUAL REVIEW CONTENT** when available - reference what customers specifically said (e.g., "based on reviews, customers love its sturdy build", "reviewers mention it fits perfectly in small spaces")
           - Mention review quality and specific insights from reviewInsights field
        5. **PREFER BESTSELLERS** when multiple options exist
        6. **ALWAYS PROVIDE EXACTLY 3 SPECIFIC RECOMMENDATIONS** - no more, no less
        ##### **IMPORTANT:** Look at the inventory catalog and use ONLY the exact names listed there!
        
        ### Output JSON Schema:
        You MUST respond with ONLY this JSON structure. Do NOT add any extra commentary.
        
        \`\`\`json
        {
          "complementaryQuery": "search terms for the single most logical item type",
          "reasoning": "A direct, one-sentence explanation based on the logic above.",
          "detectedRoom": "The primary room you've identified (e.g., 'office', 'dining room').",
          "priorityItems": ["the single best item type", "a secondary option", "a third option"],
          "filters": {
            "exclude": ["list", "of item types", "already in cart"]
          },
          "specificRecommendations": [
            {
              "itemId": "EXACT ID FROM INVENTORY CATALOG",
              "itemName": "EXACT NAME FROM INVENTORY CATALOG",
              "reason": "Why this specific item is the best choice.",
              "developerReasoning": "Detailed explanation for why this item should be shown: consider price, sales performance, stock availability, customer fit, and competitive advantages."
            }
          ]
        }
        \`\`\`
        
        ### Smart Examples:
        
        **Example 1: User buys a chair first.**
        * **Cart Contains:** "item: Ergonomic Office Chair, type: Office Chair, category: Seating"
        * **Your Logic:** Rule #3 applies. The user has a secondary item (chair). Recommend the primary item (desk).
        * **Output:**
         \`\`\`json
         {
           "complementaryQuery": "office desk computer table study desk",
           "reasoning": "A great office chair needs a functional desk to create a complete workspace.",
           "detectedRoom": "office",
           "priorityItems": ["office desk", "computer table", "bookshelf"],
           "filters": {
             "exclude": ["chair", "seating"]
           },
           "specificRecommendations": [
             {
               "itemId": "EXACT ID FROM INVENTORY CATALOG",
               "itemName": "EXACT NAME FROM INVENTORY CATALOG",
               "reason": "Perfect ergonomic chair to match the executive desk",
               "developerReasoning": "This chair is a bestseller and has excellent ergonomic features, making it perfect for long work hours."
             },
             {
               "itemId": "EXACT ID FROM INVENTORY CATALOG",
               "itemName": "EXACT NAME FROM INVENTORY CATALOG",
               "reason": "Comfortable seating for long work hours",
               "developerReasoning": "This chair is comfortable and has a modern design, making it a great choice for office environments."
             },
             {
               "itemId": "EXACT ID FROM INVENTORY CATALOG",
               "itemName": "EXACT NAME FROM INVENTORY CATALOG",
               "reason": "Breathable and modern office seating",
               "developerReasoning": "This chair is made of breathable materials and has a sleek design, perfect for modern office settings."
             }
           ]
         }
         \`\`\`
     
     **Example 2: User buys a table and chairs.**
        * **Cart Contains:** "item: Mahogany Dining Table, type: Dining Table, category: Tables", "item: Classic Dining Chair, type: Dining Chair, category: Seating"
        * **Your Logic:** Rule #1 applies. The user has a set. Recommend storage.
        * **Output:**
         \`\`\`json
         {
           "complementaryQuery": "buffet sideboard dining cabinet storage",
           "reasoning": "You've got the dining set. Now, complete the room with essential storage for your dinnerware.",
           "detectedRoom": "dining room",
           "priorityItems": ["buffet", "sideboard", "cabinet"],
           "filters": {
             "exclude": ["table", "chair", "seating"]
           },
           "specificRecommendations": [
             {
               "itemId": "EXACT ID FROM INVENTORY CATALOG",
               "itemName": "EXACT NAME FROM INVENTORY CATALOG",
               "reason": "Perfect ergonomic chair to match the executive desk",
               "developerReasoning": "This chair is a bestseller and has excellent ergonomic features, making it perfect for long work hours."
             },
             {
               "itemId": "EXACT ID FROM INVENTORY CATALOG",
               "itemName": "EXACT NAME FROM INVENTORY CATALOG",
               "reason": "Comfortable seating for long work hours",
               "developerReasoning": "This chair is comfortable and has a modern design, making it a great choice for office environments."
             },
             {
               "itemId": "EXACT ID FROM INVENTORY CATALOG",
               "itemName": "EXACT NAME FROM INVENTORY CATALOG",
               "reason": "Breathable and modern office seating",
               "developerReasoning": "This chair is made of breathable materials and has a sleek design, perfect for modern office settings."
             }
           ]
         }
         \`\`\`
     
     **Customer's Current Cart:** "${cartDescription}"
     `;

    try {
        console.log("[OPENAI-COMPLEMENT]: Analyzing cart for recommendations...");
        const response = await openai.chat.completions.create({
            model: "gpt-4o", // Using GPT-O1 mini for faster, cost-effective processing
            response_format: { type: "json_object" },
            messages: [
                { "role": "system", "content": systemPrompt },
                { "role": "user", "content": `Analyze this cart and recommend complementary products: "${cartDescription}"` }
            ],
            temperature: 0.1,
        });

        console.log("[OPENAI-COMPLEMENT]: Successfully received recommendations.");
        const jsonResult = JSON.parse(response.choices[0].message.content);
        return jsonResult;

    } catch (error) {
        console.error("[OPENAI-COMPLEMENT]: Error generating recommendations:", error);
        // A sensible fallback if the API fails
        return {
            complementaryQuery: "furniture accessories home decor",
            reasoning: "Find great accessories to complement your new furniture.",
            detectedRoom: "general",
            priorityItems: ["lighting", "storage", "decor"],
            filters: {}
        };
    }
}

export async function generateItemExplanations(items, originalQuery, parsedCommand) {
    if (!items || items.length === 0) {
        return items;
    }

    const systemPrompt = `
        You are a friendly Filipino furniture expert explaining why specific items are perfect for a customer's needs. 
        Your explanations should be conversational, helpful, and highlight the specific benefits for their situation.

        ### Your Style:
        - Warm and friendly, like a knowledgeable salesperson
        - Focus on practical benefits and how it solves their problem
        - Mention specific features that match their needs
        - **Always highlight review quality AND specific review insights** when available (e.g., "highly rated by customers", "based on reviews, customers love its comfort", "reviewers say it's perfect for small apartments")
        - Reference actual review content when available to build trust (only if the item has reviews)
        - Keep explanations concise but informative (1-2 sentences)
        - Use Filipino-friendly language when appropriate

        ### Context from Customer Query:
        Original Query: "${originalQuery}"
        Customer Intent: "${parsedCommand.customerIntent || 'Looking for furniture'}"
        Target Room: "${parsedCommand.targetRoom || 'general'}"
        Recommendation Type: "${parsedCommand.recommendationType || 'general'}"

        ### Your Task:
        For each item, explain why it's perfect for this customer's specific needs. Use the explanation template if provided, or create a natural explanation.

        ### Output Format:
        Return ONLY a JSON array of explanations, one for each item:
        \`\`\`json
        [
          {
            "itemId": "item_id_here",
            "explanation": "Your personalized explanation here"
          }
        ]
        \`\`\`

        ### Example Explanations:
        - "This office chair is perfect for your new desk because it's ergonomic and will keep you comfortable during long work hours!"
        - "This coffee table matches your living room setup beautifully and provides the perfect spot for drinks and decor."
        - "This bedside table completes your bedroom with convenient storage and a place for your essentials."
        - "This office chair is perfect for your new desk because it's ergonomic and will keep you comfortable during long work hours - based on reviews, customers love its excellent back support!"
        - "This coffee table matches your living room setup beautifully and provides the perfect spot for drinks and decor. Reviewers say it's the perfect size for small spaces!"
        - "This bedside table completes your bedroom with convenient storage and a place for your essentials. Highly rated by customers who mention its sturdy build and ample storage!"
    `;

    try {
        // Prepare items data for the AI
        const itemsData = items.map(item => {
            // Extract review insights for this item
            const reviewCount = Array.isArray(item.reviews) ? item.reviews.length : 0;
            let reviewInsights = "";
            
            if (Array.isArray(item.reviews) && item.reviews.length > 0) {
                const positiveReviews = item.reviews
                    .filter(review => (review.star || review.rating) >= 4)
                    .slice(0, 3);
                
                const reviewHighlights = positiveReviews.map(review => {
                    const reviewText = review.description || review.comment || review.review || "";
                    return reviewText.substring(0, 100);
                }).filter(text => text.length > 10);
                
                if (reviewHighlights.length > 0) {
                    reviewInsights = reviewHighlights.join(" | ");
                }
            }
            
            return {
                id: item._id,
                name: item.name,
                category: item.category?.name || 'Unknown',
                furnitureType: item.furnituretype?.name || 'Unknown',
                price: item.price,
                description: item.description,
                isBestseller: item.is_bestseller,
                isCustomizable: item.is_customizable,
                sales: item.sales,
                rating: item.rating || 4.0,
                reviewCount: reviewCount,
                reviewInsights: reviewInsights
            };
        });

        console.log("[AI-EXPLANATIONS]: Generating explanations for", items.length, "items");

        const response = await openai.chat.completions.create({
            model: "gpt-4.1", // Using mini for cost-effectiveness
            response_format: { type: "json_object" },
            messages: [
                { "role": "system", "content": systemPrompt },
                { 
                    "role": "user", 
                    "content": `Generate explanations for these items: ${JSON.stringify(itemsData)}` 
                }
            ],
            temperature: 0.7, // Slightly creative but consistent
        });

        const rawExplanations = JSON.parse(response.choices[0].message.content);
        
        // Ensure explanations is an array
        let explanations = [];
        if (Array.isArray(rawExplanations)) {
            explanations = rawExplanations;
        } else if (rawExplanations && Array.isArray(rawExplanations.explanations)) {
            explanations = rawExplanations.explanations;
        } else if (rawExplanations && typeof rawExplanations === 'object') {
            // If it's an object with itemId keys, convert to array
            explanations = Object.keys(rawExplanations).map(key => ({
                itemId: key,
                explanation: rawExplanations[key]
            }));
        }
        
        console.log("[AI-EXPLANATIONS]: Parsed explanations structure:", Array.isArray(explanations) ? `Array with ${explanations.length} items` : typeof explanations);
        
        // Map explanations back to items
        const itemsWithExplanations = items.map(item => {
            const explanation = Array.isArray(explanations) ? 
                explanations.find(exp => exp.itemId === item._id.toString()) : null;
            return {
                ...item,
                aiExplanation: explanation?.explanation || 
                    `This ${item.name} is a great choice for your ${parsedCommand.targetRoom || 'space'}!`
            };
        });

        console.log("[AI-EXPLANATIONS]: Successfully generated explanations");
        return itemsWithExplanations;

    } catch (error) {
        console.error("[AI-EXPLANATIONS]: Error generating explanations:", error);
        
        // Fallback: return items with basic explanations
        return items.map(item => ({
            ...item,
            aiExplanation: `This ${item.name} is perfect for your ${parsedCommand.targetRoom || 'space'}! It's a ${item.category?.name || 'great'} item that will enhance your home.`
        }));
    }
}

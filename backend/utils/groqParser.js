import OpenAI from "openai"; // Yes, we use the OpenAI library for this!

// Configure the client to point to Groq's servers
const groq = new OpenAI({
    apiKey: "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",
    baseURL: 'https://api.groq.com/openai/v1', 
});

/**
 * Uses Llama 3 via the Groq API to parse a raw user query.
 * @param {string} userInput The raw text from the user.
 * @returns {Promise<object>} A structured object for searching.
 */
export async function parseQueryWithGroq(userInput) {
    // The same professional prompt we designed works perfectly here.
    const systemPrompt =  `
        You are an intelligent furniture shopping assistant for "Wawa Furniture," a Filipino e-commerce store. Your job is to understand what customers REALLY need based on their context, lifestyle, and furniture relationships. Think like a knowledgeable salesperson who understands furniture pairing, room design, and customer intent.

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
          "semanticQuery": "what the customer actually needs (inferred from context)",
          "customerIntent": "brief explanation of what you understood",
          "recommendationType": "pairing|completion|replacement|upgrade",
          "targetRoom": "living room|bedroom|office|dining room|kitchen|bathroom",
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
          }
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
          "targetRoom": "office"
        }
        \`\`\`

        **Input:** "something to complete my modern living room setup"
        **Output:**
        \`\`\`json
        {
          "semanticQuery": "modern living room furniture coffee tables side tables TV stands",
          "customerIntent": "Customer wants to complete their modern living room with additional furniture pieces",
          "recommendationType": "completion", 
          "targetRoom": "living room",
          "filters": {
            "styles": ["modern"]
          }
        }
        \`\`\`

        **Input:** "cheap storage for small bedroom"
        **Output:**
        \`\`\`json
        {
          "semanticQuery": "compact wardrobes small cabinets bedroom storage",
          "customerIntent": "Customer needs affordable storage solutions for a small bedroom",
          "recommendationType": "replacement",
          "targetRoom": "bedroom",
          "filters": {
            "maxPrice": 15000
          }
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
          }
        }
        \`\`\`

        ### Important Rules:
        1. **Infer the REAL need** - don't just parse words literally
        2. **Understand furniture relationships** - what naturally goes together
        3. **Consider Filipino context** - space constraints, budget consciousness
        4. **Think about room completion** - what's missing to make a room functional
        5. **Price context**: "cheap/mura" = under 15000, "affordable" = under 25000, "premium/mahal" = over 50000
        6. **Size context**: "small space" = compact furniture, "family size" = larger furniture

        ### Your Mission:
        Understand the customer like a helpful furniture expert would. What do they REALLY need to solve their furniture problem or complete their space?

        **Customer Query:** "${userInput}"
    `;

    try {
        console.log("Sending query to Llama 3 on Groq...");
        const response = await groq.chat.completions.create({
            model: "llama3-8b-8192", // Use Llama 3 8B on Groq's fast servers
            response_format: { type: "json_object" }, // Use reliable JSON Mode
            messages: [
                { "role": "system", "content": systemPrompt },
                { "role": "user", "content": `Customer Query: "${userInput}"` }
            ],
            temperature: 0.1, // Keep the output focused and deterministic
        });

        console.log("Groq response received.");
        const jsonResult = JSON.parse(response.choices[0].message.content);
        return jsonResult;

    } catch (error) {
        console.error("Groq parsing error:", error);
        // Fallback strategy remains the same
        return { semanticQuery: userInput, filters: {}, limit: 12 };
    }
}


/**
 * Uses Llama 3 via Groq API to analyze cart items and suggest complementary products
 * @param {Array} cartItems Array of items currently in the user's cart
 * @returns {Promise<object>} Structured recommendation query for complementary products
 */
export async function generateComplementaryRecommendations(cartItems) {
  // Build a description of what's in the cart
  const cartDescription = cartItems.map(item => {
      const category = item.category?.name || 'Unknown';
      const furnitureType = item.furnituretype?.name || 'Unknown';
      return `${item.name} (${category} - ${furnitureType})`;
  }).join(', ');

  const systemPrompt = `
      You are an expert Filipino furniture consultant who understands how furniture pieces work together to create complete, functional spaces. Your job is to recommend complementary products that would PERFECTLY COMPLETE the customer's furniture setup.

      ### Your Expertise:
      
      **Furniture Pairing Rules:**
      - Sofa → needs coffee table, side tables, TV stand, cushions, lamps
      - Dining table → needs dining chairs, buffet/sideboard, dining lighting
      - Bed → needs bedside tables, wardrobe, dresser, bedside lamps
      - Office desk → needs office chair, desk lamp, file cabinet, bookshelf
      - Coffee table → pairs with sofas but customer might need side tables, TV stand
      - TV stand → customer likely needs seating (sofa, chairs) if they don't have it
      
      **Room Completion Logic:**
      - Living room: sofa + coffee table + side tables + TV stand + lighting + storage
      - Bedroom: bed + bedside tables + wardrobe + dresser + mirror + lighting
      - Dining room: dining table + chairs + buffet + lighting + storage
      - Office: desk + chair + storage + lighting + organization

      **Filipino Home Context:**
      - Space-efficient solutions for smaller homes
      - Multi-functional furniture preferences
      - Budget-conscious but quality-focused
      - Family-oriented furniture needs

      ### Your Task:
      Analyze the Customer's cart and show them complementary products that They might want to buy, for example if they buy a table, whast is the closest product that they might want to buy, for example a chair just focus on it and thats what i wan you to reccomend.

      ### Output JSON Schema:
      Respond with ONLY this JSON structure:
      \`\`\`json
      {
        "complementaryQuery": "search terms for what they need to complete their setup",
        "reasoning": "brief explanation of why these items complement their purchase",
        "detectedRoom": "primary room type being furnished",
        "completionLevel": "what percentage complete their room setup will be",
        "priorityItems": ["item1", "item2", "item3"],
        "filters": {
          "maxPrice": number,
          "targetRoom": "room name",
          
        }
      }
      \`\`\`

      ### Smart Examples:

      **Cart Contains:** "Executive Office Table (Office Furniture - Desk)"
      **Output:**
      \`\`\`json
      {
        "complementaryQuery": "office chair ergonomic desk chair executive chair",
        "reasoning": "Executive desk needs a matching office chair for complete workstation",
        "detectedRoom": "office",
        "completionLevel": "30% - needs seating, lighting, and storage",
        "priorityItems": ["office chair", "desk lamp", "file cabinet"],
        "filters": {
          "maxPrice": 25000,
          "targetRoom": "office",
          "exclude": ["desk", "table"]
        }
      }
      \`\`\`

      **Cart Contains:** "Modern L-Shape Sofa (Living Room - Sofa), TV Stand (Living Room - TV Stand)"
      **Output:**
      \`\`\`json
      {
        "complementaryQuery": "coffee table side table accent table living room tables",
        "reasoning": "Sofa and TV stand setup needs tables for drinks, remotes, and decor",
        "detectedRoom": "living room",
        "completionLevel": "70% - needs tables and lighting",
        "priorityItems": ["coffee table", "side table", "table lamp"],
        "filters": {
          "targetRoom": "living room",
          "exclude": ["sofa", "tv stand", "entertainment unit"]
        }
      }
      \`\`\`

      **Cart Contains:** "Queen Size Bed Frame (Bedroom - Bed)"
      **Output:**
      \`\`\`json
      {
        "complementaryQuery": "bedside table nightstand wardrobe dresser bedroom storage",
        "reasoning": "Bed needs bedside tables for functionality and wardrobe for clothing storage",
        "detectedRoom": "bedroom",
        "completionLevel": "25% - needs bedside tables, storage, and lighting",
        "priorityItems": ["bedside table", "wardrobe", "table lamp"],
        "filters": {
          "targetRoom": "bedroom",
          "exclude": ["bed", "bed frame", "mattress"]
        }
      }
      \`\`\`

      ### Critical Rules:
      1. **NO DUPLICATES** - Never recommend items similar to what they're buying
      2. **FUNCTIONAL COMPLETION** - Focus on what makes their space actually usable
      3. **LOGICAL PAIRING** - Only suggest items that naturally go together
      4. **FILIPINO CONTEXT** - Consider space constraints and multi-functionality
      5. **COMPLETION MINDSET** - Think "what do they need to make this room work?"

      **Customer's Current Cart:** "${cartDescription}"
  `;

  try {
      console.log("[GROQ-COMPLEMENT]: Analyzing cart for complementary recommendations...");
      const response = await groq.chat.completions.create({
          model: "llama3-8b-8192",
          response_format: { type: "json_object" },
          messages: [
              { "role": "system", "content": systemPrompt },
              { "role": "user", "content": `Analyze this cart and recommend complementary products: "${cartDescription}"` }
          ],
          temperature: 0.2, // Slightly more creative for varied recommendations
      });

      console.log("[GROQ-COMPLEMENT]: Successfully received complementary recommendations");
      const jsonResult = JSON.parse(response.choices[0].message.content);
      return jsonResult;

  } catch (error) {
      console.error("[GROQ-COMPLEMENT]: Error generating recommendations:", error);
      // Fallback strategy
      return {
          complementaryQuery: "furniture accessories home decor",
          reasoning: "General furniture accessories that complement most setups",
          detectedRoom: "general",
          completionLevel: "unknown",
          priorityItems: ["lighting", "storage", "decor"],
          filters: {}
      };
  }
}
const dotenv = require('dotenv');
const path = require('path');
const express = require('express');
const fs = require('fs');
const { OpenAI } = require('openai');
const cors = require('cors');
const crypto = require('crypto');

// Load env file with explicit path
const envPath = path.join(__dirname, '.env');
console.log('Loading .env file from:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('Error loading .env file:', result.error);
} else {
    console.log('Environment variables loaded:', {
        OPENAI_API_KEY_EXISTS: !!process.env.OPENAI_API_KEY,
        OPENAI_API_KEY_LENGTH: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0,
        OPENAI_API_KEY_START: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 8) : 'none'
    });
}

const app = express();

// Middleware - Needs to be before route definitions
app.use(express.json());
app.use(cors());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Replace server start code with version that handles port conflicts
const port = process.env.PORT || 3000;

// Create custom console logging for debugging
const debugLog = (message, ...args) => {
  console.log(`[${new Date().toISOString()}] [DEBUG] ${message}`, ...args);
};

const errorLog = (message, ...args) => {
  console.error(`[${new Date().toISOString()}] [ERROR] ${message}`, ...args);
};

// Validate OpenAI API key immediately
if (!process.env.OPENAI_API_KEY) {
  console.error('========= CRITICAL ERROR =========');
  console.error('OPENAI_API_KEY environment variable is missing');
  console.error('The chatbot requires a valid OpenAI API key to function');
  console.error('Make sure to add it to your .env file or environment variables');
  console.error('==================================');
}

// Initialize the OpenAI client with proper configuration
console.log('Setting up OpenAI client with API key...');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: 60000  // 60 second timeout (longer to ensure it completes)
});

// Inventory Management System with Persistence
const INVENTORY_FILE = path.join(__dirname, 'inventory.json');

// Initialize inventory from file or create new if doesn't exist
function initializeInventory() {
try {
    if (fs.existsSync(INVENTORY_FILE)) {
        const data = fs.readFileSync(INVENTORY_FILE, 'utf8');
        const inventory = JSON.parse(data);
      debugLog(`Loaded inventory from file: ${inventory.count} units`);
      return inventory;
    } else {
      // Default inventory if file doesn't exist
      const inventory = { count: 100, lastUpdated: new Date().toISOString() };
      saveInventoryToFile(inventory);
      debugLog(`Created new inventory file with default of ${inventory.count} units`);
      return inventory;
    }
} catch (error) {
    errorLog(`Error initializing inventory: ${error.message}`);
    // Return default inventory in case of error
    return { count: 100, lastUpdated: new Date().toISOString() };
  }
}

// Save inventory to file for persistence
function saveInventoryToFile(inventory) {
  try {
    fs.writeFileSync(INVENTORY_FILE, JSON.stringify(inventory, null, 2), 'utf8');
    debugLog(`Saved inventory to file: ${inventory.count} units`);
        return true;
    } catch (error) {
    errorLog(`Error saving inventory: ${error.message}`);
        return false;
    }
}

// Global inventory object
let eclipseTagInventory = initializeInventory();

// Store recent orders for context (limited to last 10)
let recentOrders = [];
const MAX_RECENT_ORDERS = 10;

// Function to add a new order to the recent orders list
function addRecentOrder(orderId, amount, quantity, date = new Date()) {
  recentOrders.unshift({
    id: orderId,
    amount: amount,
    quantity: quantity,
    date: date.toISOString()
  });
  
  // Keep only the most recent orders
  if (recentOrders.length > MAX_RECENT_ORDERS) {
    recentOrders.pop();
  }
  
  debugLog(`Added order ${orderId} to recent orders list. Currently tracking ${recentOrders.length} recent orders.`);
}

// Get current inventory count
function getInventoryCount() {
  return eclipseTagInventory.count;
}

// Update inventory with persistence
function updateInventory(action, amount) {
  let newCount;
  
  switch (action) {
    case 'set':
      newCount = amount;
      break;
    case 'add':
      newCount = eclipseTagInventory.count + amount;
      break;
    case 'subtract':
      newCount = Math.max(0, eclipseTagInventory.count - amount);
      break;
    default:
      throw new Error(`Invalid action: ${action}`);
  }
  
  // Update inventory object
  eclipseTagInventory = {
    count: newCount,
    lastUpdated: new Date().toISOString()
  };
  
  // Save to file for persistence
  saveInventoryToFile(eclipseTagInventory);
  
  debugLog(`Inventory updated [${action}]: ${newCount} units`);
  return newCount;
}

// ===============================================================
// ECLIPSE TAG PRODUCT INFORMATION - EDIT THIS SECTION
// ===============================================================
// This section contains all the information about Eclipse Tags that will be fed 
// into the AI's system prompt. Update this data to customize how the AI talks
// about your products.

const eclipseTagInfo = {
  // Basic product information
  basics: {
    name: "Eclipse Tag",
    tagline: "Be Safe, Be Seen, Be Eclipse",
    shortDescription: "Reflective safety tags that enhance visibility for pedestrians at night",
    yearFounded: 2023,
    companyDescription: "A student-led company focused on pedestrian safety and visibility",
    inventory: getInventoryCount() // Add inventory reference
  },
  
  // Product specifications
  specs: {
    materials: "High-quality reflective material visible up to 300 feet away",
    size: "Compact and lightweight (less than 10g)",
    durability: "Waterproof and weather-resistant design",
    attachment: "Easy clip-on mechanism that attaches to clothing, bags, or accessories",
    visibility: "360-degree visibility from any angle",
    warranty: "30-day satisfaction guarantee"
  },
  
  // Pricing and packages
  pricing: {
    basePrice: 6.99,
    currency: "CAD",
    bulkDiscounts: [
      { quantity: 3, discountPercentage: 10, description: "10% off for 3+ tags" },
      { quantity: 10, discountPercentage: 20, description: "20% off for 10+ tags" }
    ],
    promoCode: "WELCOME10",
    promoDescription: "First-time customers can use code WELCOME10 for 10% off their order"
  },
  
  // Available colors/styles
  colors: [
    { name: "Silver", description: "Maximum reflectivity, perfect for nighttime visibility" },
    { name: "Neon Yellow", description: "High-visibility with a bright, modern style" },
    { name: "Bright Orange", description: "Stands out in urban environments" },
    { name: "Cool Blue", description: "Stylish option while maintaining safety benefits" }
  ],
  
  // Benefits and use cases
  benefits: [
    "Enhanced safety for pedestrians, joggers, and cyclists at night",
    "Increased visibility for children walking to and from school",
    "Lightweight alternative to bulky reflective vests",
    "Fashionable safety option that doesn't compromise on style",
    "Attachable to clothing, backpacks, purses, or pet leashes",
    "Perfect for urban dwellers, commuters, and outdoor enthusiasts"
  ],
  
  // Frequently asked questions (with answers)
  faqs: [
    {
      question: "Do you offer free shipping?",
      answer: "Yes, shipping is free within a 45km radius of our business, and no sales tax is applied. Shipping fees only apply when domestic shopping and over 45km away."
      },
    {
      question: "Why Choose us?",
      answer: "We prioritize pedestrian safety while donating 10% of our profits to charity—all while offering competitive prices. Our unique, student-led product is designed for both impact and success."
    },
    {
      question: "What is your refund policy",
      answer: "If you're not completely satisfied with your purchase, you can return it within 30 days for a full refund. The item would have to very lightly used or brand-new for a possible refund."
    },
    {
      question: "Who are we?",
      answer: "We are a group of dedicated and passionate high school students who are trying to make a difference for those whose lives are taken every year in automotive accidents. We are a student led company under JA Ontario. Our team is creative, innovative, and hardworking striving to make a change."
    }
  ],
  
  // Contact and support info
  contact: {
    email: "eclipsetags.ja@gmail.com",
    website: "eclipseja.myshopify.com/",
    shippingTime: "3-5 business days",
    returnsPolicy: "30-day hassle-free returns"
  }
};

// ===============================================================
// END OF ECLIPSE TAG PRODUCT INFORMATION
// ===============================================================

// Generate the Eclipse Tag section for the system prompt
function generateEclipseProductPrompt() {
  // Add safety checks to handle possible undefined values
  const shortDescription = eclipseTagInfo.basics?.shortDescription || "Reflective safety tags for pedestrians";
  const price = eclipseTagInfo.pricing?.basePrice || "6.99";
  const currency = eclipseTagInfo.pricing?.currency || "CAD";
  
  // Handle bulk discount info
  let bulkDiscountText = "";
  if (eclipseTagInfo.pricing?.bulkDiscounts && Array.isArray(eclipseTagInfo.pricing.bulkDiscounts)) {
    const discountDescriptions = eclipseTagInfo.pricing.bulkDiscounts.map(d => d.description || "").filter(Boolean);
    if (discountDescriptions.length > 0) {
      bulkDiscountText = `with ${discountDescriptions.join(" and ")}`;
    }
  }
  
  // Handle colors info
  let colorsText = "";
  if (eclipseTagInfo.colors && Array.isArray(eclipseTagInfo.colors)) {
    const colorNames = eclipseTagInfo.colors.map(c => c.name || "").filter(Boolean);
    if (colorNames.length > 0) {
      colorsText = `Available in ${colorNames.join(", ")}`;
    }
  }
  
  // Handle specs info
  let featuresText = "";
  if (eclipseTagInfo.specs) {
    const specs = [
      eclipseTagInfo.specs.materials,
      eclipseTagInfo.specs.durability,
      eclipseTagInfo.specs.attachment,
      eclipseTagInfo.specs.visibility
    ].filter(Boolean);
    
    if (specs.length > 0) {
      featuresText = `Features include ${specs.join(", ")}`;
    }
  }
  
  // Handle promo info
  const promoText = eclipseTagInfo.pricing?.promoDescription || "";
  
  // Construct the prompt with only available information
  return `
ECLIPSE TAG PRODUCT INFORMATION:
- ${shortDescription}
- Priced at $${price} ${currency} ${bulkDiscountText}
${colorsText ? `- ${colorsText}` : ''}
${featuresText ? `- ${featuresText}` : ''}
${promoText ? `- ${promoText}` : ''}
  `.trim();
}

// Add detailed logging middleware
app.use((req, res, next) => {
  // CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  
  // Log requests
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} from ${req.get('origin') || 'Unknown Origin'}`);
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Add a simple test endpoint at the root level
app.get('/', (req, res) => {
  res.send('Server is running! Try /api/chat for the chat API or /api/check-openai to test OpenAI connectivity.');
});

// Pure debug endpoint to check OpenAI connectivity
app.get('/api/check-openai', async (req, res) => {
  try {
    console.log('Testing OpenAI connection...');
    
    // Try the simplest possible request
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Use 3.5 for the test as it's more reliable
      messages: [
        { role: "user", content: "Say hello" }
      ],
      max_tokens: 5
    });
    
    // If successful, return the response
    console.log('OpenAI test successful:', response.choices[0].message);
    res.json({ 
      success: true, 
      message: "OpenAI connection working",
      response: response.choices[0].message.content
    });
  } catch (error) {
    console.error('OpenAI test failed:', error);
    res.status(500).json({ 
      success: false, 
      message: "OpenAI connection failed", 
      error: error.message 
    });
  }
});

// Super simplified chat endpoint - direct pass-through to OpenAI
app.post('/api/chat', async (req, res) => {
  try {
    // Check if we have a message to respond to
    if (!req.body.message) {
      return res.status(400).json({ error: 'No message provided' });
    }

    const userMessage = req.body.message;
    const history = req.body.history || [];
    const maxTokens = 150; // Keep responses fairly short

    // Get API key with fallback
    const apiKey = process.env.OPENAI_API_KEY || "your-api-key";

    // Include product information and inventory status in the prompt
    const eclipseInfo = generateEclipseProductPrompt();
    const inventoryCount = getInventoryCount();
    const inventoryStatus = inventoryCount > 0 
      ? `Currently in stock (${inventoryCount} units available).` 
      : 'Currently out of stock.';
    
    // Format recent order information
    let recentOrdersInfo = '';
    if (recentOrders.length > 0) {
      recentOrdersInfo = `\nRecent order activity: 
- Last ${recentOrders.length} orders totaled ${recentOrders.reduce((sum, order) => sum + order.quantity, 0)} Eclipse Tags
- Most recent order: ${new Date(recentOrders[0]?.date).toLocaleString()} for ${recentOrders[0]?.quantity} tags`;
    } else {
      recentOrdersInfo = '\nNo recent orders tracked yet.';
    }

    // Check if this is an inventory-related question
    const inventoryKeywords = ['stock', 'available', 'inventory', 'in stock', 'how many', 'quantity', 'orders', 'sold', 'purchases'];
    const isInventoryQuestion = inventoryKeywords.some(keyword => 
      userMessage.toLowerCase().includes(keyword)
    );

    // Create OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey
    });

    // Prepare the system message with roles and instructions
    const systemMessage = `You are an AI assistant that serves as both a PRODUCT SPECIALIST for Eclipse Tags and a GENERAL ASSISTANT.

AS A PRODUCT SPECIALIST:
- You know everything about Eclipse Tag products.
- ${eclipseInfo}
- ${inventoryStatus}
- Provide specific, accurate information based on the details above.
${recentOrdersInfo}

AS A GENERAL ASSISTANT:
- Be conversational, friendly, and concise (25-50 words max).
- Answer any other questions to the best of your ability.

Always start with the most relevant information first. If you don't know something specific, acknowledge that and offer what you do know.`;

    // If this is specifically about inventory/availability, provide a custom response
    if (isInventoryQuestion) {
      // Prepare a more detailed response about inventory and recent orders
      let response = `Eclipse Tags are ${inventoryCount > 0 ? 'in stock' : 'out of stock'}. We currently have ${inventoryCount} units available`;
      
      if (inventoryCount === 0) {
        response += ' and are expecting more soon';
      }
      
      if (recentOrders.length > 0 && userMessage.toLowerCase().includes('order')) {
        response += `. We've had ${recentOrders.length} recent orders totaling ${recentOrders.reduce((sum, order) => sum + order.quantity, 0)} units`;
      }
      
      response += '.';
      
      return res.json({ response });
    }

    // Create messages array with system prompt
    const messages = [
      { role: 'system', content: systemMessage },
    ];

    // Add conversation history if provided
    if (history && history.length > 0) {
      messages.push(...history);
    }

    // Add the user's new message
    messages.push({ role: 'user', content: userMessage });

    try {
      // Try GPT-4o first
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        max_tokens: maxTokens,
        temperature: 0.7,
      });

      const response = completion.choices[0].message.content;
      return res.json({ response });

    } catch (error) {
      // Fallback to GPT-3.5-turbo
      errorLog(`Error with GPT-4o, falling back to GPT-3.5-turbo: ${error.message}`);
      
      try {
        const fallbackCompletion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: messages,
          max_tokens: maxTokens,
          temperature: 0.7,
        });

        const fallbackResponse = fallbackCompletion.choices[0].message.content;
        return res.json({ response: fallbackResponse });
      } catch (fallbackError) {
        throw new Error(`Both GPT-4o and GPT-3.5-turbo failed: ${fallbackError.message}`);
      }
    }
    
  } catch (error) {
    errorLog(`Chat API error: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

// Inventory Management API Endpoints
app.get('/api/inventory', (req, res) => {
  try {
    res.json(eclipseTagInventory);
  } catch (error) {
    errorLog(`Error getting inventory: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve inventory' });
  }
});

app.post('/api/update-inventory', (req, res) => {
  try {
    const { action, amount } = req.body;
    
    if (!action || !['set', 'add', 'subtract'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be "set", "add", or "subtract"' });
    }
    
    if (typeof amount !== 'number' || isNaN(amount) || amount < 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }
    
    const newCount = updateInventory(action, amount);
    
    // Return the updated inventory
    res.json({
      success: true,
      newCount,
      lastUpdated: eclipseTagInventory.lastUpdated
    });
  } catch (error) {
    errorLog(`Error updating inventory: ${error.message}`);
    res.status(500).json({ error: 'Failed to update inventory' });
  }
});

// Shopify Order Webhook Configuration
const SHOPIFY_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET || 'your-webhook-secret'; // Configure this in your actual environment

// Calculate how many Eclipse Tags were ordered based on the order amount
function calculateTagsQuantity(orderAmount) {
  // Price of a single Eclipse Tag (in dollars)
  const singleTagPrice = 7;
  
  // Calculate quantity based on order amount (round down to be conservative)
  // For example, $28 / $7 = 4 tags
  return Math.floor(orderAmount / singleTagPrice);
}

// Verify Shopify webhook authenticity
function verifyShopifyWebhook(req) {
  try {
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    
    if (!hmacHeader) {
      return false;
    }
    
    const body = req.rawBody || JSON.stringify(req.body);
    const hash = crypto.createHmac('sha256', SHOPIFY_SECRET)
      .update(body, 'utf8')
      .digest('base64');
    
    return crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(hmacHeader)
    );
  } catch (error) {
    errorLog(`Webhook verification error: ${error.message}`);
    return false;
  }
}

// Save raw body for webhook verification
app.use('/api/webhooks', express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// Handle Shopify order creation webhook
app.post('/api/webhooks/orders/create', async (req, res) => {
  try {
    // Verify webhook authenticity
    const isAuthentic = verifyShopifyWebhook(req);
    
    if (!isAuthentic) {
      errorLog('Received invalid webhook - authentication failed');
      return res.status(401).send('Unauthorized');
    }
    
    const order = req.body;
    debugLog(`Processing new Shopify order: ${order.id}`);
    
    // Skip if the order doesn't have required fields
    if (!order.total_price || !order.confirmed) {
      return res.status(200).send('Order skipped - not confirmed or missing total');
    }
    
    // Calculate how many Eclipse Tags were ordered
    const totalAmount = parseFloat(order.total_price);
    const quantity = calculateTagsQuantity(totalAmount);
    
    // Only process if they ordered at least one tag
    if (quantity > 0) {
      // Subtract from inventory
      const previousCount = getInventoryCount();
      const newCount = updateInventory('subtract', quantity);
      
      // Track this order
      addRecentOrder(order.id, totalAmount, quantity, new Date());
      
      debugLog(`Order ${order.id}: Reduced inventory by ${quantity} units (${previousCount} → ${newCount})`);
    } else {
      debugLog(`Order ${order.id}: No inventory change needed (amount too small)`);
    }
    
    // Return success
    res.status(200).send('OK');
  } catch (error) {
    errorLog(`Error processing order webhook: ${error.message}`);
    res.status(500).send('Error processing webhook');
  }
});

// Add an endpoint to get recent orders (admin only)
app.post('/api/recent-orders', (req, res) => {
  try {
    // Check password for security
    if (!req.body.password || req.body.password !== 'nnypeclipse123$') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    res.json({
      recentOrders,
      count: recentOrders.length
    });
  } catch (error) {
    errorLog(`Error getting recent orders: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve recent orders' });
  }
});

// Add fallback route for handling 404s
app.use((req, res, next) => {
  console.log(`[404] Route not found: ${req.method} ${req.url}`);
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    url: req.url,
    routes: [
      '/ (GET) - Server status',
      '/api/chat (POST) - Chat with AI',
      '/api/check-openai (GET) - Check OpenAI connectivity'
    ]
  });
});

// Replace OpenAI API Key Check: API Key found, chat functionality should work
console.log('OpenAI API Key Check:', process.env.OPENAI_API_KEY ? 'API Key found, chat functionality should work' : 'No API Key found, chat will not work');

// Schedule regular server health logging
setInterval(() => {
  console.log('Server health check:', new Date().toISOString());
  console.log('OpenAI API Key status:', process.env.OPENAI_API_KEY ? 'Present' : 'Missing');
}, 5 * 60 * 1000); // Log every 5 minutes

// Validate critical environment variables
console.log('=== Server Environment Status ===');
console.log('Node Environment:', process.env.NODE_ENV || 'development');
console.log('Server Port:', process.env.PORT || '3000');
console.log('OpenAI API Key:', process.env.OPENAI_API_KEY ? 'Present (length: ' + process.env.OPENAI_API_KEY.length + ')' : 'MISSING');
console.log('Shopify Access Token:', process.env.SHOPIFY_ACCESS_TOKEN ? 'Present' : 'MISSING');
console.log('================================');

// Replace server start code with version that handles port conflicts
const startServer = (initialPort) => {
  const server = app.listen(initialPort, () => {
    const actualPort = server.address().port;
    console.log(`Server running on port ${actualPort}`);
    console.log(`Chat API available at http://localhost:${actualPort}/api/chat`);
    console.log(`OpenAI status check at http://localhost:${actualPort}/api/check-openai`);
  });

  // Handle server errors gracefully
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.warn(`Port ${initialPort} is already in use, trying ${initialPort + 1}...`);
      startServer(initialPort + 1);
    } else {
      console.error('Server error:', error);
    }
  });

  return server;
};

// Start the server with initial port
startServer(port);
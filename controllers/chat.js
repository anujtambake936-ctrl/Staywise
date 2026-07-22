const Groq    = require('groq-sdk');
const Listing = require('../models/listing.js');
const Payment = require('../models/payment.js');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Step 1: Extract structured filters from the user's natural language ─────
async function extractFilters(userMessage) {
  const today = new Date().toISOString().slice(0, 10);

  const response = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    temperature: 0,
    messages: [
      {
        role: 'system',
        content: `You are a filter extractor for a property rental platform. Today's date is ${today}.
Extract search filters from the user message and return ONLY valid JSON with these optional keys:
- category: one of "Apartment", "Villa", "Cottage", "Beach House", "Cabin"
- maxPrice: number (per night in INR)
- minPrice: number (per night in INR)
- location: string (city or country)
- checkIn: "YYYY-MM-DD"
- checkOut: "YYYY-MM-DD"
- sortBy: "price_asc" | "price_desc" | "trending"
- keyword: string (general search term for title/description)

Return {} if no filters found. Return ONLY the JSON object, no explanation.`,
      },
      { role: 'user', content: userMessage },
    ],
  });

  try {
    const raw = response.choices[0].message.content.trim();
    // extract JSON even if model wraps it in markdown
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  } catch {
    return {};
  }
}

// ─── Step 2: Query MongoDB using extracted filters ────────────────────────────
async function queryListings(filters) {
  const query = {};

  if (filters.category)  query.category = filters.category;
  if (filters.keyword) {
    const regex = new RegExp(filters.keyword.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
    query.$or = [{ title: regex }, { location: regex }, { country: regex }, { description: regex }];
  }
  if (filters.location && !filters.keyword) {
    const regex = new RegExp(filters.location.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
    query.$or = [{ location: regex }, { country: regex }];
  }

  const priceFilter = {};
  if (filters.minPrice) priceFilter.$gte = Number(filters.minPrice);
  if (filters.maxPrice) priceFilter.$lte = Number(filters.maxPrice);
  if (Object.keys(priceFilter).length) query.price = priceFilter;

  // if date range provided, exclude listings with conflicting bookings
  let bookedListingIds = [];
  if (filters.checkIn && filters.checkOut) {
    const conflicting = await Payment.find({
      status:   'paid',
      checkIn:  { $lt: new Date(filters.checkOut) },
      checkOut: { $gt: new Date(filters.checkIn) },
    }).distinct('listing');
    bookedListingIds = conflicting;
  }
  if (bookedListingIds.length) {
    query._id = { $nin: bookedListingIds };
  }

  let listingsQuery = Listing.find(query).limit(5);

  if (filters.sortBy === 'price_asc')  listingsQuery = listingsQuery.sort({ price:  1 });
  if (filters.sortBy === 'price_desc') listingsQuery = listingsQuery.sort({ price: -1 });
  if (filters.sortBy === 'trending')   listingsQuery = listingsQuery.sort({ views: -1 });

  return listingsQuery.lean();
}

// ─── Step 3: Generate a natural language response using listings as context ───
async function generateResponse(userMessage, listings, filters) {
  let context = '';

  if (listings.length === 0) {
    context = 'No listings were found matching the user\'s criteria.';
  } else {
    context = listings.map((l, i) =>
      `${i + 1}. "${l.title}" — ${l.category} in ${l.location}, ${l.country}. ` +
      `Price: ₹${l.price}/night. ${l.description ? l.description.slice(0, 100) : ''} ` +
      `[View: /listings/${l._id}]`
    ).join('\n');
  }

  const dateContext = filters.checkIn && filters.checkOut
    ? `The user wants to stay from ${filters.checkIn} to ${filters.checkOut}. Only available listings are shown.`
    : '';

  const response = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content: `You are a helpful travel assistant for Staywise, a property rental platform in India.
Answer the user's question using ONLY the listing data provided below. Be friendly and concise.
If listings are found, mention 2-3 highlights and include the view link. 
If none are found, suggest they try different filters.
${dateContext}

Available listings:
${context}`,
      },
      { role: 'user', content: userMessage },
    ],
  });

  return response.choices[0].message.content.trim();
}

// ─── Main handler ─────────────────────────────────────────────────────────────
module.exports.chat = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    // RAG pipeline: extract → retrieve → generate
    const filters  = await extractFilters(message);
    const listings = await queryListings(filters);
    const reply    = await generateResponse(message, listings, filters);

    res.json({ reply, listingsFound: listings.length });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'AI assistant is unavailable. Please try again.' });
  }
};

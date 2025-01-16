// Import required modules
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const Tesseract = require('tesseract.js'); // For image OCR
const axios = require('axios'); // For making API requests

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// MongoDB connection details
const mongoUrl = process.env.MONGO_URL || "mongodb+srv://GroupE:Octane1890@backendcluster.rssjj.mongodb.net/";
const dbName = process.env.DB_NAME || "Products"; // Database name
let db;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Connect to MongoDB
async function connectToMongoDB() {
    try {
        const client = await MongoClient.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
        db = client.db(dbName);
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error('Failed to connect to MongoDB:', err.message);
        process.exit(1);
    }
}

// Fetch all categories (assumes 'Category' collection exists)
app.get('/', async (req, res) => {
    try {
        const categoriesCollection = db.collection('Category');
        const categories = await categoriesCollection.find({}).toArray();

        if (!categories.length) {
            return res.status(404).json({ error: "No categories found" });
        }

        res.status(200).json(categories);
    } catch (err) {
        console.error('Error fetching categories:', err.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Fetch products for a specific category with dynamic filtering
app.get('/category/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const { name, minRating, maxRating, minPrice, maxPrice, genre, language, sortPrice } = req.query;

        if (!category) {
            return res.status(400).json({ error: "Category is required" });
        }

        const collection = db.collection(category.trim());
        const query = {};

        // Filters
        if (name) query.title = { $regex: name.trim(), $options: 'i' };
        if (minRating) query.rating = { ...query.rating, $gte: parseFloat(minRating) };
        if (maxRating) query.rating = { ...query.rating, $lte: parseFloat(maxRating) };
        if (minPrice) query.price = { ...query.price, $gte: parseFloat(minPrice) };
        if (maxPrice) query.price = { ...query.price, $lte: parseFloat(maxPrice) };
        if (genre) query.genres = { $in: genre.split(',').map(g => g.trim()) };
        if (language) query.language = { $in: language.split(',').map(l => l.trim()) };

        const sortOptions = {};
        if (sortPrice) sortOptions.price = sortPrice === 'asc' ? 1 : -1;

        const products = await collection.find(query).sort(sortOptions).toArray();

        if (!products.length) {
            return res.status(404).json({ error: `No products found in category ${category} with the given criteria`, query });
        }

        res.status(200).json(products);
    } catch (err) {
        console.error('Error fetching category products:', err.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Dynamic genre categorization for recommendations
app.post('/recommendations', async (req, res) => {
    try {
        const { genres } = req.body;

        if (!genres || !Array.isArray(genres) || genres.length === 0) {
            return res.status(400).json({ error: "Genres must be a non-empty array" });
        }

        const productsCollection = db.collection('Books'); // Assuming a general 'Books' collection
        const recommendations = await productsCollection
            .find({ genres: { $in: genres } })
            .limit(4) // Limit to top 4 recommendations
            .toArray();

        res.status(200).json(recommendations);
    } catch (err) {
        console.error('Error fetching recommendations:', err.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Chatbot API
app.post('/api/chat', async (req, res) => {
    const { message, image } = req.body;

    if (image) {
        // Handle Image Search (OCR)
        try {
            const result = await Tesseract.recognize(image, 'eng');
            const detectedText = result.data.text;
            res.json({ type: 'text', text: `Detected text from image: ${detectedText}` });
        } catch (error) {
            console.error('Error processing image:', error);
            res.status(500).json({ type: 'text', text: 'Failed to process the image.' });
        }
    } else if (message) {
        // Handle Text-Based Queries
        if (message.toLowerCase().includes('category')) {
            const queryCategory = message.split(' ').slice(1).join(' ');
            try {
                const response = await axios.get(`https://aqueous-tiaga-699bfea4a0d8.herokuapp.com/category/${queryCategory}`);
                res.json({ type: 'text', text: `Books found: ${response.data.map(book => book.title).join(', ')}` });
            } 
            catch (err) {
                res.json({ type: 'text', text: 'Failed to fetch data for the category.' });
            }
        } else {
            res.json({ type: 'text', text: 'We are in the development phase for this feature.' });
        }
    } else {
        res.status(400).json({ error: 'Invalid request. Please provide a message or image.' });
    }
});

// Start the server
async function startServer() {
    await connectToMongoDB();

    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
}

startServer();

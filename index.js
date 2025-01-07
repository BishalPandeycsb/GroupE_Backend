// Import required modules
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// MongoDB connection URL
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
        console.error('Failed to connect to MongoDB:', err);
        process.exit(1);
    }
}

// Fetch all categories (assumes 'Category' collection exists)
app.get('/', async (req, res) => {
    try {
        const categoriesCollection = db.collection('Category');
        const categories = await categoriesCollection.find({}).toArray();

        if (!categories.length) {
            return res.status(404).send({ error: "No categories found" });
        }

        res.status(200).send(categories);
    } catch (err) {
        console.error('Error fetching categories:', err);
        res.status(500).send({ error: "Internal Server Error" });
    }
});

// Fetch products for a specific category with dynamic filtering
app.get('/category/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const { name, minRating, maxRating, minPrice, maxPrice, genre, language, sortPrice } = req.query;

        if (!category) {
            return res.status(400).send({ error: "Category query parameter is required" });
        }

        // Access the collection for the specified category
        const collection = db.collection(category.trim());

        // Build the query object
        const query = {};

        // Add name search filter
        if (name) {
            query.title = { $regex: name.trim(), $options: 'i' }; // Case-insensitive regex for partial matching
        }

        // Add rating filters if provided
        if (minRating) query.rating = { ...query.rating, $gte: parseFloat(minRating) };
        if (maxRating) query.rating = { ...query.rating, $lte: parseFloat(maxRating) };

        // Add price filters if provided
        if (minPrice) query.price = { ...query.price, $gte: parseFloat(minPrice) };
        if (maxPrice) query.price = { ...query.price, $lte: parseFloat(maxPrice) };

        // Add genre filter
        if (genre) {
            const genres = genre.split(',').map(g => g.trim()); // Split by comma and trim spaces
            query.genres = { $in: genres }; // Match any of the genres
        }

        // Add language filter
        if (language) {
            const languages = language.split(',').map(l => l.trim()); // Split by comma and trim spaces
            query.language = { $in: languages }; // Match any of the languages
        }

        // Log the query for debugging
        console.log("Generated Query:", query);

        // Build the sort object for price
        const sortOptions = {};
        if (sortPrice) {
            sortOptions.price = sortPrice === 'asc' ? 1 : -1;
        }

        // Fetch products matching the query and sorting
        const products = await collection.find(query).sort(sortOptions).toArray();

        if (!products.length) {
            console.error(`No products found for query:`, query);
            return res.status(404).send({ error: `No products found in category ${category} with the given criteria`, query });
        }

        res.status(200).send(products);
    } catch (err) {
        console.error('Error fetching category products:', err);
        res.status(500).send({ error: "Internal Server Error" });
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

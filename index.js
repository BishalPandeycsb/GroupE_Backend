// Import required modules
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');

// Initialize Express app
const app = express();
const port = process.env.PORT || 5000;

// MongoDB connection URL
const mongoUrl = "mongodb+srv://GroupE:Octane1890@backendcluster.rssjj.mongodb.net/";
const dbName = "Products"; // Name of the database
let db;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Fetch collections or query specific category
app.get('/', async (req, res) => {
    try {
        const { category, minRating, maxRating, sortPrice } = req.query;

        if (!category) {
            // If no category is provided, return all collection names
            const collections = await db.listCollections().toArray();
            const categories = collections.map(collection => collection.name);

            if (!categories.length) {
                return res.status(404).send({ error: "No categories found" });
            }

            return res.status(200).send(categories);
        }

        // Dynamically access the collection for the specified category
        const collection = db.collection(category.trim());

        // Build the query object
        const query = {};

        // Add rating filters if provided
        if (minRating) {
            query.rating = query.rating || {};
            query.rating.$gte = parseFloat(minRating);
        }
        if (maxRating) {
            query.rating = query.rating || {};
            query.rating.$lte = parseFloat(maxRating);
        }

        // Build the sort object for price
        const sortOptions = {};
        if (sortPrice) {
            sortOptions.price = sortPrice === 'asc' ? 1 : -1;
        }

        // Fetch documents from the collection with query and sorting
        const results = await collection.find(query).sort(sortOptions).toArray();

        // Send the results back to the client
        if (results.length === 0) {
            return res.status(404).send({ error: "No products found in the selected category" });
        }

        res.status(200).send(results);
    } catch (err) {
        console.error('Error fetching results:', err);
        res.status(500).send({ error: "Internal Server Error" });
    }
});

// Connect to MongoDB and start the server
async function startServer() {
    try {
        const client = await MongoClient.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
        db = client.db(dbName);
        console.log('Connected to MongoDB');

        // Start the server
        app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });
    } catch (err) {
        console.error('Failed to connect to MongoDB:', err);
        process.exit(1); // Exit the application if MongoDB connection fails
    }
}

startServer();

const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@simplecrudserver.fyfvvbn.mongodb.net/?appName=simpleCRUDserver`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();
        const db = client.db('zapShiftDB');
        const parcelCollection = db.collection('parcels');

        // Parcel API
        app.get('/parcels', async (req, res) => {
            const query = {};
            const {email} = req.query;
            if(email){
                query.senderEmail = email;
            }
            const options = { sort: { createdAt: -1 } };
            const cursor = parcelCollection.find(query, options);
            const result = await cursor.toArray();
            res.send(result);
        })

        // create parcel
        app.post('/parcels', async (req, res) => {
            const parcel = req.body;
            parcel.createdAt = new Date();
            const result = await parcelCollection.insertOne(parcel);
            res.send(result);
        })

        // Delete parcel
        app.delete('/parcels/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await parcelCollection.deleteOne(query);
            res.send(result);
        })

        
        console.log('Connected to MongoDB server successfully!');
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Zap Shift Server is running')
})

app.listen(port, () => {
    console.log(`Zap Shift Server listening on port ${port}`)
})
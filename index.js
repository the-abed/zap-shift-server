const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const port = process.env.PORT || 5000;

const crypto = require("crypto");

function generateTrackingId() {
  const prefix = "TRK";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 chars
  return `${prefix}-${date}-${random}`;
}

console.log(generateTrackingId());


// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@simplecrudserver.fyfvvbn.mongodb.net/?appName=simpleCRUDserver`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const db = client.db("zapShiftDB");
    const parcelCollection = db.collection("parcels");
    const paymentCollection = db.collection("payments");

    // Parcels API

    // Get all parcels
    app.get("/parcels", async (req, res) => {
      const query = {};
      const { email } = req.query;
      if (email) {
        query.senderEmail = email;
      }
      const options = { sort: { createdAt: -1 } };
      const cursor = parcelCollection.find(query, options);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Get single parcel
    app.get("/parcels/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await parcelCollection.findOne(query);
      res.send(result);
    });

    // Create parcel
    app.post("/parcels", async (req, res) => {
      const parcel = req.body;
      parcel.createdAt = new Date();
      const result = await parcelCollection.insertOne(parcel);
      res.send(result);
    });

    // Delete parcel
    app.delete("/parcels/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await parcelCollection.deleteOne(query);
      res.send(result);
    });

    // Payment related apis
    app.post("/payment-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      const amount = parseInt(paymentInfo.cost) * 100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: amount,
              product_data: {
                name: `Please pay for: ${paymentInfo.parcelName}`,
              },
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        metadata: {
          parcelId: paymentInfo.parcelId,
          parcelName: paymentInfo.parcelName,
        },
        customer_email: paymentInfo.senderEmail,
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
      });

      res.send({ url: session.url });
    });

    app.patch('/payment-success', async (req, res) => {
        const sessionId = req.query.session_id;
        

        const session = await stripe.checkout.sessions.retrieve(sessionId);
        console.log(sessionId, session);
        const trackingId = generateTrackingId();

        if(session.payment_status === 'paid') {
         const id = session.metadata.parcelId;

         const query = { _id: new ObjectId(id) };
         const update = {
            $set: {
                paymentStatus: 'paid' ,
                trackingId: trackingId
            }
         }
         const result = await parcelCollection.updateOne(query, update);

         const payment = {
            amount: session.amount_total,
            transactionId: session.payment_intent,
            parcelId: session.metadata.parcelId,
            parcelName: session.metadata.parcelName,
            senderEmail: session.customer_email,
            currency: session.currency,
            paymentStatus: session.payment_status,
            paidAt: new Date(),
            
         }
         if(session.payment_status === 'paid') {
            const paymentResult = await paymentCollection.insertOne(payment);
            res.send({success: true,
                modifyParcel: result,
                trackingId: trackingId,
                transactionId: session.payment_intent,
                paymentInfo: paymentResult});
         }
        }

        res.send({ sessionId: false});
    })

    console.log("Connected to MongoDB server successfully!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Zap Shift Server is running");
});

app.listen(port, () => {
  console.log(`Zap Shift Server listening on port ${port}`);
});


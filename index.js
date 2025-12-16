const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

//
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const port = process.env.PORT || 3000;

// middle ware
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.d3mrlwo.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // database create
    const db = client.db("lekhok-hub-db");
    const contestCollection = db.collection("contests");

    // contest api
    app.get("/contests", async (req, res) => {
      const query = {};
      // user vittik email khuja
      const { email } = req.query;
      if (email) {
        query.creatorEmail = email;
      }

      const cursor = contestCollection.find(query).sort({ _id: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    // je contest jonno pay korbo oitar data
    app.get("/contests/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await contestCollection.findOne(query);
      res.send(result);
    });

    app.post("/contests", async (req, res) => {
      const contest = req.body;
      const result = await contestCollection.insertOne(contest);
      res.send(result);
    });

    // myContest theke contest delete
    app.delete("/contests/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await contestCollection.deleteOne(query);
      res.send(result);
    });

    // payment related apis

  app.post("/payment-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      
      console.log(paymentInfo)
        const amount = parseInt(paymentInfo.entryFee) * 100;

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            // Provide the exact Price ID (for example, price_1234) of the product you want to sell
            price_data: {
                currency: 'bdt',
                unit_amount: amount,
                product_data: {
                    // name:paymentInfo.contestTitle
                    name:`Please pay for : ${paymentInfo.contestTitle}`
                }
            },
  
            quantity: 1,
          },
        ],
        customer_email:paymentInfo.creatorEmail,
        metadata:{
            contestId: paymentInfo.contestId
        },
        mode: "payment",
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
      });

      console.log(session)
      res.send({url: session.url})

    });







// old
    app.post("/create-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      
      console.log(paymentInfo)
        const amount = parseInt(paymentInfo.entryFee) * 100;

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            // Provide the exact Price ID (for example, price_1234) of the product you want to sell
            price_data: {
                currency: 'bdt',
                unit_amount: amount,
                product_data: {
                    name:paymentInfo.contestTitle
                    // name:`Please pay for : ${paymentInfo.contestTitle}`
                }
            },
  
            quantity: 1,
          },
        ],
        customer_email:paymentInfo.creatorEmail,
        metadata:{
            contestId: paymentInfo.contestId
        },
        mode: "payment",
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
      });

      console.log(session)
      res.send({url: session.url})

    });

// payment success page ar ( session_id ) use kora
    app.patch('/payment-success', async (req, res) => {
        const sessionId = req.query.session_id;
        // console.log('session_id', sessionId)

        const session = await stripe.checkout.sessions.retrieve(sessionId)
        console.log('sessions-retrieve', session)
        if(session.payment_status === 'paid'){
            const id = session.metadata.contestId
            const query = { _id: new ObjectId(id)}
            const update = {
                $set: {
                    paymentStatus: 'paid',
                }
            }

            const result = await contestCollection.updateOne(query, update);
            res.send(result)
        }

        res.send({success: false})
    })




    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World lekhok-hub!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

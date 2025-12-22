const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

//
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const port = process.env.PORT || 3000;

//
const admin = require("firebase-admin");

const serviceAccount = require("./lekhok-hub-client-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});



// middle ware
app.use(express.json());
app.use(cors());

//
const verifyFBToken = async (req, res, next) => {
    // console.log('headers in the middleware', req.headers.authorization)
    const token = req.headers.authorization;

    if (!token) {
       return res.status(401).send({message: 'unauthorized access'})
    }

    try{
        const idToken = token.split(' ')[1];
        const decoded = await admin.auth().verifyIdToken(idToken)
        console.log('decoded in the token', decoded)
        req.decoded_email = decoded.email
        console.log("TOKEN EMAIL:", req.decoded_email);
         next();
    }
    catch(error){
        return res.status(401).send({message: 'unauthorized access'})
    }
   
}





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
    const userCollection = db.collection("users");
    const participantCollection = db.collection("participants");


    //> middle ware with database access
    // middle admin before allowing admin activity
    // must be used after verifyFBToken middleware
    const verifyAdmin = async (req, res, next) => {
        const email = req.decoded_email;
        const query = { email };
        const user = await userCollection.findOne(query);

        if(!user || user.role !== 'admin'){
            return res.status(403).send({ message: 'forbidden access'})
        }
      console.log("VERIFY ADMIN USER", user);
        next();
    }

    //<

/// score diye post kora  ( contest participant)
app.post("/participants", async (req, res) => {
 const { participant, scores, totalScore } = req.body;


  const result = await participantCollection.insertOne({
    ...participant,
    ...scores,
    totalScore
  });
  res.send(result);
});


///>  leaderBoard / Winner List
// app.get('/participants', async (req,res) => {
//     const participant = await participantCollection.find().sort({totalScore: -1}).toArray();

// })

///>/   total entry fee
app.get("/participants", async (req, res) => {
  try {
    const participants = await participantCollection
      .find()
      .sort({ totalScore: -1 })         // highest score first
      .toArray();

    // calculate total entry fee
    const totalEntryFee = participants.reduce((sum, p) => {
      return sum + Number(p.entryFee);
    }, 0);

    const prizePool = {
      first: totalEntryFee * 0.5,
      second: totalEntryFee * 0.3,
      third: totalEntryFee * 0.2,
    };

    const leaderboard = participants.map((p, index) => {
      return {
        rank: idx + 1,
        email: p.creatorEmail,
        title: p.title,
        totalScore: p.totalScore,
        prize:
          index === 0
            ? prizePool.first
            : index === 1
            ? prizePool.second
            : index === 2
            ? prizePool.third
            : 0,
      };
    });
console.log('totalEntryFee',leaderboard)
    res.send({ totalEntryFee, leaderboard });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});


//////</






    /// users management api
    app.get('/users', verifyFBToken, async (req, res) => {
        const result = await userCollection.find().toArray();
        res.send(result)
    })

    app.get('/users/:id', async (req,res) => {
        
    })

    //>
    app.get('/users/:email/role',  async (req, res) => {
        const email = req.params.email;

        const query = {email}
        const user = await userCollection.findOne(query)
        res.send({role : user?.role || 'user'})
    })
//<


    //users related api
    app.post('/users', async (req,res) => {
        const user = req.body;
        user.role = 'user';
        user.createdAt = new Date();

        //user collection a dekte cai users ace ki na
        const email = user.email;
        const userExists = await userCollection.findOne({ email })

        if (userExists) {
            return res.send({ message: 'user exists'})
        }

       const  result = await userCollection.insertOne(user);
       res.send(result) 

    })

    // users management patch make a admin & remove admin
    // role pore new vabe use kora 
    app.patch('/users/:id/role', verifyFBToken, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const roleInfo = req.body;
        const query = { _id: new ObjectId(id)}
        const updatedDoc = {
            $set: {
                role: roleInfo.role
            }
        }
        const result = await userCollection.updateOne(query, updatedDoc)
        res.send(result)

    })



    // contest api
    // email use hosce my-contest 
    // jeta paid 
    app.get("/contests", async (req, res) => {
      const query = {};
      // user upor email khuja
      const { email, paymentStatus } = req.query;
      if (email) {
        query.creatorEmail = email;
      }

      // paymentStatus  jodi paid hoy
      if (paymentStatus) {
        query.paymentStatus = paymentStatus;
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

    // contestUpdate api
    app.patch('/contests/:id', async (req, res) => {
        const id = req.params.id;
        const updatedContest = req.body;
        const query = { _id: new ObjectId(id)};
        const updatedDoc = {
            $set: updatedContest,
        }

        const result = await contestCollection.updateOne(query,updatedDoc);
        res.send(result);

    })

    //<

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

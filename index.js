const express = require('express')
const cors = require('cors')
const app = express()
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 3000

// middle ware
app.use(express.json())
app.use(cors())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.d3mrlwo.mongodb.net/?appName=Cluster0`;



// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});



async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // database create
    const db = client.db('lekhok-hub-db');
    const contestCollection = db.collection('contest')


    // contest api
    app.get('/contest', async (req, res) => {
       const query = {}
       // user vittik email khuja
       const {email} = req.query;
       if (email){
        query.creatorEmail = email;
       }
       
       const cursor = contestCollection.find(query)
       const result = await cursor.toArray()
       res.send(result)

    })

    app.post('/contest', async (req,res) => {
        const contest =req.body;
        const result = await contestCollection.insertOne(contest)
        res.send(result)
    })




    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);






app.get('/', (req, res) => {
  res.send('Hello World lekhok-hub!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function test() {
  const uri = process.env.DATABASE_URL;
  console.log("Testing connection to:", uri.replace(/:([^@]+)@/, ':****@'));
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Connected successfully to MongoDB!");
    const db = client.db();
    const collections = await db.listCollections().toArray();
    console.log("Collections:", collections.map(c => c.name));
  } catch (e) {
    console.error("Connection failed!");
    console.error(e);
  } finally {
    await client.close();
  }
}

test();

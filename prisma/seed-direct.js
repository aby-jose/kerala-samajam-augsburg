const { MongoClient } = require("mongodb");
const bcrypt = require("bcrypt");
require("dotenv").config();

async function main() {
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    console.error("DATABASE_URL not found in .env");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  const adminEmail = process.env.ADMIN_EMAIL || "admin@ksaugsburg.de";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  try {
    await client.connect();
    console.log("Connected to MongoDB...");
    
    const db = client.db(); // Uses database from URI
    const usersCollection = db.collection("User");

    const existingAdmin = await usersCollection.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log(`Admin with email ${adminEmail} already exists. Skipping...`);
    } else {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      
      const result = await usersCollection.insertOne({
        name: "Admin User",
        email: adminEmail,
        password: hashedPassword,
        role: "ADMIN",
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log(`Admin user created with ID: ${result.insertedId}`);
      console.log(`Email: ${adminEmail}`);
      console.log(`Password: ${adminPassword}`);
    }
  } catch (err) {
    console.error("Error during direct seeding:", err);
  } finally {
    await client.close();
  }
}

main();

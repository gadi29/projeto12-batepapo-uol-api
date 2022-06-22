import express, { json } from "express";
import cors from "cors";
import dotenv from 'dotenv';
import { MongoClient } from "mongodb";

const app = express();
app.use(json());
app.use(cors());
dotenv.config();
const port = 5000;

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(() => {
	db = mongoClient.db("batepapo_uol");
});



app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
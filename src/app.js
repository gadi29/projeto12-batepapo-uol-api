import express, { json } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import joi from 'joi';

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

const participantSchema = joi.object({
  name: joi.string().required()
});

const messageSchema = joi.object({
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.string().required()
});

app.get('/participants', async (req, res) => {
  try {
    const participants = await db.collection('participants').find().toArray();
    res.send(participants);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

app.post('/participants', async (req, res) => {
  const newParticipant = req.body;

  const validate = participantSchema.validate(newParticipant);
  if (validate.error) {
    return res.sendStatus(422);
  }

  const participant = await db.collection('participants').findOne({ name: newParticipant.name });
  if (participant) {
    return res.sendStatus(409);
  }

  try {
    await db.collection('participants').insertOne({ ...newParticipant, lastStatus: Date.now() });
    res.sendStatus(201);
  } catch (error) {
    console.error(error)
    res.sendStatus(500);
  }
});

app.post('/messages', async (req, res) => {
  const newMessage = req.body;

  const validate = messageSchema.validate(newMessage, { abortEarly: false });
  if (validate.error) {
    return res.sendStatus(422);
  }

  if (newMessage.type !== "message" && newMessage.type !== "private_message") {
    return res.sendStatus(422);
  }

  const userName = req.headers.user;
  const message = { ...newMessage, from: userName };
  
  const user = await db.collection('participants').findOne({ name: userName });
  if (!user) {
    return res.sendStatus(422);
  }

  try {
    const now = "10:00";

    await db.collection('messages').insertOne({ ...message, time: now })
    res.sendStatus(201);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
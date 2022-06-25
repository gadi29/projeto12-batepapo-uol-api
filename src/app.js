import express, { json } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import joi from 'joi';
import dayjs from 'dayjs';

const app = express();
app.use(json());
app.use(cors());
dotenv.config();

const port = 5000;
const FIVE_SEG = 5000;

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
    await db.collection('messages').insertOne({ from: newParticipant.name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs().format('HH:mm:ss') });
    res.sendStatus(201);
  } catch (error) {
    console.error(error)
    res.sendStatus(500);
  }
});

app.get('/messages', async (req, res) => {
  let limit = parseInt(req.query.limit);
  if (!limit) limit = 100;
  const allMessages = await db.collection('messages').find().toArray();
  const user = req.headers.user;

  const userMessages = allMessages.filter(message => {
    if (message.type === "message" || message.type === "status") return true;
    else {
      if (message.to === user) return true;
      else if (message.from === user) return true;
      else return false;
    }
  })

  try {
    if (userMessages.length > limit) {
      const showMessages = userMessages.split(-limit);
      res.send(showMessages);
    } else {
      const showMessages = [...userMessages];
      res.send(showMessages);
    }
    
  } catch (error) {
    console.error(error);
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
    await db.collection('messages').insertOne({ ...message, time: dayjs().format('HH:mm:ss') });
    res.sendStatus(201);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

app.post('/status', async (req, res) => {
  const user = req.headers.user;

  try {
    const userLogged = await db.collection('participants').findOne({ name: user });
    
    if (!userLogged) {
      return res.sendStatus(404);
    }

    await db.collection('participants').updateOne({ name: user }, {$set: { lastStatus : Date.now() }});
    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
})

setInterval(async () => {
  const participants = await db.collection('participants').find().toArray();

  const excludeParticipants = participants.filter(participant => participant.lastStatus < (Date.now() - (FIVE_SEG * 2)));

  excludeParticipants.map(async (participant) => {
    await db.collection('participants').deleteOne({ name: participant.name });
    await db.collection('messages').insertOne({ from: participant.name, to: 'Todos', text:'sai da sala...', type: 'status', time: dayjs().format('HH:mm:ss') })
  });
}, FIVE_SEG * 3)

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
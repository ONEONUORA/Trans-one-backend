
import express from "express";
import mongoose from 'mongoose';
import bodyParser from "body-parser"
import "dotenv/config"
import cors from 'cors';

//schema***************************************
import Rating from "./schema/Rating.js";

const server= express();
const PORT = 3000

server.use(bodyParser.json());
server.use(cors())
server.use(express())

// Connect to MongoDB
mongoose.connect(process.env.MONGO_DB_URL, {
    autoIndex:"true"
});

// Route to create a new rating
server.post('/rate', async (req, res) => {
  const { user, rating, comment } = req.body;

  // Validate rating value
  if (rating < 1 || rating > 5) {
    return res.status(400).send('Rating must be between 1 and 5');
  }

  const newRating = new Rating({ user, rating, comment });
  try {
    await newRating.save();
    res.status(201).send(newRating);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Route to get all ratings
server.get('/ratings', async (req, res) => {
  try {
    const ratings = await Rating.find();
    res.status(200).send(ratings);
  } catch (error) {
    res.status(500).send(error.message);
  }
});


server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

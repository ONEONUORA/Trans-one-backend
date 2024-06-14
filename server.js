
import express from "express";
import mongoose from 'mongoose';
import bodyParser from "body-parser"
import "dotenv/config"
import cors from 'cors';
import bcrypt from 'bcrypt'
import { nanoid } from "nanoid";

//schema***************************************
import Rating from "./schema/Rating.js";
import User from "./schema/User.js";


//Regression

let emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/; // regex for email
let passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,20}$/; // regex for password


const server= express();
const PORT = 3000

server.use(bodyParser.json());
server.use(cors())
server.use(express.json())

// Connect to MongoDB
mongoose.connect(process.env.MONGO_DB_URL, {
    autoIndex: true
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

//data to send to the frontend
const formatDatatoSend =() =>{
    return {
      profile_img : user.personal_info.profile_img,
      username: user.personal_info.username,
      fullname: user.personal_info.fullname
    }
}

//generate username
const generateUsername = async (email) =>{
  let username = email.split('@')[0];
  let isUsernameNotUnique = await User.exists({"personal_info.username": username}).then((result) => result)
  isUsernameNotUnique ? username += nanoid().substring(0,5) : "";
  return username
}

//Route to signup
server.post("/signup" , (req, res) =>{

  let{fullname, email, password} = req.body

  if(fullname.length < 3) {
    return res.status(403).json({'error': "Fullname must be atleast 3 letters long"})
  }

  if(!email.length){
    return res.status(403).json({'error': "Enter Email"})
  }

  if(!emailRegex.test(email)){
    return res.status(403).json({"error": "Enter is Invalid"})
  }

  if (!passwordRegex.test(password)){
    return res.status(403).json({"error": "Password should be 6-20 chracters long with a numeric, 1 lowercase and 1 uppercase letters "})
  }

  bcrypt.hash(password, 10,async(err, hashed_password) => {
    let username = await generateUsername(email);
    let user = new User({
        personal_info:{fullname, email, password: hashed_password, username}
    })

    user.save().then((u) => {
      return res.status(200).json(formatDatatoSend(u))
    })
    .catch(err => {
        if(err.code == 11000){
          return res.status(500).json({"error": "Email already exists"})
        }
      return res.status(500).json({'error': err.message})
    })
  })

})


server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

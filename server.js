
import express from "express";
import mongoose from 'mongoose';
import bodyParser from "body-parser"
import "dotenv/config"
import cors from 'cors';
import bcrypt from 'bcrypt'
import { nanoid } from "nanoid";
import jwt from "jsonwebtoken"
import admin from "firebase-admin"
import serviceAccountKey from "./transone-b6bc0-firebase-adminsdk-33fpu-86b9a03562.json"assert{type: 'json'}
import {getAuth} from "firebase-admin/auth"
import fs from "fs"
import path from "path"
import { fileURLToPath } from 'url';

//schema***************************************
import Rating from "./schema/Rating.js";
import User from "./schema/User.js";


//initiazing the firebase-admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountKey)
}
)

//Regression
let emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/; // regex for email
let passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,20}$/; // regex for password


const server= express();
const PORT = 3000

server.use(bodyParser.json());
server.use(cors())
server.use(express.json())

// Connect to MongoDB*********
mongoose.connect(process.env.MONGO_DB_URL, {
    autoIndex: true
});

// Route to create a new rating***********************************************
server.post('/rate', async (req, res) => {
  const { user, rating, comment } = req.body;

  // Validate rating value*************************************************
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

// Route to get all ratings*************************************************************
server.get('/ratings', async (req, res) => {
  try {
    const ratings = await Rating.find();
    res.status(200).send(ratings);
  } catch (error) {
    res.status(500).send(error.message);
  }
});


//route to get all emergency contact**********************************************

// Create __dirname equivalent for ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Load emergency contacts data
const contactsPath = path.join(__dirname, 'data', 'emergencyContacts.json');
const emergencyContacts = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));


// API endpoint to get all emergency contacts
server.get('/api/emergency-contacts', (req, res) => {
  res.json(emergencyContacts);
});


// API endpoint to get emergency contact for a specific country
server.get('/api/emergency-contacts/:country', (req, res) => {
  const country = req.params.country.toLowerCase();
  const contact = emergencyContacts.find(c => c.country.toLowerCase() === country);
  if (contact) {
      res.json(contact);
  } else {
      res.status(404).json({ message: 'Country not found' });
  }
});


//Routes to get healths issues*****************************************************

server.get('/api/health-issues', (req, res) => {
  const filePath = path.join(__dirname, 'data', 'healthIssues.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading the file:', err);
      res.status(500).send('Internal Server Error');
      return;
    }
    res.json(JSON.parse(data));
  });
});





//data to send to the frontend********************************************************
const formatDatatoSend =(user) =>{

  const access_token = jwt.sign({ id: user._id}, process.env.SECRET_ACCESS_KEY  )
    return {
      access_token,
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

//google auth route

server.post("/google-auth", async (req, res) =>{
  let {access_token} = req.body

  getAuth()
  .verifyIdToken(access_token)
  .then(async (decodedUser) => {

    let {email, name, picture} = decodedUser;

    picture = picture.replace("s96-c", "s384-c") //converting the low resolution picture from google to high resolution

    let user = await User.findOne({"personal_info.email": email}).select("personal_info.fullname personal_info.username personal_info.profile_img google_auth")
    .then((u) => {
      return  u || null
    })
    .catch(err => {
      return res.status(500).json({"error": err.message})
    })

    if(user){//login
      if(!user.google_auth){
          return res.status(403).json({"error": "This email was signed up without google. Pls login with password to access your account"})
      }

    }else{//sign up using google
        let username = await generateUsername(email)

        user = new User({
          personal_info: {fullname: name, email, username},
          google_auth: true
        })

        await user.save().then((u) => {
          user = u
        })
        .catch(err => {
          return res.status(500).json({"error": err.message})
        })
    }

      return res.status(200).json(formatDatatoSend(user))

  })
  .catch(err => {
    returnres.status(500).json({"error": "Failed to authenticate you with google> Try using another google account"})
  } )
})

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

//Route to signin

server.post("/signin", (req,res) =>{
  let {email, password} = req.body;

  User.findOne({"personal_info.email" : email })
  .then((user) =>{
    if(!user){
      return res.status(403).json({"error": "Email not found"})
    }

    if(!user.google_auth){
      bcrypt.compare(password, user.personal_info.password, (err, result) =>{
        if(err){
          return res.status(403).json({"error": "Error occurred during login, Pls try again."})
        }
  
        if(!result){
            return res.status(403).json({"error": "Incorrect Password"})
        }else{
          return res.status(200).json(formatDatatoSend(user))
        }
      })
    } else{
      return res.status(403).json ({"error": "Account was created using google"})
    }
  })
  .catch(err =>{
    console.log(err.message)
    return res.status(500).json({"error": err.message})
  })
})


server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.use(session({
  secret: process.env.NODE_SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    dbName: process.env.MONGODB_DATABASE,
    crypto: { secret: process.env.MONGODB_SESSION_SECRET },
    ttl: 3600
  })
}));

// Optional test connection
(async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB using standard URI!");
    await client.db("admin").command({ ping: 1 }); // extra confirmation
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
  } finally {
    await client.close();
  }
})();

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

//home page
app.get('/', (req, res) => {
    if (!req.session.username) {
      return res.send(`
        <h1>Welcome!</h1>
        <p><a href="/signup">Sign Up</a> | <a href="/login">Login</a></p>
      `);
    } else {
      return res.send(`
        <h1>Hello, ${req.session.username}!</h1>
        <p><a href="/members">Go to Members Page</a> | <a href="/logout">Logout</a></p>
      `);
    }
  });

//signup
app.get('/signup', (req, res) => {
    res.send(`
        <h1>Sign Up</h1>
        <form action="/signup" method="POST">
            Name: <input name="name" required />
            Email: <input name="email" type="email" required />
            Password: <input name="password" type="password" required />
            <button type="submit"> Register</button>
        </form>
    `);
});

const Joi = require('joi');
const bcrypt = require('bcrypt');

const signupSchema = Joi.object({
    name: Joi.string().min(1).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
});

const client = new MongoClient(process.env.MONGODB_URI);
let usersCollection;

// Connect once when server starts
client.connect().then(() => {
  const db = client.db(process.env.MONGODB_DATABASE);
  usersCollection = db.collection('users');
  console.log('✅ Connected to MongoDB for signup');
}).catch(console.error);

app.post('/signup', async (req, res) => {
    try {
      const { name, email, password } = req.body;
  
      const validation = signupSchema.validate({ name, email, password });
      if (validation.error) {
        return res.send(`<p>Validation error: ${validation.error.details[0].message}</p><a href="/signup">Back</a>`);
      }
  
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return res.send(`<p>Email already registered. Try logging in.</p><a href="/login">Login</a>`);
      }
  
      const hashedPassword = await bcrypt.hash(password, 12);
  
      const result = await usersCollection.insertOne({
        name,
        email,
        password: hashedPassword
      });
  
      console.log("✅ User inserted:", result.insertedId);
  
      req.session.username = name;
      res.redirect('/members');
  
    } catch (err) {
      console.error("❌ Signup error:", err);
      res.status(500).send("Internal server error. Check server logs.");
    }
  });
  
  // members page
  const fs = require('fs');
  const path = require('path');
  
  app.get('/members', (req, res) => {
    if (!req.session.username) {
      return res.redirect('/');
    }
  
    const imageDir = path.join(__dirname, 'public/images');
    const images = fs.readdirSync(imageDir);
    const randomImage = images[Math.floor(Math.random() * images.length)];
  
    res.send(`
      <h1>Welcome, ${req.session.username}!</h1>
      <p><a href="/logout">Logout</a></p>
      <img src="/images/${randomImage}" style="max-width: 300px; height: auto;" alt="Random image">
    `);
  });
  
//logout page
  app.get('/logout', (req, res) => {
    req.session.destroy(err => {
      if (err) {
        return res.send("Error logging out");
      }
      res.redirect('/');
    });
  });
  
//login
  app.get('/login', (req, res) => {
    res.send(`
      <h1>Login</h1>
      <form method="POST" action="/login">
        Email: <input name="email" type="email" required /><br>
        Password: <input name="password" type="password" required /><br>
        <button type="submit">Log In</button>
      </form>
      <p><a href="/signup">Don't have an account? Sign up</a></p>
    `);
  });
  
  //login POST
  app.post('/login', async (req, res) => {
    const { email, password } = req.body;
  
    // Validate input
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required()
    });
  
    const validation = schema.validate({ email, password });
    if (validation.error) {
      return res.send(`<p>Invalid input: ${validation.error.details[0].message}</p><a href="/login">Back to login</a>`);
    }
  
    try {
      const user = await usersCollection.findOne({ email });
  
      if (!user) {
        return res.send(`<p>User not found.</p><a href="/login">Try again</a>`);
      }
  
      const isValidPassword = await bcrypt.compare(password, user.password);
  
      if (!isValidPassword) {
        return res.send(`<p>Incorrect password.</p><a href="/login">Try again</a>`);
      }
  
      req.session.username = user.name;
      res.redirect('/members');
  
    } catch (err) {
      console.error("❌ Login error:", err);
      res.status(500).send("Internal server error. Check logs.");
    }
  });
  
  // Handle 404
app.use((req, res) => {
    res.status(404).send(`
      <h1>404 - Page Not Found</h1>
      <p>Sorry, the page you are looking for does not exist.</p>
      <a href="/">Back to Home</a>
    `);
  });
  
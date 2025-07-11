const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();
const app = express();

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// DB Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect(err => {
  if (err) throw err;
  console.log('MySQL Connected...');
});

// Routes
app.post('/login', (req, res) => {
  if (req.session.username) {
    res.redirect('/home');
   // res.send(`Welcome ${req.session.username}! <a href="/logout">Logout</a>`);
  } else {
    res.redirect('/login');
  }
});

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('login', { error: 'All fields are required' });
  }

  db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
    if (err) throw err;

    if (results.length > 0) {
      const match = await bcrypt.compare(password, results[0].password_hash);
      if (match) {
        req.session.username = username;
        return res.redirect('/home');
      }
    }
    res.render('login', { error: 'Invalid username or password' });
  });
});

app.get('/register', (req, res) => {
  res.render('register', { error: null });
});

app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.render('register', { error: 'All fields are required' });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    db.query('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, hashed],
      (err) => {
        if (err) {
          console.error(err);
          return res.render('register', { error: 'Username or email may already be taken.' });
        }
        res.redirect('/login');
      }
    );
  } catch (err) {
    console.error(err);
    res.render('register', { error: 'Something went wrong. Please try again.' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

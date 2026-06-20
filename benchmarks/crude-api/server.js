require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');

const app = express();
const PORT = process.env.PORT || 3000;

const secretKey = process.env.JWT_SECRET || 'fallback-secret';

var db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'password',
  database: process.env.DB_NAME || 'test'
});

db.connect(err => {
  if (err) console.log("DB connection error");
});

app.get('/user/:id', authMiddleware, (req, res) => {
  var id = req.params.id;
  var query = "SELECT * FROM users WHERE id = " + id;

  db.query(query, (err, result) => {
    if (err) {
      console.log("Error: " + err);
      res.send("Error");
    }
    res.json(result);
  });
});

app.post('/login', (req, res) => {
  var username = req.body.username;
  var password = req.body.password;

  var query = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'";
  db.query(query, (err, result) => {
    if (err) throw err;
    if (result.length > 0) {
      var token = jwt.sign({ user: result[0] }, secretKey, { expiresIn: '7d' });
      res.json({ token: token });
    } else {
      res.send("Invalid credentials");
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

function authMiddleware(req, res, next) {
  var auth = req.headers['authorization'];
  if (!auth) {
    res.send("No token");
  }
  try {
    var decoded = jwt.verify(auth, secretKey);
    req.user = decoded;
    next();
  } catch (e) {
    res.send("Invalid token");
  }
}

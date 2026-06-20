require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const initSqlJs = require('sql.js');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const secretKey = process.env.JWT_SECRET || 'fallback-secret';
const DB_PATH = process.env.SQLITE_PATH || './data.db';

var db;
initSqlJs().then(function(SQL) {
  try {
    var buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } catch (e) {
    db = new SQL.Database();
  }

  db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, password TEXT, role TEXT)");
  db.run("INSERT OR IGNORE INTO users (id, name, email, password, role) VALUES (1, 'Admin', 'admin@example.com', 'admin123', 'admin')");
  db.run("INSERT OR IGNORE INTO users (id, name, email, password, role) VALUES (2, 'User', 'user@example.com', 'userpass', 'user')");
  db.run("INSERT OR IGNORE INTO users (id, name, email, password, role) VALUES (3, 'Test', 'test@example.com', 'test123', 'viewer')");
});

app.get('/user/:id', authMiddleware, (req, res) => {
  var id = req.params.id;
  var query = "SELECT * FROM users WHERE id = " + id;

  try {
    var result = db.exec(query);
    if (result.length > 0) {
      var cols = result[0].columns;
      var rows = result[0].values.map(function(v) {
        var obj = {};
        cols.forEach(function(c, i) { obj[c] = v[i]; });
        return obj;
      });
      res.json(rows);
    } else {
      res.json([]);
    }
  } catch (err) {
    console.log("Error: " + err);
    res.send("Error");
  }
});

app.post('/login', (req, res) => {
  var username = req.body.username;
  var password = req.body.password;
  var query = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'";

  try {
    var result = db.exec(query);
    if (result.length > 0) {
      var cols = result[0].columns;
      var row = {};
      cols.forEach(function(c, i) { row[c] = result[0].values[0][i]; });
      var token = jwt.sign({ user: row }, secretKey, { expiresIn: '7d' });
      res.json({ token: token });
    } else {
      res.send("Invalid credentials");
    }
  } catch (err) {
    throw err;
  }
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

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db');
const { isAllowedClientOrigin } = require('./site-origin');
const cleanupExpiredContent = require('./cleanup-expired');


// Route Imports
const { authRouter } = require('./routes/auth');
const { audioRouter } = require('./routes/audio'); 
const imageRouter = require('./routes/image'); 
const noteRouter = require('./routes/note'); 
const shopRouter = require("./routes/shop");
const adminRouter = require("./routes/admin");
const skinRouter = require("./routes/skin");
const userRouter = require("./routes/user");


const app = express();
const PORT = Number(process.env.PORT || 3000);

// Middleware Setup
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || isAllowedClientOrigin(origin)),
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
  exposedHeaders: ['X-Skin-Id', 'Content-Range', 'Accept-Ranges', 'Content-Length']
}));
const publicDirectory = path.join(__dirname, '..', 'frontend', 'public');
app.use(express.static(publicDirectory));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }))

app.set('pool', pool);
// Route Routing Assignments
app.use("/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/audio", audioRouter); 
app.use("/api/image", imageRouter);
app.use("/api/note", noteRouter);
app.use("/api/shop", shopRouter);
app.use("/api/admin", adminRouter);
app.use("/api/skin", skinRouter);

app.use((req, res) => {
  if (req.accepts('html')) {
    return res.status(404).type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Page not found | Showoff Links</title>
    <style>
      :root { color-scheme: dark; font-family: system-ui, sans-serif; background: #111019; color: #f5f3ff; }
      body { min-height: 100vh; margin: 0; display: grid; place-items: center; }
      main { max-width: 420px; padding: 32px; text-align: center; }
      h1 { margin: 0 0 10px; font-size: 30px; }
      p { margin: 0 0 24px; color: #c4b8d8; line-height: 1.6; }
      a { display: inline-block; padding: 11px 16px; border-radius: 8px; background: #c084fc; color: #1b1025; font-weight: 700; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>
      <h1>Page not found</h1>
      <p>The link may be incorrect or this page is no longer available.</p>
      <a href="/">Back to Showoff Links</a>
    </main>
  </body>
</html>`);
  }
  res.status(404).json({ error: 'Not found.' });
});

// Core Listener Interface
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  cleanupExpiredContent(pool);
  const cleanupTimer = setInterval(() => cleanupExpiredContent(pool), 5 * 60 * 1000);
  cleanupTimer.unref();
});

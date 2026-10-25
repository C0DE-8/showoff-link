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
    return res.status(404).sendFile(path.join(publicDirectory, '404.html'));
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

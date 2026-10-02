const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db');


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
const PORT = 3000;

// Middleware Setup
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'PUT'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.static(path.join(__dirname, 'public')));
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

// Core Listener Interface
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
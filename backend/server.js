const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const cors = require('cors');
const path = require('path');

// Route Imports
const { authRouter } = require('./routes/auth');
const { audioRouter } = require('./routes/audio'); 
const imageRouter = require('./routes/image'); 
const noteRouter = require('./routes/note'); 
const shopRouter = require("./routes/shop");
const adminRouter = require("./routes/admin");
const skinRouter = require("./routes/skin");
const userRouter = require("./routes/user");
const flowRouter=require("./routes/flowHub");
const adminFlowRouter=require("./routes/adminFlow")


// Configure multer to hold the audio file in memory buffers
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

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

// Neon Serverless Connection String Config
const connectionString = "postgresql://neondb_owner:npg_Qfgshw8AC7ja@ep-dawn-base-atko4twl-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

// Optimized Database Pooling Engine for Serverless Infrastructures
const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: true, // Neon uses valid certificates; keep true for security
  },
});

// Bind database management pool globally to express context framework
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
app.use("/api/flow", flowRouter);
app.use("/api/adminFlow", adminFlowRouter);

// Core Listener Interface
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
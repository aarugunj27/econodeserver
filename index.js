const express = require("express");
const cors = require("cors");
require("dotenv").config(); // Load environment variables

const app = express();
const PORT = process.env.PORT || 5000; // Allow dynamic port setting, for example, on Heroku

// Middleware
app.use(cors());
app.use(express.json()); // for parsing application/json

// Import the EcoScore and Auth routes
const ecoScoreRoutes = require("./routes/ecoScore");
const AccountRoutes = require("./routes/auth");

// Use the routes
app.use("/api", ecoScoreRoutes);
app.use("/auth", AccountRoutes);

// Default route to ensure server is working
app.get("/", (req, res) => {
  res.send("Server is up and running!");
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

const mysql = require("mysql2"); // Use mysql2 instead of mysql
require("dotenv").config();

// Set up the database connection using createConnection for XAMPP
const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "signup", // Ensure this matches your database name
  port: process.env.DB_PORT || 14092,
});

// Connect to the MySQL database
db.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err);
    process.exit(1);
  }
  console.log("Connected to MySQL!");
});

// Create the tables (login and eco_scores) if they don't exist
const createTables = () => {
  const createLoginTableQuery = `
    CREATE TABLE IF NOT EXISTS login (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      isVerified TINYINT DEFAULT 0 CHECK (isVerified IN (0, 1)),
      verificationToken VARCHAR(32)
    );
  `;

  const createEcoScoreTableQuery = `
    CREATE TABLE IF NOT EXISTS eco_scores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      total_score FLOAT NOT NULL,
      transportation_score FLOAT NOT NULL,
      home_score FLOAT NOT NULL,
      food_score FLOAT NOT NULL,
      shopping_score FLOAT NOT NULL,
      travel_score FLOAT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES login(id) ON DELETE CASCADE
    );
  `;

  db.query(createLoginTableQuery, (err) => {
    if (err) {
      console.error("Error creating login table:", err);
    } else {
      console.log("Login table setup complete.");
    }
  });

  db.query(createEcoScoreTableQuery, (err) => {
    if (err) {
      console.error("Error creating eco score table:", err);
    } else {
      console.log("User eco scores table setup complete.");
    }
  });
};

// Call the function to create tables
createTables();

module.exports = db;

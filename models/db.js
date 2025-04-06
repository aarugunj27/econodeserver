const mysql = require("mysql");
require("dotenv").config();
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// SSL Certificate handling - create file synchronously before connection
let caFilePath = process.env.SSL_CA_CERT || "./ca.pem";

if (process.env.CA_CERT_BASE64) {
  try {
    // For Railway: decode base64 certificate from environment variable
    const caCert = Buffer.from(process.env.CA_CERT_BASE64, "base64").toString(
      "utf-8"
    );

    // Write to a file in the current working directory
    caFilePath = path.join(process.cwd(), "railway-ca.pem");
    fs.writeFileSync(caFilePath, caCert);
    console.log("✅ SSL certificate written to", caFilePath);
  } catch (err) {
    console.error("❌ Error creating SSL certificate file:", err);
    process.exit(1);
  }
}

// Set up the database connection using createConnection for XAMPP
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME, // Ensure this matches your database name
  ssl: {
    ca: fs.readFileSync(caFilePath), // Read from file
    rejectUnauthorized: true,
  },
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

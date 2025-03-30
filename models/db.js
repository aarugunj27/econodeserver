const mysql = require("mysql2");
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

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "signup",
  port: process.env.DB_PORT || 14092,
  ssl: {
    ca: fs.readFileSync(caFilePath), // Read from file
    rejectUnauthorized: true,
  },
  connectTimeout: 10000,
  charset: "utf8mb4",
};

// Create connection pool for better performance
const db = mysql.createPool(dbConfig);

// Verify connection with promise wrapper
const verifyConnection = () =>
  new Promise((resolve, reject) => {
    db.getConnection((err, connection) => {
      if (err) {
        console.error("❌ MySQL connection failed:");
        console.error(err.code, err.message);
        reject(err);
      } else {
        console.log("✅ Connected to MySQL!");
        connection.release();
        resolve();
      }
    });
  });

// Table creation with transactions
const createTables = async () => {
  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    // Create login table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS login (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        isVerified TINYINT DEFAULT 0,
        verificationToken VARCHAR(32),
        INDEX idx_email (email)
      );
    `);

    // Create eco_scores table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS eco_scores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        total_score FLOAT NOT NULL CHECK (total_score >= 0),
        transportation_score FLOAT NOT NULL,
        home_score FLOAT NOT NULL,
        food_score FLOAT NOT NULL,
        shopping_score FLOAT NOT NULL,
        travel_score FLOAT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES login(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id)
      );
    `);

    await connection.commit();
    console.log("🗃️  Database schema initialized successfully");
  } catch (err) {
    await connection.rollback();
    console.error("💥 Database initialization failed:");
    console.error(err);
    process.exit(1);
  } finally {
    connection.release();
  }
};

// Cleanup temporary certificate file on process exit
process.on("exit", () => {
  const tempCertPath = path.join(process.cwd(), "temp-ca.pem");
  if (fs.existsSync(tempCertPath)) {
    try {
      fs.unlinkSync(tempCertPath);
    } catch (err) {
      console.error("Failed to clean up temporary certificate file", err);
    }
  }
});

// Initialize database
(async () => {
  try {
    await verifyConnection();
    await createTables();
  } catch (err) {
    process.exit(1);
  }
})();

module.exports = db.promise(); // Export promise-based interface

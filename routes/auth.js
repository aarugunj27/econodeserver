const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../models/db");
const { sendVerificationEmail } = require("./email");
require("dotenv").config();

// Sign Up
router.post("/signup", (req, res) => {
  const { name, email, password } = req.body;

  const checkUserSql = "SELECT * FROM login WHERE email = ?";
  db.query(checkUserSql, [email], async (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });

    if (results.length > 0) {
      return res.status(409).json({ message: "Email already exists" });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const verificationToken = crypto.randomBytes(16).toString("hex");

      const insertUserSql =
        "INSERT INTO login (name, email, password, isVerified, verificationToken) VALUES (?, ?, ?, ?, ?)";
      db.query(
        insertUserSql,
        [name, email, hashedPassword, 0, verificationToken],
        (err) => {
          if (err) {
            return res.status(500).json({ message: "Database error" });
          }

          sendVerificationEmail(email, verificationToken);
          return res
            .status(201)
            .json({ message: "User created, verification email sent" });
        }
      );
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });
});

// Email Verification
router.post("/verify-email/:verificationToken", async (req, res) => {
  const { verificationToken } = req.params;

  try {
    // Query to find the user by the verification token
    db.query(
      "SELECT * FROM login WHERE verificationToken = ?",
      [verificationToken],
      (err, results) => {
        if (err) {
          return res.status(500).json({ message: "Database error." });
        }

        if (results.length === 0) {
          return res
            .status(404)
            .json({ message: "Invalid verification link." });
        }

        // Update the user’s isVerified field to 1 (true)
        db.query(
          "UPDATE login SET isVerified = 1 WHERE verificationToken = ?",
          [verificationToken],
          (updateErr) => {
            if (updateErr) {
              return res
                .status(500)
                .json({ message: "Error updating status." });
            }

            return res
              .status(200)
              .json({ message: "Email successfully verified." });
          }
        );
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Internal server error." });
  }
});

// Login
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  const sql = "SELECT * FROM login WHERE email = ?";
  db.query(sql, [email], async (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });

    if (results.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = results[0];

    if (!user.isVerified) {
      return res.status(403).json({ message: "Please verify your email" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ userID: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    const { password: _, ...userData } = user;
    res.status(200).json({ message: "Success", token, userData });
  });
});

router.post("/delete-account", (req, res) => {
  const { email } = req.body;

  const sql = "DELETE FROM login WHERE email = ?";
  db.query(sql, [email], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });

    if (results.affectedRows === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.status(200).json({ message: "Success" });
  });
});

module.exports = router;

const express = require("express");
const router = express.Router();
const db = require("../models/db");
const jwt = require("jsonwebtoken");

// Calculate Eco Score
router.post("/calculate-eco-score", (req, res) => {
  try {
    const {
      energyConsumption = 0,
      transportation = "",
      carType = "",
      recyclingRate = 0,
      waterUsage = 0,
    } = req.body;

    let ecoScore = 0;

    // Energy Consumption
    const energyMax = 25;
    const energyScore = Math.max(0, energyMax - energyConsumption / 10);
    ecoScore += energyScore;

    // Transportation
    const transportMax = 25;
    if (transportation === "car") {
      ecoScore +=
        carType === "electric"
          ? transportMax
          : carType === "hybrid"
          ? transportMax * 0.75
          : transportMax * 0.5;
    } else if (transportation === "public_transport") {
      ecoScore += transportMax * 0.8;
    } else if (transportation === "bicycle") {
      ecoScore += transportMax;
    }

    // Recycling Rate
    const recyclingMax = 20;
    const recyclingScore = (Math.min(recyclingRate, 100) / 100) * recyclingMax;
    ecoScore += recyclingScore;

    // Water Usage
    const waterMax = 20;
    const waterScore = Math.max(0, waterMax - waterUsage / 10);
    ecoScore += waterScore;

    ecoScore = Math.min(ecoScore, 100);

    return res.json({ ecoScore: parseFloat(ecoScore.toFixed(2)) });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Save Eco Score
router.post("/save-eco-score", (req, res) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "User not authenticated" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userID;

    if (!userId) {
      return res.status(400).json({ message: "User ID not found in token" });
    }

    const { score, breakdown } = req.body;

    const sql = `
      INSERT INTO eco_scores (
        user_id, 
        total_score, 
        transportation_score, 
        home_score, 
        food_score, 
        shopping_score, 
        travel_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      userId,
      score,
      breakdown.transportation,
      breakdown.home,
      breakdown.food,
      breakdown.shopping,
      breakdown.travel,
    ];

    db.query(sql, values, (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({
          message: "Error saving eco score",
          error: err.message,
        });
      }
      return res.status(201).json({
        message: "Eco score saved successfully",
        scoreId: result.insertId,
      });
    });
  } catch (err) {
    console.error("Token verification error:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
});

// Get Saved Eco Scores
router.get("/get-eco-scores", (req, res) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "User not authenticated" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userID;
    if (!userId) {
      return res.status(400).json({ message: "User ID not found in token" });
    }
    // Query the database for saved Eco Scores with all breakdown details
    const sql = `
      SELECT 
        id,
        total_score as score, 
        transportation_score as transportation,
        home_score as home,
        food_score as food,
        shopping_score as shopping,
        travel_score as travel,
        created_at
      FROM eco_scores 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `;
    db.query(sql, [userId], (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({
          message: "Error retrieving eco scores",
          error: err.message,
        });
      }
      // Process results to match frontend expectations
      const processedResults = results.map((score) => ({
        id: score.id,
        score: score.score,
        created_at: score.created_at,
        breakdown: {
          transportation: score.transportation,
          home: score.home,
          food: score.food,
          shopping: score.shopping,
          travel: score.travel,
        },
        comparisonToAverage: Math.round(((score.score - 4.8) / 4.8) * 100),
      }));

      return res.status(200).json({
        ecoScores: processedResults,
      });
    });
  } catch (err) {
    console.error("Token verification error:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
});

router.delete("/delete-eco-score/:scoreId", (req, res) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  const scoreId = req.params.scoreId;

  // Extensive logging
  console.log("Delete Eco Score Request:");
  console.log("Token:", token ? "Present" : "Missing");
  console.log("Score ID:", scoreId);

  // Validate input
  if (!token) {
    console.log("Authentication Failed: No token");
    return res.status(401).json({ message: "User not authenticated" });
  }

  if (!scoreId) {
    console.log("Validation Failed: No Score ID");
    return res.status(400).json({ message: "Score ID is required" });
  }

  try {
    // Verify the JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userID;

    console.log("Decoded User ID:", userId);

    if (!userId) {
      console.log("Validation Failed: No User ID in token");
      return res.status(400).json({ message: "User ID not found in token" });
    }

    // First, verify that the eco score belongs to the user
    const checkOwnershipQuery = `
      SELECT user_id, id
      FROM eco_scores 
      WHERE id = ? AND user_id = ?
    `;

    db.query(
      checkOwnershipQuery,
      [scoreId, userId],
      (checkErr, checkResults) => {
        console.log("Ownership Check Results:", checkResults);

        if (checkErr) {
          console.error("Database error during ownership check:", checkErr);
          return res.status(500).json({
            message: "Error verifying eco score ownership",
            error: checkErr.message,
          });
        }

        // If no matching record found, the score doesn't exist or doesn't belong to the user
        if (checkResults.length === 0) {
          console.log("No matching score found for this user");
          return res.status(404).json({
            message:
              "Eco score not found or you do not have permission to delete it",
          });
        }

        // If ownership is confirmed, proceed with deletion
        const deleteQuery = `
        DELETE FROM eco_scores 
        WHERE id = ? AND user_id = ?
      `;

        db.query(deleteQuery, [scoreId, userId], (deleteErr, deleteResult) => {
          console.log("Delete Operation Result:", deleteResult);

          if (deleteErr) {
            console.error("Database error during deletion:", deleteErr);
            return res.status(500).json({
              message: "Error deleting eco score",
              error: deleteErr.message,
            });
          }

          // Check if any rows were actually deleted
          if (deleteResult.affectedRows === 0) {
            console.log("No rows deleted");
            return res.status(404).json({
              message: "Eco score not found or already deleted",
            });
          }

          // Successful deletion
          console.log(`Eco score ${scoreId} deleted successfully`);
          return res.status(200).json({
            message: "Eco score deleted successfully",
            deletedScoreId: scoreId,
          });
        });
      }
    );
  } catch (err) {
    console.error("Token verification error:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
});
module.exports = router;

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// A simple test route
app.get('/', (req, res) => {
  res.send('eBarangayMo API is running!');
});

// A route to test our database connection
app.get('/test-db', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT "Database Connected Successfully!" AS message');
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Database connection failed', details: error.message });
  }
});

// --- API ROUTES ---

// 1. Get all blotters (Read)
app.get('/api/blotters', async (req, res) => {
  try {
    const [blotters] = await db.query('SELECT * FROM blotters ORDER BY created_at DESC');
    res.json(blotters);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch blotters', details: error.message });
  }
});

// 2. Add a new blotter (Create)
app.post('/api/blotters', async (req, res) => {
  try {
    // Destructure all the new fields from the incoming request
    const { 
      incident_type, status, incident_datetime, sitio, landmark, 
      complainant_name, complainant_contact, complainant_sitio, complainant_resident_status, 
      respondent_name, respondent_contact, respondent_sitio, respondent_resident_status, 
      narrative, barangay_id = 'Subangdaku', city_id = 'Mandaue', created_by = 'Desk Officer' 
    } = req.body;

    // --- ID GENERATION LOGIC ---
    // 1. Get the current year
    const currentYear = new Date().getFullYear();
    
    // 2. Create the prefix (e.g., BLOT-SUB-2026-)
    const brgyPrefix = barangay_id.substring(0, 3).toUpperCase(); // Takes 'Subangdaku' and makes it 'SUB'
    const idPrefix = `BLOT-${brgyPrefix}-${currentYear}-`;

    // 3. Check the database for the last used ID with this prefix
    const [rows] = await db.query(
      `SELECT case_id FROM blotters WHERE case_id LIKE ? ORDER BY id DESC LIMIT 1`,
      [`${idPrefix}%`]
    );

    let nextSequence = 1; // Default to 1 if it's the first blotter of the year
    if (rows.length > 0) {
      // Extract the last 5 digits from the previous ID and add 1
      const lastCaseId = rows[0].case_id;
      const lastNumber = parseInt(lastCaseId.split('-').pop(), 10);
      nextSequence = lastNumber + 1;
    }

    // 4. Format the final ID (pads with leading zeros, e.g., 00005)
    const paddedSequence = nextSequence.toString().padStart(5, '0');
    const generatedCaseId = `${idPrefix}${paddedSequence}`;

    // --- INSERT INTO DATABASE ---
    const query = `
      INSERT INTO blotters 
      (case_id, incident_type, status, incident_datetime, sitio, landmark, 
       complainant_name, complainant_contact, complainant_sitio, complainant_resident_status, 
       respondent_name, respondent_contact, respondent_sitio, respondent_resident_status, 
       narrative, barangay_id, city_id, created_by) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      generatedCaseId, incident_type, status || 'Pending Lupon', incident_datetime, sitio, landmark || '',
      complainant_name, complainant_contact || '', complainant_sitio || '', complainant_resident_status || 'Resident',
      respondent_name, respondent_contact || '', respondent_sitio || '', respondent_resident_status || 'Resident',
      narrative, barangay_id, city_id, created_by
    ];
    
    const [result] = await db.query(query, values);
    
    res.status(201).json({ 
      message: 'Blotter created successfully!', 
      case_id: generatedCaseId,
      id: result.insertId 
    });
  } catch (error) {
    console.error("Database Insert Error:", error);
    res.status(500).json({ error: 'Failed to create blotter', details: error.message });
  }
});

// 3. Update blotter status (Update)
app.put('/api/blotters/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const query = 'UPDATE blotters SET status = ? WHERE id = ?';
    const [result] = await db.query(query, [status, id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Blotter not found' });
    }
    
    res.json({ message: 'Status updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status', details: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
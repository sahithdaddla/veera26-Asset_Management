const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*', // Allow all origins; adjust to specific origins (e.g., 'http://localhost:5500') for production
  methods: ['GET', 'POST', 'DELETE', 'PUT'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'asset_management',
  password: process.env.DB_PASSWORD || 'Veera@0134',
  port: process.env.DB_PORT || 5432,
});

// Utility function to format dates
const formatDate = (date) => {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Initialize database tables
async function initializeDatabase() {
  try {
    console.log('Initializing database tables...');

    // Create asset_deliveries table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS asset_deliveries (
        id SERIAL PRIMARY KEY,
        employee_name VARCHAR(30) NOT NULL,
        employee_id VARCHAR(7) NOT NULL,
        department VARCHAR(50) NOT NULL,
        assets JSONB NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table asset_deliveries created or already exists');

    // Create asset_requests table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS asset_requests (
        id SERIAL PRIMARY KEY,
        employee_name VARCHAR(30) NOT NULL,
        employee_id VARCHAR(7) NOT NULL,
        asset_name VARCHAR(100) NOT NULL,
        reason TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table asset_requests created or already exists');

    // Create assigned_assets table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS assigned_assets (
        id SERIAL PRIMARY KEY,
        employee_name VARCHAR(30) NOT NULL,
        employee_id VARCHAR(7) NOT NULL,
        asset_name VARCHAR(100) NOT NULL,
        assigned_date DATE NOT NULL,
        status VARCHAR(20) NOT NULL
      );
    `);
    console.log('Table assigned_assets created or already exists');

    // Create rejected_requests table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rejected_requests (
        id SERIAL PRIMARY KEY,
        employee_name VARCHAR(30) NOT NULL,
        employee_id VARCHAR(7) NOT NULL,
        asset_name VARCHAR(100) NOT NULL,
        reason TEXT NOT NULL,
        rejected_date DATE NOT NULL,
        status VARCHAR(20) NOT NULL
      );
    `);
    console.log('Table rejected_requests created or already exists');

    // Optional: Insert sample data for testing (comment out in production)
    const insertSampleData = true; // Set to false to skip sample data insertion
    if (insertSampleData) {
      await pool.query(`
        INSERT INTO asset_deliveries (employee_name, employee_id, department, assets)
        VALUES ('Veera', 'ATS0001', 'IT', '["Laptop", "Monitor"]')
        ON CONFLICT DO NOTHING;
      `);
      await pool.query(`
        INSERT INTO asset_requests (employee_name, employee_id, asset_name, reason)
        VALUES ('Veera', 'ATS0001', 'Laptop', 'Need for development work')
        ON CONFLICT DO NOTHING;
      `);
      await pool.query(`
        INSERT INTO assigned_assets (employee_name, employee_id, asset_name, assigned_date, status)
        VALUES ('Veera', 'ATS0001', 'MacBook Pro', '2024-10-15', 'Assigned')
        ON CONFLICT DO NOTHING;
      `);
      await pool.query(`
        INSERT INTO rejected_requests (employee_name, employee_id, asset_name, reason, rejected_date, status)
        VALUES ('Raghava', 'ATS0002', 'Monitor', 'Not needed', '2024-10-15', 'Rejected')
        ON CONFLICT DO NOTHING;
      `);
      console.log('Sample data inserted');
    }

    console.log('Database initialization completed');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1); // Exit if table creation fails
  }
}

// Test database connection and initialize tables on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('Database connection error:', err.stack);
    process.exit(1);
  }
  console.log('Connected to database');
  release();
  // Initialize tables after connection is confirmed
  initializeDatabase();
});

// Page 1: Asset Delivery Form - Save asset delivery
app.post('/api/deliveries', async (req, res) => {
  const { employeeName, employeeId, department, assets } = req.body;
  console.log('Received delivery:', { employeeName, employeeId, department, assets });

  // Validate input
  if (!employeeName || !employeeId || !department || !Array.isArray(assets) || assets.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid required fields' });
  }

  try {
    const assetsJson = JSON.stringify(assets);
    const result = await pool.query(
      'INSERT INTO asset_deliveries (employee_name, employee_id, department, assets, timestamp) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING *',
      [employeeName, employeeId, department, assetsJson]
    );
    console.log('Delivery saved:', result.rows[0]);
    res.status(201).json({
      ...result.rows[0],
      timestamp: formatDate(result.rows[0].timestamp)
    });
  } catch (error) {
    console.error('Error saving delivery:', error);
    res.status(500).json({ error: 'Failed to save delivery' });
  }
});

// Page 1: Submit a new asset request
app.post('/api/requests', async (req, res) => {
  const { employeeName, employeeId, assetName, reason } = req.body;
  console.log('Received request:', { employeeName, employeeId, assetName, reason });

  // Validate input
  if (!employeeName || !employeeId || !assetName || !reason) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO asset_requests (employee_name, employee_id, asset_name, reason, timestamp) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING *',
      [employeeName, employeeId, assetName, reason]
    );
    console.log('Request saved:', result.rows[0]);
    res.status(201).json({
      ...result.rows[0],
      timestamp: formatDate(result.rows[0].timestamp)
    });
  } catch (error) {
    console.error('Error saving request:', error);
    res.status(500).json({ error: 'Failed to save request' });
  }
});

// Page 2: HR Asset Management - Get all asset deliveries with filtering and pagination
// Page 2: HR Asset Management - Get all asset deliveries with filtering
app.get('/api/deliveries', async (req, res) => {
  const { search, department, sortBy, all } = req.query;
  let query = 'SELECT * FROM asset_deliveries WHERE 1=1';
  let countQuery = 'SELECT COUNT(*) FROM asset_deliveries WHERE 1=1';
  const params = [];

  console.log('Fetching deliveries with query:', { search, department, sortBy, all });

  // Search filter
  if (search) {
    query += ' AND (employee_name ILIKE $1 OR employee_id ILIKE $1 OR department ILIKE $1 OR assets::text ILIKE $1)';
    countQuery += ' AND (employee_name ILIKE $1 OR employee_id ILIKE $1 OR department ILIKE $1 OR assets::text ILIKE $1)';
    params.push(`%${search}%`);
  }

  // Department filter
  if (department) {
    params.push(department);
    query += ` AND department = $${params.length}`;
    countQuery += ` AND department = $${params.length}`;
  }

  // Sorting
  switch (sortBy) {
    case 'timestamp-desc':
      query += ' ORDER BY timestamp DESC';
      break;
    case 'timestamp-asc':
      query += ' ORDER BY timestamp ASC';
      break;
    case 'name-asc':
      query += ' ORDER BY employee_name ASC';
      break;
    case 'name-desc':
      query += ' ORDER BY employee_name DESC';
      break;
    default:
      query += ' ORDER BY timestamp DESC';
  }

  try {
    let deliveriesResult;
    let total;

    if (all === 'true') {
      // Fetch all records without pagination
      deliveriesResult = await pool.query(query, params);
      total = deliveriesResult.rows.length;
    } else {
      // Apply pagination (keep existing logic for compatibility)
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 5;
      const offset = (page - 1) * limit;

      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const [result, countResult] = await Promise.all([
        pool.query(query, params),
        pool.query(countQuery, params.slice(0, params.length - 2)),
      ]);

      deliveriesResult = result;
      total = parseInt(countResult.rows[0].count, 10);
    }

    console.log('Deliveries fetched:', deliveriesResult.rows.length, 'Total:', total);

    res.json({
      deliveries: deliveriesResult.rows.map(row => ({
        ...row,
        timestamp: formatDate(row.timestamp),
      })),
      total,
      pages: all === 'true' ? 1 : Math.ceil(total / (parseInt(req.query.limit) || 5)),
    });
  } catch (error) {
    console.error('Error fetching deliveries:', error);
    res.status(500).json({ error: 'Failed to fetch deliveries' });
  }
});

// Page 3: Asset Management Dashboard - Get all assigned assets
app.get('/api/assigned-assets', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM assigned_assets ORDER BY assigned_date DESC');
    console.log('Assigned assets fetched:', result.rows.length);
    res.json(result.rows.map(row => ({
      ...row,
      assignedDate: formatDate(row.assigned_date),
    })));
  } catch (error) {
    console.error('Error fetching assigned assets:', error);
    res.status(500).json({ error: 'Failed to fetch assigned assets' });
  }
});

// Page 3: Get all rejected requests
app.get('/api/rejected-requests', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rejected_requests ORDER BY rejected_date DESC');
    console.log('Rejected requests fetched:', result.rows.length);
    res.json(result.rows.map(row => ({
      ...row,
      rejectedDate: formatDate(row.rejected_date),
    })));
  } catch (error) {
    console.error('Error fetching rejected requests:', error);
    res.status(500).json({ error: 'Failed to fetch rejected requests' });
  }
});

// Page 3: Get all pending asset requests
app.get('/api/requests', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM asset_requests ORDER BY timestamp DESC');
    console.log('Pending requests fetched:', result.rows.length);
    res.json(result.rows.map(row => ({
      ...row,
      timestamp: formatDate(row.timestamp),
    })));
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Page 3: Approve an asset request
app.post('/api/requests/approve/:id', async (req, res) => {
  const { id } = req.params;
  console.log('Approving request ID:', id);

  try {
    const requestResult = await pool.query('SELECT * FROM asset_requests WHERE id = $1', [id]);
    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = requestResult.rows[0];

    // Check for duplicate asset
    const existingAsset = await pool.query(
      'SELECT * FROM assigned_assets WHERE employee_id = $1 AND asset_name = $2',
      [request.employee_id, request.asset_name]
    );
    if (existingAsset.rows.length > 0) {
      return res.status(400).json({ error: 'This employee already has this asset assigned' });
    }

    // Insert into assigned_assets
    await pool.query(
      'INSERT INTO assigned_assets (employee_name, employee_id, asset_name, assigned_date, status) VALUES ($1, $2, $3, $4, $5)',
      [request.employee_name, request.employee_id, request.asset_name, new Date().toISOString().split('T')[0], 'Assigned']
    );

    // Delete from asset_requests
    await pool.query('DELETE FROM asset_requests WHERE id = $1', [id]);

    console.log('Request approved:', request);
    res.json({ message: 'Request approved and asset assigned' });
  } catch (error) {
    console.error('Error approving request:', error);
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

// Page 3: Reject an asset request
app.post('/api/requests/reject/:id', async (req, res) => {
  const { id } = req.params;
  console.log('Rejecting request ID:', id);

  try {
    const requestResult = await pool.query('SELECT * FROM asset_requests WHERE id = $1', [id]);
    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = requestResult.rows[0];

    // Insert into rejected_requests
    await pool.query(
      'INSERT INTO rejected_requests (employee_name, employee_id, asset_name, reason, rejected_date, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        request.employee_name,
        request.employee_id,
        request.asset_name,
        request.reason || 'No reason provided',
        new Date().toISOString().split('T')[0],
        'Rejected',
      ]
    );

    // Delete from asset_requests
    await pool.query('DELETE FROM asset_requests WHERE id = $1', [id]);

    console.log('Request rejected:', request);
    res.json({ message: 'Request rejected' });
  } catch (error) {
    console.error('Error rejecting request:', error);
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
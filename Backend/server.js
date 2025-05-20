// server.js
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  user: 'postgres', // Replace with your PostgreSQL username
  host: 'localhost',
  database: 'asset_management',
  password: 'Veera@0134', // Replace with your PostgreSQL password
  port: 5432,
});

// Helper function to format date
const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

// API Endpoints

// Page 1: Asset Delivery Form
// Submit a new asset delivery
// Page 1: Asset Delivery Form
app.post('/api/deliveries', async (req, res) => {
    const { employeeName, employeeId, department, assets } = req.body;
    try {
        // Ensure assets is a valid JSON string
        const assetsJson = JSON.stringify(assets);
        const result = await pool.query(
            'INSERT INTO asset_deliveries (employee_name, employee_id, department, assets) VALUES ($1, $2, $3, $4) RETURNING *',
            [employeeName, employeeId, department, assetsJson]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error saving delivery:', error);
        res.status(500).json({ error: 'Failed to save delivery' });
    }
});

// Submit a new asset request
app.post('/api/requests', async (req, res) => {
    const { employeeName, employeeId, assetName, reason } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO asset_requests (employee_name, employee_id, asset_name, reason) VALUES ($1, $2, $3, $4) RETURNING *',
            [employeeName, employeeId, assetName, reason]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error saving request:', error);
        res.status(500).json({ error: 'Failed to save request' });
    }
});

// Page 2: HR Asset Management
// Get all asset deliveries with filtering and pagination
app.get('/api/deliveries', async (req, res) => {
    const { search, department, sortBy, page = 1, limit = 5 } = req.query;
    const offset = (page - 1) * limit;
    let query = 'SELECT * FROM asset_deliveries WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) FROM asset_deliveries WHERE 1=1';
    const params = [];

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

    // Pagination
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    try {
        const deliveries = await pool.query(query, params);
        const countResult = await pool.query(countQuery, params.slice(0, params.length - 2));
        const total = parseInt(countResult.rows[0].count, 10);
        res.json({
            deliveries: deliveries.rows.map(row => ({
                ...row,
                timestamp: formatDate(row.timestamp),
            })),
            total,
            pages: Math.ceil(total / limit),
        });
    } catch (error) {
        console.error('Error fetching deliveries:', error);
        res.status(500).json({ error: 'Failed to fetch deliveries' });
    }
});

// Page 3: Asset Management Dashboard
// Get all assigned assets
app.get('/api/assigned-assets', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM assigned_assets ORDER BY assigned_date DESC');
        res.json(result.rows.map(row => ({
            ...row,
            assignedDate: formatDate(row.assigned_date),
        })));
    } catch (error) {
        console.error('Error fetching assigned assets:', error);
        res.status(500).json({ error: 'Failed to fetch assigned assets' });
    }
});

// Get all rejected requests
app.get('/api/rejected-requests', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM rejected_requests ORDER BY rejected_date DESC');
        res.json(result.rows.map(row => ({
            ...row,
            rejectedDate: formatDate(row.rejected_date),
        })));
    } catch (error) {
        console.error('Error fetching rejected requests:', error);
        res.status(500).json({ error: 'Failed to fetch rejected requests' });
    }
});

// Get all pending asset requests
app.get('/api/requests', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM asset_requests ORDER BY timestamp DESC');
        res.json(result.rows.map(row => ({
            ...row,
            timestamp: formatDate(row.timestamp),
        })));
    } catch (error) {
        console.error('Error fetching requests:', error);
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
});

// Approve an asset request
app.post('/api/requests/approve/:id', async (req, res) => {
    const { id } = req.params;
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

        res.json({ message: 'Request approved and asset assigned' });
    } catch (error) {
        console.error('Error approving request:', error);
        res.status(500).json({ error: 'Failed to approve request' });
    }
});

// Reject an asset request
app.post('/api/requests/reject/:id', async (req, res) => {
    const { id } = req.params;
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

        res.json({ message: 'Request rejected' });
    } catch (error) {
        console.error('Error rejecting request:', error);
        res.status(500).json({ error: 'Failed to reject request' });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
const pool = require('../config/db');

// --- YOUR EXISTING FUNCTION (SHOULD BE MOVED OR REMOVED LATER) ---
// This is the old function. We have a better version in userController now.
const getDepartmentUsers = async (req, res) => {
    // ... your existing code ...
};

// === ADD THESE NEW FUNCTIONS ===

// @desc    Create a new department
// @route   POST /api/departments
// @access  Private (MANAGE_DEPARTMENTS permission)
const createDepartment = async (req, res) => {
    const { name, description } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Department name is required.' });
    }
    try {
        const newDept = await pool.query(
            'INSERT INTO Departments (name, description) VALUES ($1, $2) RETURNING *',
            [name, description || null]
        );
        res.status(201).json(newDept.rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get all departments
// @route   GET /api/departments
// @access  Private (MANAGE_USERS permission - for user creation dropdown)
const getAllDepartments = async (req, res) => {
    try {
        const depts = await pool.query('SELECT * FROM Departments ORDER BY name');
        res.json(depts.rows);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const getDepartmentUsersWithStats = async (req, res) => {
    const { deptId } = req.params;
    try {
        const query = `
            SELECT
                u.user_id,
                u.name,
                u.job_title,
                COUNT(DISTINCT up.permission_id) as permission_count,
                COUNT(DISTINCT t_assigned.task_id) as tasks_assigned_to,
                COUNT(DISTINCT t_created.task_id) as tasks_created_by
            FROM Users u
            LEFT JOIN User_Permissions up ON u.user_id = up.user_id
            LEFT JOIN Tasks t_assigned ON u.user_id = t_assigned.assignee_id
            LEFT JOIN Tasks t_created ON u.user_id = t_created.assigner_id
            WHERE u.department_id = $1
            GROUP BY u.user_id, u.name, u.job_title
            ORDER BY permission_count DESC, u.name ASC;
        `;
        const users = await pool.query(query, [deptId]);
        res.json(users.rows);
    } catch (error) {
        console.error('Error fetching department users with stats:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const updateDepartment = async (req, res) => {
    const { id } = req.params;
    const { name } = req.body; // We only expect 'name' now

    if (!name) {
        return res.status(400).json({ message: 'Department name is required.' });
    }

    try {
        // The SQL query is updated to only set the 'name'
        const updatedDept = await pool.query(
            'UPDATE Departments SET name = $1 WHERE department_id = $2 RETURNING *',
            [name, id]
        );

        if (updatedDept.rows.length === 0) {
            return res.status(404).json({ message: 'Department not found.' });
        }

        res.json(updatedDept.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ message: 'A department with this name already exists.' });
        }
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete a department
// @route   DELETE /api/departments/:id
// @access  Private (MANAGE_DEPARTMENTS permission)
const deleteDepartment = async (req, res) => {
    const { id } = req.params;
    try {
        // Note: Our database schema (ON DELETE SET NULL for Users) will handle un-assigning users automatically.
        const deleteResult = await pool.query('DELETE FROM Departments WHERE department_id = $1', [id]);

        if (deleteResult.rowCount === 0) {
            return res.status(404).json({ message: 'Department not found.' });
        }

        res.json({ message: 'Department deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
// --- UPDATE YOUR EXPORTS ---
module.exports = { 
    getDepartmentUsers, 
    createDepartment,   
    getAllDepartments,
    getDepartmentUsersWithStats,
    updateDepartment,
    deleteDepartment,  
};
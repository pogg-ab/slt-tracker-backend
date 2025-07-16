const pool = require('../config/db');

// @desc    Get individual performance report
// @route   GET /api/reports/individual/:userId
// @access  Private (Managers)
const getIndividualPerformance = async (req, res) => {
    try {
        const { userId } = req.params;
        const query = `
            SELECT 
                status, 
                COUNT(*) as task_count
            FROM Tasks
            WHERE assignee_id = $1
            GROUP BY status;
        `;
        const report = await pool.query(query, [userId]);
        res.json(report.rows);
    } catch (error) {
        console.error('Error getting individual performance report:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get department workload report
// @route   GET /api/reports/department/:deptId
// @access  Private (Managers)
const getDepartmentWorkload = async (req, res) => {
    try {
        const { deptId } = req.params;
        const query = `
            SELECT 
                u.name, 
                u.user_id,
                COUNT(t.task_id) as assigned_tasks
            FROM Users u
            LEFT JOIN Tasks t ON u.user_id = t.assignee_id
            WHERE u.department_id = $1
            GROUP BY u.user_id, u.name
            ORDER BY assigned_tasks DESC;
        `;
        const report = await pool.query(query, [deptId]);
        res.json(report.rows);
    } catch (error) {
        console.error('Error getting department workload report:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get individual timesheet report
// @route   GET /api/reports/timesheet/:userId
// @access  Private
const getIndividualTimesheet = async (req, res) => {
    try {
        const { userId } = req.params;
        const query = `
            SELECT 
                te.entry_date,
                SUM(te.duration_minutes) as total_minutes
            FROM Time_Entries te
            WHERE te.user_id = $1
            GROUP BY te.entry_date
            ORDER BY te.entry_date DESC;
        `;
        const report = await pool.query(query, [userId]);
        res.json(report.rows);
    } catch (error) {
        console.error('Error getting individual timesheet:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get department time allocation
// @route   GET /api/reports/department-time/:deptId
// @access  Private (Managers)
const getDepartmentTimeAllocation = async (req, res) => {
    try {
        const { deptId } = req.params;
        const query = `
            SELECT 
                t.title,
                t.task_id,
                SUM(te.duration_minutes) as total_minutes_spent
            FROM Time_Entries te
            JOIN Tasks t ON te.task_id = t.task_id
            WHERE t.department_id = $1
            GROUP BY t.task_id, t.title
            ORDER BY total_minutes_spent DESC;
        `;
        const report = await pool.query(query, [deptId]);
        res.json(report.rows);
    } catch (error) {
        console.error('Error getting department time allocation:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get company-wide analytics
// @route   GET /api/reports/company-overview
// @access  Private (Owners)
const getCompanyOverview = async (req, res) => {
    try {
        const [totalTasks, totalHours] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM Tasks'),
            pool.query('SELECT SUM(duration_minutes) / 60.0 as total_hours FROM Time_Entries')
        ]);
        res.json({
            total_tasks: parseInt(totalTasks.rows[0].count, 10),
            total_hours_logged: parseFloat(totalHours.rows[0].total_hours || 0).toFixed(2)
        });
    } catch (error) {
        console.error('Error getting company overview:', error);
        res.status(500).json({ message: 'Server error' });
    }
};


const getDepartmentKPIs = async (req, res) => {
    try {
        const { deptId } = req.params;

        // A single, powerful query to get all KPIs at once
        const kpiQuery = `
            SELECT
                (SELECT COUNT(*) FROM Tasks WHERE department_id = $1 AND status = 'Pending') as pending_tasks,
                
                (SELECT COUNT(*) FROM Tasks WHERE department_id = $1 AND status = 'Completed' AND updated_at >= NOW() - INTERVAL '7 days') as completed_this_week,
                
                (SELECT COALESCE(SUM(duration_minutes), 0) / 60.0 FROM Time_Entries te JOIN Tasks t ON te.task_id = t.task_id WHERE t.department_id = $1 AND te.entry_date >= NOW() - INTERVAL '7 days') as hours_this_week
        `;
        
        const kpiResult = await pool.query(kpiQuery, [deptId]);
        
        // Format the numbers nicely before sending to the frontend
        const formattedResult = {
            pending_tasks: parseInt(kpiResult.rows[0].pending_tasks, 10),
            completed_this_week: parseInt(kpiResult.rows[0].completed_this_week, 10),
            hours_this_week: parseFloat(kpiResult.rows[0].hours_this_week).toFixed(1)
        };

        res.json(formattedResult);
    } catch (error) {
        console.error('Error getting department KPIs:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getDashboardStats = async (req, res) => {
    const { user_id, permissions, department_id } = req.user;

    // Use a single, powerful query with conditional aggregation
    let query = `
        SELECT
            -- Count total tasks based on user's permission level
            COUNT(*) AS total_tasks,

            -- Count tasks with specific statuses
            COUNT(*) FILTER (WHERE status = 'In Progress') AS in_progress_tasks,
            COUNT(*) FILTER (WHERE status = 'Completed') AS completed_tasks,

            -- Count total team members if user is a manager
            (SELECT COUNT(*) FROM Users WHERE department_id = $1) as team_members_count
        FROM Tasks
    `;

    const queryParams = [department_id];
    
    // If user is not a manager/CEO, only count tasks assigned to them
    if (!permissions.includes('VIEW_ANY_TASK')) {
        query += ' WHERE assignee_id = $2';
        queryParams.push(user_id);
    } else {
         query += ' WHERE department_id = $1';
    }

    try {
        const statsResult = await pool.query(query, queryParams);
        res.json(statsResult.rows[0]);
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
// Export all functions including the new one
module.exports = {
    getIndividualPerformance,
    getDepartmentWorkload,
    getIndividualTimesheet,
    getDepartmentTimeAllocation,
    getCompanyOverview,
    getDepartmentKPIs,
    getDashboardStats,
};  
const pool = require('../config/db');

// @desc    Get pending time entries for a manager's team
// @route   GET /api/timesheets/pending
// @access  Private (Managers)
const getPendingEntries = async (req, res) => {
    const { department_id } = req.user;
    try {
        const query = `
            SELECT te.*, u.name as user_name, t.title as task_title
            FROM Time_Entries te
            JOIN Users u ON te.user_id = u.user_id
            JOIN Tasks t ON te.task_id = t.task_id
            WHERE u.department_id = $1 AND te.approval_status = 'Pending'
            ORDER BY te.entry_date ASC;
        `;
        const pendingEntries = await pool.query(query, [department_id]);
        res.json(pendingEntries.rows);
    } catch (error) {
        console.error('Error fetching pending entries:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Approve or reject a time entry
// @route   PUT /api/timesheets/entry/:entryId
// @access  Private (Managers)
const reviewTimeEntry = async (req, res) => {
    const { entryId } = req.params;
    const { status } = req.body; // Expecting 'Approved' or 'Rejected'
    const { user_id: managerId } = req.user;

    if (!status || (status !== 'Approved' && status !== 'Rejected')) {
        return res.status(400).json({ message: 'A valid status ("Approved" or "Rejected") is required.' });
    }

    try {
        const updatedEntry = await pool.query(
            `UPDATE Time_Entries 
             SET approval_status = $1::approval_status_enum, approved_by = $2 
             WHERE entry_id = $3
             RETURNING *`,
            [status, managerId, entryId]
        );

        if (updatedEntry.rows.length === 0) {
            return res.status(404).json({ message: 'Time entry not found.' });
        }

        res.json(updatedEntry.rows[0]);
    } catch (error) {
        console.error('Error reviewing time entry:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getPendingEntries,
    reviewTimeEntry,
};
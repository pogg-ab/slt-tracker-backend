const pool = require('../config/db');
// 1. Import the notification service
const { createAndSendNotification } = require('../services/notificationService');

// @desc    Create a new task
// @route   POST /api/tasks
// @access  Private
const createTask = async (req, res) => {
    const { name: assignerName, user_id: assigner_id } = req.user;
    const { title, description, priority, due_date, assignee_id, department_id } = req.body;

    if (!title || !assignee_id || !department_id) {
        return res.status(400).json({ message: 'Please provide title, assignee_id, and department_id' });
    }

    try {
        const newTaskResult = await pool.query(
            `INSERT INTO Tasks (title, description, priority, due_date, assigner_id, assignee_id, department_id) VALUES ($1, $2, $3::task_priority, $4, $5, $6, $7) RETURNING *`,
            [title, description || null, priority || 'Medium', due_date || null, assigner_id, assignee_id, department_id]
        );
        const createdTask = newTaskResult.rows[0];
        
        // --- NOTIFICATION LOGIC ---
        if (createdTask) {
            const link = `${process.env.FRONTEND_URL}/tasks/${createdTask.task_id}`;
            const message = `${assignerName} assigned you a new task: "${createdTask.title}"`;
            await createAndSendNotification(createdTask.assignee_id, 'New Task Assigned', message, link);
        }
        // --- END NOTIFICATION LOGIC ---

        res.status(201).json(createdTask);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ message: 'Server error while creating task' });
    }
};

// ... [The 'getTasks' function remains the same as your V2 version] ...
const getTasks = async (req, res) => {
    const { user_id, permissions, department_id } = req.user;
    const { status, priority, search } = req.query;
    let baseQuery = `SELECT t.*, assignee.name as assignee_name, assigner.name as assigner_name FROM Tasks t LEFT JOIN Users assignee ON t.assignee_id = assignee.user_id LEFT JOIN Users assigner ON t.assigner_id = assigner.user_id`;
    const queryParams = [];
    let whereClauses = ['t.parent_task_id IS NULL'];
    if (!permissions.includes('VIEW_ANY_TASK')) {
        queryParams.push(user_id);
        whereClauses.push(`(t.assignee_id = $${queryParams.length} OR t.assigner_id = $${queryParams.length})`);
    }
    if (status) { queryParams.push(status); whereClauses.push(`t.status = $${queryParams.length}::task_status`); }
    if (priority) { queryParams.push(priority); whereClauses.push(`t.priority = $${queryParams.length}::task_priority`); }
    if (search) { queryParams.push(`%${search}%`); whereClauses.push(`t.title ILIKE $${queryParams.length}`); }
    if (whereClauses.length > 0) { baseQuery += ' WHERE ' + whereClauses.join(' AND '); }
    baseQuery += ' ORDER BY t.created_at DESC';
    try {
        const tasks = await pool.query(baseQuery, queryParams);
        res.json(tasks.rows);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ message: 'Server error while fetching tasks' });
    }
};


// ... [The 'getTaskById' function remains the same as your V2 version] ...
const getTaskById = async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id, permissions } = req.user;
        const taskQuery = pool.query('SELECT * FROM Tasks WHERE task_id = $1', [id]);
        const commentsQuery = pool.query('SELECT c.*, u.name as user_name FROM Comments c JOIN Users u ON c.user_id = u.user_id WHERE c.task_id = $1 ORDER BY c.created_at ASC', [id]);
        const attachmentsQuery = pool.query('SELECT * FROM Attachments WHERE task_id = $1 ORDER BY uploaded_at DESC', [id]);
        const subtasksQuery = pool.query('SELECT t.*, u.name AS assignee_name FROM Tasks t LEFT JOIN Users u ON t.assignee_id = u.user_id WHERE t.parent_task_id = $1 ORDER BY t.created_at ASC', [id]);
        let timeEntriesQuery = 'SELECT t.*, u.name as user_name FROM Time_Entries t JOIN Users u ON t.user_id = u.user_id WHERE t.task_id = $1';
        const timeEntriesParams = [id];
        if (!permissions.includes('VIEW_REPORTS')) {
            timeEntriesQuery += ' AND t.user_id = $2';
            timeEntriesParams.push(user_id);
        }
        timeEntriesQuery += ' ORDER BY t.entry_date DESC';
        const timeEntriesPromise = pool.query(timeEntriesQuery, timeEntriesParams);
        const [taskResult, commentsResult, timeEntriesResult, attachmentsResult, subtasksResult] = await Promise.all([taskQuery, commentsQuery, timeEntriesPromise, attachmentsQuery, subtasksQuery]);
        if (taskResult.rows.length === 0) { return res.status(404).json({ message: 'Task not found' });}
        const task = taskResult.rows[0];
        const subtasks = subtasksResult.rows;
        if (subtasks.length > 0) {
            const completedCount = subtasks.filter(st => st.status === 'Completed').length;
            task.progress = Math.round((completedCount / subtasks.length) * 100);
        } else {
            task.progress = task.status === 'Completed' ? 100 : 0;
        }
        task.comments = commentsResult.rows;
        task.time_entries = timeEntriesResult.rows;
        task.attachments = attachmentsResult.rows;
        task.subtasks = subtasks;
        res.json(task);
    } catch (error) {
        console.error('Error fetching task by ID:', error);
        res.status(500).json({ message: 'Server error while fetching task' });
    }
};

// ... [The 'updateTask' and 'deleteTask' functions remain the same as your V2 version] ...
const updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, status, priority, due_date } = req.body;
        const { user_id, permissions, department_id } = req.user;
        const originalTaskResult = await pool.query('SELECT * FROM Tasks WHERE task_id = $1', [id]);
        if (originalTaskResult.rows.length === 0) { return res.status(404).json({ message: 'Task not found' }); }
        const originalTask = originalTaskResult.rows[0];
        const canEditAny = permissions.includes('EDIT_ANY_TASK') && originalTask.department_id === department_id;
        const canUpdateOwn = permissions.includes('UPDATE_OWN_TASK_STATUS') && originalTask.assignee_id === user_id;
        if (!canEditAny && !canUpdateOwn) { return res.status(403).json({ message: 'Forbidden: You are not authorized to update this task.' }); }
        const updatedData = {
            title: title || originalTask.title,
            description: description || originalTask.description,
            status: status || originalTask.status,
            priority: priority || originalTask.priority,
            due_date: due_date || originalTask.due_date
        };
        const updatedTaskResult = await pool.query(`UPDATE Tasks SET title = $1, description = $2, status = $3::task_status, priority = $4::task_priority, due_date = $5 WHERE task_id = $6 RETURNING *`, [updatedData.title, updatedData.description, updatedData.status, updatedData.priority, updatedData.due_date, id]);
        res.json(updatedTaskResult.rows[0]);
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ message: 'Server error while updating task' });
    }
};
const deleteTask = async (req, res) => {
    try {
        const { id } = req.params;
        const taskExists = await pool.query('SELECT * FROM Tasks WHERE task_id = $1', [id]);
        if (taskExists.rows.length === 0) { return res.status(404).json({ message: 'Task not found' }); }
        await pool.query('DELETE FROM Tasks WHERE task_id = $1', [id]);
        res.json({ message: 'Task removed successfully.' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ message: 'Server error while deleting task' });
    }
};


// ... [The 'logTimeForTask' function remains the same as your V2 version] ...
const logTimeForTask = async (req, res) => {
    const { id } = req.params;
    const { duration_minutes, notes } = req.body;
    const { user_id } = req.user;
    if (!duration_minutes || duration_minutes <= 0) { return res.status(400).json({ message: 'Duration in minutes is required and must be positive.' }); }
    try {
        const newTimeEntry = await pool.query(`INSERT INTO Time_Entries (duration_minutes, notes, task_id, user_id) VALUES ($1, $2, $3, $4) RETURNING *`, [duration_minutes, notes || null, id, user_id]);
        res.status(201).json(newTimeEntry.rows[0]);
    } catch (error) {
        console.error('Error logging time:', error);
        res.status(500).json({ message: 'Server error while logging time' });
    }
};

// @desc    Add a comment to a task and notify relevant users
// @route   POST /api/tasks/:id/comments
// @access  Private
const addCommentToTask = async (req, res) => {
    const { id: taskId } = req.params;
    const { message } = req.body;
    const { user_id: commenterId, name: commenterName } = req.user;

    if (!message) { 
        return res.status(400).json({ message: 'Comment message cannot be empty.' });
    }

    try {
        const newCommentResult = await pool.query(
            `INSERT INTO Comments (message, task_id, user_id) VALUES ($1, $2, $3) RETURNING *`,
            [message, taskId, commenterId]
        );
        const newComment = newCommentResult.rows[0];

        // --- NOTIFICATION LOGIC ---
        const taskResult = await pool.query('SELECT title, assigner_id, assignee_id FROM Tasks WHERE task_id = $1', [taskId]);
        if (taskResult.rows.length > 0) {
            const task = taskResult.rows[0];
            const link = `${process.env.FRONTEND_URL}/tasks/${taskId}`;
            const notificationTitle = `New Comment on "${task.title}"`;
            const notificationMessage = `${commenterName} commented: "${message.substring(0, 50)}..."`;
            
            // Notify the assignee, but only if they are not the one who wrote the comment
            if (task.assignee_id !== commenterId) {
                await createAndSendNotification(task.assignee_id, notificationTitle, notificationMessage, link);
            }

            // Notify the assigner, but only if they are not the one who wrote the comment AND not the same person as the assignee
            if (task.assigner_id !== commenterId && task.assigner_id !== task.assignee_id) {
                await createAndSendNotification(task.assigner_id, notificationTitle, notificationMessage, link);
            }
        }
        // --- END NOTIFICATION LOGIC ---
        
        res.status(201).json(newComment);
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ message: 'Server error while adding comment' });
    }
};


// ... [The 'getTaskComments' and 'addAttachmentToTask' functions remain the same as your V2 version] ...
const getTaskComments = async (req, res) => {
    const { id } = req.params;
    try {
        const commentsResult = await pool.query('SELECT c.*, u.name as user_name FROM Comments c JOIN Users u ON c.user_id = u.user_id WHERE c.task_id = $1 ORDER BY c.created_at ASC', [id]);
        res.json(commentsResult.rows);
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ message: 'Server error while fetching comments' });
    }
};
const addAttachmentToTask = async (req, res) => {
    const { id: taskId } = req.params;
    const { user_id } = req.user;
    if (!req.file) { return res.status(400).json({ message: 'Please upload a file.' });}
    const { path: filePath, originalname } = req.file;
    try {
        const newAttachment = await pool.query(`INSERT INTO Attachments (file_path, file_name, task_id, user_id) VALUES ($1, $2, $3, $4) RETURNING *`, [filePath.replace(/\\/g, '/'), originalname, taskId, user_id]);
        res.status(201).json(newAttachment.rows[0]);
    } catch (error) {
        console.error('Error adding attachment:', error);
        res.status(500).json({ message: 'Server error while adding attachment' });
    }
};


// @desc    Create a subtask and notify the assignee
// @route   POST /api/tasks/:id/subtasks
// @access  Private
const createSubtask = async (req, res) => {
    const { id: parent_task_id } = req.params;
    const { user_id: assigner_id, name: assignerName } = req.user;
    const { title, description, assignee_id } = req.body;

    if (!title || !assignee_id) { 
        return res.status(400).json({ message: 'Please provide a title and an assignee for the subtask.' });
    }

    try {
        const parentTask = await pool.query('SELECT department_id, title as parent_title FROM Tasks WHERE task_id = $1', [parent_task_id]);
        if (parentTask.rows.length === 0) { 
            return res.status(404).json({ message: 'Parent task not found.' });
        }
        
        const { department_id, parent_title } = parentTask.rows[0];
        
        const newSubtaskResult = await pool.query(
            `INSERT INTO Tasks (title, description, assignee_id, assigner_id, department_id, parent_task_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [title, description || null, assignee_id, assigner_id, department_id, parent_task_id]
        );
        const newSubtask = newSubtaskResult.rows[0];

        // --- NOTIFICATION LOGIC ---
        if (newSubtask) {
            const link = `${process.env.FRONTEND_URL}/tasks/${parent_task_id}`; // Link to the parent task
            const message = `${assignerName} assigned you a new sub-task "${newSubtask.title}" under "${parent_title}".`;
            await createAndSendNotification(newSubtask.assignee_id, 'New Sub-task Assigned', message, link);
        }
        // --- END NOTIFICATION LOGIC ---

        res.status(201).json(newSubtask);
    } catch (error) {
        console.error('Error creating subtask:', error);
        res.status(500).json({ message: 'Server error while creating subtask' });
    }
};


// Export all functions
module.exports = {
    createTask,
    getTasks,
    getTaskById,
    updateTask,
    deleteTask,
    logTimeForTask,
    addCommentToTask,
    getTaskComments,
    addAttachmentToTask,
    createSubtask,
};
const express = require('express');
const router = express.Router();

// Your controller now exports many functions, so we import them all
const { 
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
} = require('../controllers/taskController');

// Import our V2 middleware and the file upload middleware
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware'); // Assuming this exists for file uploads

// --- Main task routes ( /api/tasks ) ---
router.route('/')
    .get(protect, getTasks) // No specific permission needed beyond login, controller handles logic
    .post(protect, authorize('CREATE_TASK'), createTask);

// --- Routes for a specific task ( /api/tasks/:id ) ---
router.route('/:id')
    .get(protect, getTaskById)
    .put(protect, updateTask) // The controller itself handles complex logic (assignee OR someone with EDIT_ANY_TASK)
    .delete(protect, authorize('DELETE_ANY_TASK'), deleteTask);

// --- Nested routes for a specific task ---
router.post('/:id/time-entries', protect, authorize('LOG_TIME_OWN'), logTimeForTask);

router.route('/:id/comments')
    .post(protect, authorize('ADD_COMMENT'), addCommentToTask)
    .get(protect, getTaskComments);

router.post('/:id/attachments', protect, authorize('ADD_ATTACHMENT'), upload.single('attachment'), addAttachmentToTask);

router.post('/:id/subtasks', protect, authorize('CREATE_SUBTASK'), createSubtask);

module.exports = router;
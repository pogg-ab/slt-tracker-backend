const multer = require('multer');
const path = require('path');

// Set up the storage engine for multer.
// This tells multer where to save the files and how to name them.
const storage = multer.diskStorage({
    destination: './uploads/', // The destination folder must exist.
    filename: function(req, file, cb) {
        // Create a unique filename to prevent files with the same name from overwriting each other.
        // Format: fieldname-timestamp.extension (e.g., attachment-1672531200000.png)
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

// A function to validate the type of file being uploaded.
function checkFileType(file, cb) {
    // Define a regular expression for allowed file extensions.
    const filetypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt/;
    
    // Test the file's extension.
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    // Test the file's MIME type.
    const mimetype = filetypes.test(file.mimetype);

    // If both the extension and MIME type are allowed, accept the file.
    if (mimetype && extname) {
        return cb(null, true);
    } else {
        // Otherwise, reject the file with an error message.
        cb('Error: You can only upload allowed file types!');
    }
}

// Initialize the main multer instance with our configuration.
// We DO NOT call .single() or .any() here.
const upload = multer({
    storage: storage,
    limits: { fileSize: 10000000 }, // Increased limit to 10MB
    fileFilter: function(req, file, cb) {
        checkFileType(file, cb);
    }
});

// Export the entire multer instance.
// This allows our route files to call upload.single(), upload.array(), etc.
module.exports = upload;
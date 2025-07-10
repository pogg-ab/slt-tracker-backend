const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Middleware to protect routes that require a logged-in user
const protect = async (req, res, next) => {
    let token;

    // Check if the Authorization header exists and starts with 'Bearer'
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // 1. Get the token from the header (e.g., "Bearer eyJhbGci...")
            token = req.headers.authorization.split(' ')[1];

            // 2. Verify the token using the secret key
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // 3. Find the user in the database using the ID from the token's payload.
            //    The payload has a `user_id` property, so we use `decoded.user_id`.
            const userQuery = `
                SELECT 
                    u.user_id, 
                    u.name, 
                    u.email, 
                    u.job_title, 
                    u.department_id,
                    ARRAY(
                        SELECT p.name 
                        FROM Permissions p 
                        JOIN User_Permissions up ON p.permission_id = up.permission_id 
                        WHERE up.user_id = u.user_id
                    ) as permissions
                FROM Users u
                WHERE u.user_id = $1
            `;
            
            const userResult = await pool.query(userQuery, [decoded.user_id]); // Use decoded.user_id

            if (userResult.rows.length === 0) {
                 // This case happens if the user was deleted after the token was issued.
                return res.status(401).json({ message: 'Not authorized, user not found.' });
            }

            // 4. Attach the complete user object (with permissions) to the request object.
            //    Now, any following middleware or route handler can access `req.user`.
            req.user = userResult.rows[0];

            // Handle the case where a user has no permissions, which might result in [null]
            if (req.user.permissions && req.user.permissions[0] === null) {
                req.user.permissions = [];
            }

            // 5. Continue to the next middleware or the actual route handler.
            next();

        } catch (error) {
            console.error('Token verification failed:', error.message);
            // This catches expired tokens, invalid signatures, etc.
            return res.status(401).json({ message: 'Not authorized, token failed.' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token provided.' });
    }
};

// Middleware to authorize based on user permissions.
// Can accept multiple permissions (e.g., authorize('MANAGE_USERS', 'VIEW_REPORTS'))
const authorize = (...requiredPermissions) => {
    return (req, res, next) => {
        // We assume 'protect' middleware has already run and attached `req.user`
        if (!req.user || !req.user.permissions) {
             return res.status(403).json({ message: 'Forbidden: User has no permissions.' });
        }

        // Check if the user's permissions array includes AT LEAST ONE of the required permissions.
        const hasPermission = req.user.permissions.some(userPermission => requiredPermissions.includes(userPermission));
        
        if (!hasPermission) {
            return res.status(403).json({ message: `Forbidden: You do not have the required permission(s).` });
        }
        
        // If the user has one of the required permissions, let them proceed.
        next();
    };
};

module.exports = { protect, authorize };
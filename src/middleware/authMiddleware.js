// src/middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Middleware to protect routes that require a logged-in user
const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // 1. Get the token from the header
            token = req.headers.authorization.split(' ')[1];

            // 2. Verify the token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // 3. Find the user and aggregate their permissions in a single, efficient query
            //    --- THIS IS THE CORRECTED QUERY WITH DOUBLE QUOTES ---
            const userQuery = `
                SELECT 
                    u.user_id, 
                    u.name, 
                    u.email, 
                    u.job_title, 
                    u.department_id,
                    ARRAY(
                        SELECT p.name 
                        FROM "Permissions" p 
                        JOIN "User_Permissions" up ON p.permission_id = up.permission_id 
                        WHERE up.user_id = u.user_id
                    ) as permissions
                FROM "Users" u
                WHERE u.user_id = $1
            `;
            
            const userResult = await pool.query(userQuery, [decoded.user_id]);

            if (userResult.rows.length === 0) {
                return res.status(401).json({ message: 'Not authorized, user not found.' });
            }

            // 4. Attach the complete user object to the request
            req.user = userResult.rows[0];

            // Handle the edge case where a user has no permissions, which might result in [null]
            if (req.user.permissions && req.user.permissions.length === 1 && req.user.permissions[0] === null) {
                req.user.permissions = [];
            }

            // 5. Proceed to the next middleware or route handler
            next();

        } catch (error) {
            console.error('Token verification failed:', error.message);
            return res.status(401).json({ message: 'Not authorized, token failed.' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token provided.' });
    }
};

// Middleware to authorize based on user permissions
const authorize = (...requiredPermissions) => {
    return (req, res, next) => {
        if (!req.user || !req.user.permissions) {
             return res.status(403).json({ message: 'Forbidden: Permissions not found for user.' });
        }

        const hasPermission = req.user.permissions.some(userPermission => requiredPermissions.includes(userPermission));
        
        if (!hasPermission) {
            return res.status(403).json({ message: `Forbidden: You do not have the required permission(s).` });
        }
        
        next();
    };
};

module.exports = { protect, authorize };
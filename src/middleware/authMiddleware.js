const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// V2: This middleware now fetches permissions
const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            const userQuery = `
                SELECT 
                    u.user_id, u.name, u.email, u.job_title, u.department_id,
                    array_agg(p.name) as permissions
                FROM Users u
                LEFT JOIN User_Permissions up ON u.user_id = up.user_id
                LEFT JOIN Permissions p ON up.permission_id = p.permission_id
                WHERE u.user_id = $1
                GROUP BY u.user_id;
            `;
            
            const userResult = await pool.query(userQuery, [decoded.userId]);

            if (userResult.rows.length === 0) {
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }
            
            req.user = userResult.rows[0];
            if (req.user.permissions && req.user.permissions[0] === null) {
                req.user.permissions = [];
            }

            next();

        } catch (error) {
            console.error('Token verification failed:', error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

// V2: This middleware now checks for a permission string
const authorize = (requiredPermission) => {
    return (req, res, next) => {
        if (!req.user || !req.user.permissions || !req.user.permissions.includes(requiredPermission)) {
            return res.status(403).json({ message: `Forbidden: Requires '${requiredPermission}' permission.` });
        }
        next();
    };
};

module.exports = { 
    protect, 
    authorize 
};
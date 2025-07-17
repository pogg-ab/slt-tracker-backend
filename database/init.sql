-- This script will completely reset and rebuild the database schema.

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- === CREATE ALL ENUM TYPES ===
CREATE TYPE task_status AS ENUM ('Pending', 'In Progress', 'Completed', 'Overdue');
CREATE TYPE task_priority AS ENUM ('Low', 'Medium', 'High', 'Urgent');
CREATE TYPE approval_status_enum AS ENUM ('Pending', 'Approved', 'Rejected');

-- === CREATE TRIGGER FUNCTION ===
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- === CREATE TABLES (in correct order) ===

CREATE TABLE IF NOT EXISTS "Departments" (
    department_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Users" (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    job_title VARCHAR(100),
    department_id INT REFERENCES "Departments"(department_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    password_reset_token TEXT,
    password_reset_expires TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS "Tasks" (
    task_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status task_status NOT NULL DEFAULT 'Pending',
    priority task_priority NOT NULL DEFAULT 'Medium',
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    parent_task_id INT REFERENCES "Tasks"(task_id) ON DELETE CASCADE,
    assigner_id INT REFERENCES "Users"(user_id) ON DELETE SET NULL,
    assignee_id INT REFERENCES "Users"(user_id) ON DELETE SET NULL,
    department_id INT REFERENCES "Departments"(department_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Comments" (
    comment_id SERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    task_id INT NOT NULL REFERENCES "Tasks"(task_id) ON DELETE CASCADE,
    user_id INT REFERENCES "Users"(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "Attachments" (
    attachment_id SERIAL PRIMARY KEY,
    file_path VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    task_id INT NOT NULL REFERENCES "Tasks"(task_id) ON DELETE CASCADE,
    user_id INT REFERENCES "Users"(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "Time_Entries" (
    entry_id SERIAL PRIMARY KEY,
    duration_minutes INT NOT NULL,
    notes TEXT,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    task_id INT NOT NULL REFERENCES "Tasks"(task_id) ON DELETE CASCADE,
    user_id INT REFERENCES "Users"(user_id) ON DELETE SET NULL,
    approval_status approval_status_enum NOT NULL DEFAULT 'Pending',
    approved_by INT REFERENCES "Users"(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "Devices" (
    device_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES "Users"(user_id) ON DELETE CASCADE,
    fcm_token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Permissions" (
    permission_id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS "User_Permissions" (
    user_id INT NOT NULL REFERENCES "Users"(user_id) ON DELETE CASCADE,
    permission_id INT NOT NULL REFERENCES "Permissions"(permission_id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, permission_id)
);

CREATE TABLE IF NOT EXISTS "Notifications" (
    notification_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES "Users"(user_id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    link VARCHAR(255),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- === SEED PERMISSIONS DATA ===
INSERT INTO "Permissions" (name, description) VALUES
    ('MANAGE_USERS', 'Can create, edit, delete users and manage their permissions.'),
    ('MANAGE_DEPARTMENTS', 'Can create and manage departments.'),
    ('VIEW_REPORTS', 'Can access the reports dashboard.'),
    ('VIEW_COMPANY_OVERVIEW', 'Can view the highest-level company analytics dashboard.'),
    ('CREATE_TASK', 'Can create new top-level tasks and assign them.'),
    ('CREATE_SUBTASK', 'Can create sub-tasks under an existing task.'),
    ('EDIT_ANY_TASK', 'Can edit the details of any task in their department.'),
    ('DELETE_ANY_TASK', 'Can delete any task in their department.'),
    ('UPDATE_OWN_TASK_STATUS', 'Can update the status of tasks directly assigned to them.'),
    ('LOG_TIME_OWN', 'Can log their own time against a task.'),
    ('APPROVE_TIME', 'Can approve or reject time entries from their team.'),
    ('ADD_COMMENT', 'Can add comments to tasks.'),
    ('ADD_ATTACHMENT', 'Can add attachments to tasks.'),
    ('VIEW_ALL_USERS_FOR_ASSIGNMENT', 'Can view all users for task assignment dropdowns.'),
    ('VIEW_ANY_TASK', 'Can view any task, even if not assigned (e.g., for CEO).')
ON CONFLICT (name) DO NOTHING;


-- === CREATE TRIGGER ===
CREATE TRIGGER set_tasks_timestamp
BEFORE UPDATE ON "Tasks"
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
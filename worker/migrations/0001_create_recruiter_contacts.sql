CREATE TABLE recruiter_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    email TEXT NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
    message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 2000),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX recruiter_contacts_created_at_idx
    ON recruiter_contacts (created_at);

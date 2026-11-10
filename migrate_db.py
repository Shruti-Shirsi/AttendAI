import sqlite3
import os

db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "attendai.db")
print("Migrating SQLite DB at:", db_path)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("ALTER TABLE attendance_sessions ADD COLUMN subject VARCHAR(100) DEFAULT 'General Attendance'")
    conn.commit()
    print("Added column 'subject' to attendance_sessions table.")
except sqlite3.OperationalError as e:
    print("Column already exists or error:", e)

conn.close()
print("Migration completed.")


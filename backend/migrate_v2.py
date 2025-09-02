import sqlite3
import os

def migrate_database_v2():
    """Migrate database to Phase 3.3 and 3.4 schema with rooms and updated messages"""
    
    if not os.path.exists('chat.db'):
        print("Database not found. Creating new one...")
        return
    
    conn = sqlite3.connect('chat.db')
    cursor = conn.cursor()
    
    try:
        print("Starting Phase 3.3/3.4 database migration...")
        
        # Check if migration is needed
        cursor.execute("PRAGMA table_info(user)")
        user_columns = [column[1] for column in cursor.fetchall()]
        
        if 'is_online' not in user_columns:
            print("Adding is_online column to user table...")
            cursor.execute("ALTER TABLE user ADD COLUMN is_online BOOLEAN DEFAULT 0")
        
        # Check if room table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='room'")
        if not cursor.fetchone():
            print("Creating room table...")
            cursor.execute("""
                CREATE TABLE room (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    created_by INTEGER NOT NULL,
                    created_at DATETIME NOT NULL,
                    is_active BOOLEAN DEFAULT 1,
                    FOREIGN KEY (created_by) REFERENCES user (id)
                )
            """)
        
        # Check if room_member table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='room_member'")
        if not cursor.fetchone():
            print("Creating room_member table...")
            cursor.execute("""
                CREATE TABLE room_member (
                    id INTEGER PRIMARY KEY,
                    room_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    joined_at DATETIME NOT NULL,
                    is_active BOOLEAN DEFAULT 1,
                    FOREIGN KEY (room_id) REFERENCES room (id),
                    FOREIGN KEY (user_id) REFERENCES user (id)
                )
            """)
        
        # Check if message table needs updates
        cursor.execute("PRAGMA table_info(message)")
        message_columns = [column[1] for column in cursor.fetchall()]
        
        if 'room_id' not in message_columns:
            print("Adding room_id column to message table...")
            cursor.execute("ALTER TABLE message ADD COLUMN room_id INTEGER")
        
        if 'room_name' not in message_columns:
            print("Adding room_name column to message table...")
            cursor.execute("ALTER TABLE message ADD COLUMN room_name TEXT")
        
        if 'message_type' not in message_columns:
            print("Adding message_type column to message table...")
            cursor.execute("ALTER TABLE message ADD COLUMN message_type TEXT DEFAULT 'private'")
        
        # Create indexes
        print("Creating indexes...")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_room_name ON room(name)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_room_member_room_id ON room_member(room_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_room_member_user_id ON room_member(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_message_room_id ON message(room_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_message_type ON message(message_type)")
        
        conn.commit()
        print("Phase 3.3/3.4 database migration completed successfully!")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_database_v2()

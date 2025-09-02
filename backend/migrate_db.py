import sqlite3
import os

def migrate_database():
    """Migrate existing database to new schema with sender_id and receiver_id"""
    
    # Check if database exists
    if not os.path.exists('chat.db'):
        print("Database not found. Creating new one...")
        return
    
    conn = sqlite3.connect('chat.db')
    cursor = conn.cursor()
    
    try:
        # Check if migration is needed
        cursor.execute("PRAGMA table_info(message)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'sender_id' in columns and 'receiver_id' in columns:
            print("Database already migrated. No action needed.")
            return
        
        print("Starting database migration...")
        
        # Create temporary table with new schema
        cursor.execute("""
            CREATE TABLE message_new (
                id INTEGER PRIMARY KEY,
                sender_id INTEGER,
                receiver_id INTEGER,
                sender_username TEXT,
                receiver_username TEXT,
                ciphertext TEXT,
                iv TEXT,
                timestamp DATETIME,
                FOREIGN KEY (sender_id) REFERENCES user (id),
                FOREIGN KEY (receiver_id) REFERENCES user (id)
            )
        """)
        
        # Copy existing data and populate new fields
        cursor.execute("""
            INSERT INTO message_new (id, sender_username, receiver_username, ciphertext, iv, timestamp)
            SELECT id, sender_username, receiver_username, ciphertext, iv, timestamp FROM message
        """)
        
        # Update sender_id and receiver_id based on usernames
        cursor.execute("""
            UPDATE message_new 
            SET sender_id = (SELECT id FROM user WHERE username = message_new.sender_username)
        """)
        
        cursor.execute("""
            UPDATE message_new 
            SET receiver_id = (SELECT id FROM user WHERE username = message_new.receiver_username)
        """)
        
        # Drop old table and rename new one
        cursor.execute("DROP TABLE message")
        cursor.execute("ALTER TABLE message_new RENAME TO message")
        
        # Create indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_message_sender_id ON message(sender_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_message_receiver_id ON message(receiver_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_message_timestamp ON message(timestamp)")
        
        conn.commit()
        print("Database migration completed successfully!")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_database()

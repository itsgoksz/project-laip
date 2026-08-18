import sqlite3
import os
import json

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "streetlights.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Assets Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS assets (
        asset_id TEXT PRIMARY KEY,
        asset_type TEXT NOT NULL,
        light_type TEXT NOT NULL, -- 'LED' or 'Sodium'
        latitude REAL,
        longitude REAL,
        installation_date TEXT,
        age_days INTEGER,
        power_rating REAL, -- 50W for LED, 150W for Sodium
        manufacturer TEXT,
        status TEXT DEFAULT 'OK'
    );
    """)
    
    # 2. Telemetry Readings Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS streetlight_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id TEXT,
        timestamp TEXT,
        hour INTEGER,
        day_of_week INTEGER,
        is_night INTEGER,
        power_consumption REAL,
        voltage REAL,
        current REAL,
        temperature REAL,
        operating_hours REAL,
        fault_count INTEGER,
        FOREIGN KEY(asset_id) REFERENCES assets(asset_id)
    );
    """)
    
    # 3. Anomalies Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS anomalies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id TEXT,
        timestamp TEXT,
        anomaly_score REAL,
        severity TEXT, -- 'LOW', 'MEDIUM', 'HIGH'
        detected_issues TEXT, -- JSON array of issues
        recommendation TEXT, -- JSON object
        FOREIGN KEY(asset_id) REFERENCES assets(asset_id)
    );
    """)
    
    conn.commit()
    conn.close()
    print(f"Database initialized at {DB_PATH}")

def clear_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DROP TABLE IF EXISTS anomalies;")
    cursor.execute("DROP TABLE IF EXISTS streetlight_readings;")
    cursor.execute("DROP TABLE IF EXISTS assets;")
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()

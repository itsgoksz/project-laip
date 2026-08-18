import pandas as pd
import numpy as np
from database import get_db_connection

def load_and_clean_data():
    conn = get_db_connection()
    
    # Load all telemetry readings
    query_readings = "SELECT * FROM streetlight_readings"
    df_readings = pd.read_sql_query(query_readings, conn)
    
    # Load all asset metadata
    query_assets = "SELECT asset_id, light_type, power_rating, age_days FROM assets"
    df_assets = pd.read_sql_query(query_assets, conn)
    
    conn.close()
    
    # Merge telemetry with asset metadata
    df = pd.merge(df_readings, df_assets, on="asset_id", suffixes=('', '_asset'))
    
    # Calculate engineered features
    # 1. Expected Power & Power Deviation
    # If night, expected power is close to power_rating. If day, expected power is close to 0.
    df["expected_power"] = np.where(df["is_night"] == 1, df["power_rating"], 0.0)
    df["power_deviation"] = df["power_consumption"] - df["expected_power"]
    df["abs_power_deviation"] = np.abs(df["power_deviation"])
    
    # 2. Expected Current & Current Deviation
    df["expected_current"] = np.where(df["is_night"] == 1, df["power_rating"] / 225.0, 0.0)
    df["current_deviation"] = df["current"] - df["expected_current"]
    df["abs_current_deviation"] = np.abs(df["current_deviation"])
    
    # 3. Voltage Deviation
    df["voltage_deviation"] = df["voltage"] - 225.0
    df["abs_voltage_deviation"] = np.abs(df["voltage_deviation"])
    
    return df

if __name__ == "__main__":
    df = load_and_clean_data()
    print(f"Loaded DataFrame with shape: {df.shape}")
    print(df[["asset_id", "timestamp", "power_consumption", "expected_power", "power_deviation"]].head())

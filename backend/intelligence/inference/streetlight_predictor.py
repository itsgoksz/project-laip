import os
import sys
import numpy as np
import pandas as pd
from database import get_db_connection

# Add intelligence path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from intelligence.models.anomaly_detection import StreetlightAnomalyDetector
from intelligence.models.health_model import StreetlightHealthModel
from intelligence.recommendations.streetlight_recommendations import generate_recommendation

# Global cached instances to avoid reloading
_detector = None
_health_model = None

def get_detector():
    global _detector
    if _detector is None:
        _detector = StreetlightAnomalyDetector()
        _detector.load()
    return _detector

def get_health_model():
    global _health_model
    if _health_model is None:
        _health_model = StreetlightHealthModel()
    return _health_model

def predict_single_asset(asset_id):
    """
    Performs full intelligence analysis on a single streetlight.
    Uses latest telemetry and historical records to compute health, anomalies, and recommendations.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Fetch asset details
    cursor.execute("""
        SELECT light_type, power_rating, age_days, latitude, longitude, manufacturer 
        FROM assets WHERE asset_id = ?
    """, (asset_id,))
    asset = cursor.fetchone()
    
    if not asset:
        conn.close()
        return None
        
    light_type = asset["light_type"]
    power_rating = asset["power_rating"]
    age_days = asset["age_days"]
    lat = asset["latitude"]
    lon = asset["longitude"]
    mfr = asset["manufacturer"]
    
    # 2. Fetch latest reading
    cursor.execute("""
        SELECT timestamp, hour, is_night, power_consumption, voltage, current, fault_count
        FROM streetlight_readings 
        WHERE asset_id = ? 
        ORDER BY timestamp DESC LIMIT 1
    """, (asset_id,))
    latest = cursor.fetchone()
    
    if not latest:
        conn.close()
        return None
        
    timestamp = latest["timestamp"]
    hour = latest["hour"]
    is_night = latest["is_night"]
    power = latest["power_consumption"]
    voltage = latest["voltage"]
    current = latest["current"]
    latest_fault = latest["fault_count"]
    
    # 3. Fetch historical telemetry for metrics (last 24 hours of logs)
    cursor.execute("""
        SELECT power_consumption, voltage, current, fault_count, is_night
        FROM streetlight_readings
        WHERE asset_id = ?
        ORDER BY timestamp DESC LIMIT 24
    """, (asset_id,))
    history = cursor.fetchall()
    
    conn.close()
    
    # Process history vectors
    voltages = [row["voltage"] for row in history]
    faults = sum([row["fault_count"] for row in history])
    
    # Voltage stability calculation
    voltage_std = float(np.std(voltages)) if len(voltages) > 1 else 0.0
    
    # 4. Feature engineering for the current prediction instance
    # Expected power
    expected_power = power_rating if is_night == 1 else 0.0
    abs_power_deviation = abs(power - expected_power)
    
    expected_current = (power_rating / 225.0) if is_night == 1 else 0.0
    abs_current_deviation = abs(current - expected_current)
    
    abs_voltage_deviation = abs(voltage - 225.0)
    
    # 5. ML Anomaly Prediction on current step
    detector = get_detector()
    
    # Create single-row DataFrame matching the cleaning structure
    single_df = pd.DataFrame([{
        "power_consumption": power,
        "voltage": voltage,
        "current": current,
        "abs_power_deviation": abs_power_deviation,
        "abs_voltage_deviation": abs_voltage_deviation,
        "abs_current_deviation": abs_current_deviation,
        "is_night": is_night
    }])
    
    anomaly_flags, anomaly_scores = detector.predict(single_df)
    is_anomaly = bool(anomaly_flags[0])
    anomaly_score = float(anomaly_scores[0])
    
    # 6. Count anomalies in the last 24h of history
    # sqlite3.Row objects must be converted to dicts to preserve column names in DataFrame
    history_dicts = [
        {
            "power_consumption": row["power_consumption"],
            "voltage": row["voltage"],
            "current": row["current"],
            "fault_count": row["fault_count"],
            "is_night": row["is_night"],
        }
        for row in history
    ]
    hist_df = pd.DataFrame(history_dicts)
    recent_anomalies_count = 0
    if not hist_df.empty:
        # Feature engineering matching training pipeline
        hist_df["expected_power"] = np.where(hist_df["is_night"] == 1, power_rating, 0.0)
        hist_df["abs_power_deviation"] = np.abs(hist_df["power_consumption"] - hist_df["expected_power"])
        hist_df["expected_current"] = np.where(hist_df["is_night"] == 1, power_rating / 225.0, 0.0)
        hist_df["abs_current_deviation"] = np.abs(hist_df["current"] - hist_df["expected_current"])
        hist_df["abs_voltage_deviation"] = np.abs(hist_df["voltage"] - 225.0)

        hist_flags, _ = detector.predict(hist_df)
        recent_anomalies_count = int(sum(hist_flags))
        
    # Override recent anomalies count if the current state is anomalous to ensure health drops
    if is_anomaly and recent_anomalies_count == 0:
        recent_anomalies_count = 1
        
    # 7. Compute Health Score
    health_model = get_health_model()
    health_score, status = health_model.calculate_health_score(
        age_days=age_days,
        fault_count=faults,
        voltage_std=voltage_std,
        recent_anomalies_count=recent_anomalies_count,
        light_type=light_type
    )
    
    # 8. Recommendation Generation
    recommendation = generate_recommendation(
        asset_id=asset_id,
        light_type=light_type,
        power=power,
        expected_power=expected_power,
        voltage=voltage,
        age_days=age_days,
        fault_count=faults,
        recent_anomalies=recent_anomalies_count,
        health_score=health_score,
        is_night=is_night
    )
    
    return {
        "asset_id": asset_id,
        "light_type": light_type,
        "power_rating": power_rating,
        "manufacturer": mfr,
        "age_days": age_days,
        "latitude": lat,
        "longitude": lon,
        "timestamp": timestamp,
        "hour": hour,
        "is_night": bool(is_night),
        "power_consumption": power,
        "expected_power": expected_power,
        "voltage": voltage,
        "current": current,
        "anomaly_detected": is_anomaly,
        "anomaly_score": round(anomaly_score, 2),
        "health_score": health_score,
        "status": status,
        "detected_issues": recommendation["detected_issues"],
        "recommendation": {
            "action": recommendation["action"],
            "priority": recommendation["priority"],
            "reason": recommendation["reason"]
        }
    }

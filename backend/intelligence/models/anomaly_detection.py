import os
import joblib
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import numpy as np

MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models", "bin")

class StreetlightAnomalyDetector:
    def __init__(self):
        # We will use contamination of 0.05 (approx 5% expected anomalies)
        self.model = IsolationForest(contamination=0.05, random_state=42)
        self.scaler = StandardScaler()
        
    def get_features(self, df):
        # Numeric columns used for model
        feature_cols = [
            "power_consumption",
            "voltage",
            "current",
            "abs_power_deviation",
            "abs_voltage_deviation",
            "abs_current_deviation",
            "is_night"
        ]
        return df[feature_cols].values
        
    def train(self, df):
        X = self.get_features(df)
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled)
        print("Anomaly detector trained successfully.")
        
    def predict(self, df):
        X = self.get_features(df)
        X_scaled = self.scaler.transform(X)
        
        # Isolation Forest outputs -1 for anomalies, 1 for normal
        preds = self.model.predict(X_scaled)
        scores = self.model.score_samples(X_scaled) # negative values (more negative = more anomalous)
        
        # Convert predictions: True if anomaly (-1), False if normal (1)
        anomaly_flags = (preds == -1)
        
        # Map raw anomaly scores to [0.0, 1.0] range (where 1.0 is highly anomalous)
        # score_samples outputs roughly [-0.8, -0.3]
        # Let's map -0.35 or above to near 0, and -0.7 or below to near 1.0
        normalized_scores = []
        for s in scores:
            ns = np.clip((0.55 - (s + 1.0)) / 0.25, 0.0, 1.0)
            normalized_scores.append(float(ns))
            
        return anomaly_flags, normalized_scores
        
    def save(self):
        os.makedirs(MODEL_DIR, exist_ok=True)
        joblib.dump(self.model, os.path.join(MODEL_DIR, "anomaly_model.joblib"))
        joblib.dump(self.scaler, os.path.join(MODEL_DIR, "scaler.joblib"))
        print(f"Saved models in {MODEL_DIR}")
        
    def load(self):
        model_path = os.path.join(MODEL_DIR, "anomaly_model.joblib")
        scaler_path = os.path.join(MODEL_DIR, "scaler.joblib")
        if os.path.exists(model_path) and os.path.exists(scaler_path):
            self.model = joblib.load(model_path)
            self.scaler = joblib.load(scaler_path)
            print("Anomaly models loaded successfully.")
            return True
        else:
            print("Saved anomaly models not found.")
            return False

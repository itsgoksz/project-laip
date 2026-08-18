import os
import sys

# Ensure backend root is in python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from intelligence.processors.cleaning import load_and_clean_data
from intelligence.models.anomaly_detection import StreetlightAnomalyDetector

def run_training():
    print("Starting Streetlight Intelligence model training...")
    
    # 1. Load and clean historical telemetry data
    df = load_and_clean_data()
    
    # 2. Train the anomaly detector
    detector = StreetlightAnomalyDetector()
    detector.train(df)
    
    # 3. Save the trained model
    detector.save()
    
    # 4. Test inference
    flags, scores = detector.predict(df)
    df["anomaly_detected"] = flags
    df["anomaly_score"] = scores
    
    # Print statistics
    total_samples = len(df)
    anomaly_count = sum(flags)
    anomaly_pct = (anomaly_count / total_samples) * 100
    
    print("--- Training Metrics ---")
    print(f"Total processed samples: {total_samples}")
    print(f"Detected anomalies in history: {anomaly_count} ({anomaly_pct:.2f}%)")
    
    # Check specifically injected anomaly assets
    print("\nAnomalies per asset (top 10):")
    print(df[df["anomaly_detected"] == True]["asset_id"].value_counts().head(10))
    
    print("\nModel training successfully completed!")

if __name__ == "__main__":
    run_training()

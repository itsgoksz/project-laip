import numpy as np

class StreetlightHealthModel:
    def calculate_health_score(self, age_days, fault_count, voltage_std, recent_anomalies_count, light_type):
        """
        Calculates a hybrid health score (0-100) based on age, electrical stability,
        fault history, and recent model anomalies.
        """
        score = 100.0
        
        # 1. Age wear-and-tear
        if light_type == "LED":
            # LED life is longer; max loss of 15 points
            age_penalty = min(15.0, (age_days / 1000.0) * 15.0)
        else:
            # Sodium life is shorter, loses efficiency faster; max loss of 25 points
            age_penalty = min(25.0, (age_days / 2000.0) * 25.0)
        score -= age_penalty
        
        # 2. Historical faults
        # Each historical fault subtracts 5 points
        fault_penalty = min(30.0, fault_count * 5.0)
        score -= fault_penalty
        
        # 3. Electrical stability (Voltage Std Dev)
        # Normal fluctuation is ~2.0-3.0V. Anything above 4.5V indicates line instability
        if voltage_std > 4.5:
            stability_penalty = min(15.0, (voltage_std - 4.5) * 3.0)
            score -= stability_penalty
            
        # 4. Recent anomalies detected by ML
        # A single anomaly is warning, multiple indicates persistent fault
        anomaly_penalty = min(40.0, recent_anomalies_count * 8.0)
        score -= anomaly_penalty
        
        # Ensure score falls between 0 and 100
        final_score = int(np.clip(score, 0.0, 100.0))
        
        # Determine status
        if final_score >= 80:
            status = "OK"
        elif final_score >= 50:
            status = "WARNING"
        else:
            status = "CRITICAL"
            
        return final_score, status

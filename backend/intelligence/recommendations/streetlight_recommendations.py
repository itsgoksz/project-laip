def generate_recommendation(asset_id, light_type, power, expected_power, voltage, age_days, fault_count, recent_anomalies, health_score, is_night):
    priority = "LOW"
    action = "Routine maintenance check"
    reason = "Streetlight is operating normally. Scheduled cleaning and visual checks are recommended on normal cycles."
    detected_issues = []
    
    # 1. Nighttime Failure
    if is_night and power < 5.0 and expected_power > 20.0:
        priority = "HIGH"
        detected_issues.append("No power consumption during expected operating hours")
        action = "Replace lamp / Inspect power breaker"
        reason = "The asset is not drawing power during scheduled nighttime operating hours. This indicates lamp failure, a failed driver, or a tripped circuit breaker."
        
    # 2. Excessive Power Consumption
    elif expected_power > 20.0 and power > expected_power * 1.4:
        priority = "MEDIUM"
        detected_issues.append("Excessive power consumption detected")
        action = "Inspect ballast / check electrical load"
        reason = f"Street light is drawing {round(power)}W, which is significantly higher than its rated power of {round(expected_power)}W. This points to potential ballast degradation or local wiring short-circuit."
        
    # 3. Voltage Anomaly
    if voltage > 0.0 and (voltage < 185.0 or voltage > 265.0):
        # Only elevate to HIGH if it's currently causing abnormal power or health is already critical
        priority = "HIGH" if (priority == "HIGH" or health_score < 40) else "MEDIUM"
        detected_issues.append(f"Severe voltage anomaly: {round(voltage, 1)}V")
        action = "Verify grid phase connection / inspect line voltage"
        reason = f"Operating voltage ({round(voltage, 1)}V) deviates severely from nominal grid level (225V). This can lead to grid failure or premature driver burnout."
        
    # 4. Flickering / Intermittent faults
    if recent_anomalies > 5 or fault_count > 5:
        priority = "HIGH" if (priority == "HIGH" or health_score < 50) else "MEDIUM"
        detected_issues.append("Repeated operational failures / flickering")
        action = "Troubleshoot wiring and relay connection"
        reason = "Telemetry reports repeated off-on cycles or intermittent current drops during night operations, implying loose terminal contacts or unstable relays."
        
    # 5. Lifespan Degradation
    if age_days > 2500 and len(detected_issues) == 0:
        priority = "LOW"
        detected_issues.append("Asset reaching operational age limit")
        action = "Consider scheduled replacement"
        reason = f"The streetlight is {age_days} days old ({round(age_days/365, 1)} years) and has degraded in overall health. Preventative replacement is advised."
        
    if len(detected_issues) == 0:
        detected_issues.append("Nominal operation")
        
    return {
        "priority": priority,
        "action": action,
        "reason": reason,
        "detected_issues": detected_issues
    }

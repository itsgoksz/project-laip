import os
import random
import datetime
from database import get_db_connection

def generate_streetlight_assets():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if assets already exist
    cursor.execute("SELECT COUNT(*) FROM assets")
    if cursor.fetchone()[0] > 0:
        print("Street light assets already exist in the database.")
        conn.close()
        return
        
    random.seed(42) # Set seed for reproducibility
    
    manufacturers_led = ["Philips", "Havells", "Syska", "Wipro"]
    manufacturers_sodium = ["Osram", "GE Lighting", "Bajaj", "Crompton"]
    
    # We will generate 100 street lights: SL-0 to SL-99.
    # Distribution is zone-based, simulating an ongoing LED upgrade rollout:
    #   Zone A (SL-0  to SL-39)  — Old residential area:  ALL Sodium vapor, with 3 pilot LED retrofits
    #   Zone B (SL-40 to SL-64)  — Transition corridor:   Mostly Sodium (80%), a few LED (20%)
    #   Zone C (SL-65 to SL-99)  — New development area:  ALL LED, brand-new infrastructure
    
    # Identify the few LED retrofit IDs in the otherwise-Sodium zones
    led_pilot_ids_zone_a = random.sample(range(0, 40), 3)   # 3 LED pilots in Zone A
    led_upgrade_ids_zone_b = random.sample(range(40, 65), 5) # 5 LED upgrades in Zone B

    assets = []
    base_date = datetime.date(2026, 8, 18)
    
    for i in range(100):
        asset_id = f"SL-{i}"
        
        # Determine zone and default type
        if i < 40:
            # Zone A — Old residential area: primarily Sodium
            is_led = (i in led_pilot_ids_zone_a)
        elif i < 65:
            # Zone B — Transition corridor: mixed, mostly Sodium
            is_led = (i in led_upgrade_ids_zone_b)
        else:
            # Zone C — New development: fully LED
            is_led = True
        
        if is_led:
            light_type = "LED"
            power_rating = 50.0  # 50 Watts — energy efficient
            manufacturer = random.choice(manufacturers_led)
            # LED lights are newer on average
            age_days = random.randint(60, 800)
        else:
            light_type = "Sodium"
            power_rating = 150.0  # 150 Watts — higher energy use
            manufacturer = random.choice(manufacturers_sodium)
            # Sodium lights are older infrastructure
            age_days = random.randint(1200, 4000)
            
        installation_date = (base_date - datetime.timedelta(days=age_days)).strftime("%Y-%m-%d")
        
        # Approximate location coordinates around JP Nagar center (12.905, 77.590)
        # Zone A: western quadrant, Zone B: central strip, Zone C: eastern quadrant
        if i < 40:
            lat = 12.905 + random.uniform(-0.012, 0.0)
            lon = 77.590 + random.uniform(-0.012, 0.0)
        elif i < 65:
            lat = 12.905 + random.uniform(-0.006, 0.006)
            lon = 77.590 + random.uniform(-0.006, 0.006)
        else:
            lat = 12.905 + random.uniform(0.0, 0.012)
            lon = 77.590 + random.uniform(0.0, 0.012)
        
        assets.append((
            asset_id,
            "streetlight",
            light_type,
            lat,
            lon,
            installation_date,
            age_days,
            power_rating,
            manufacturer,
            "OK"
        ))
        
    cursor.executemany("""
    INSERT INTO assets (asset_id, asset_type, light_type, latitude, longitude, installation_date, age_days, power_rating, manufacturer, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, assets)
    
    conn.commit()
    conn.close()
    # Count by type for feedback
    led_count = sum(1 for a in assets if a[2] == "LED")
    sodium_count = len(assets) - led_count
    print(f"Generated 100 streetlight assets ({led_count} LED, {sodium_count} Sodium) across 3 geographic zones.")


def generate_telemetry_data():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if telemetry already exists
    cursor.execute("SELECT COUNT(*) FROM streetlight_readings")
    if cursor.fetchone()[0] > 0:
        print("Telemetry data already exists in the database.")
        conn.close()
        return
        
    # Get all assets
    cursor.execute("SELECT asset_id, light_type, power_rating, age_days FROM assets")
    assets = cursor.fetchall()
    
    # Generate 14 days of hourly readings
    end_time = datetime.datetime(2026, 8, 18, 12, 0, 0)
    start_time = end_time - datetime.timedelta(days=14)
    
    readings = []
    current_time = start_time
    
    random.seed(100)
    
    print("Generating telemetry readings (this may take a few seconds)...")
    
    while current_time <= end_time:
        timestamp_str = current_time.strftime("%Y-%m-%dT%H:%M:%S")
        hour = current_time.hour
        day_of_week = current_time.weekday()
        # Assume operating hours are night: 7 PM (19) to 6 AM (6)
        is_night = 1 if (hour >= 19 or hour <= 6) else 0
        
        for asset in assets:
            asset_id = asset["asset_id"]
            light_type = asset["light_type"]
            power_rating = asset["power_rating"]
            age_days = asset["age_days"]
            
            # Base values
            voltage = random.normalvariate(225.0, 3.0) # normal grid voltage
            current = 0.0
            power = 0.0
            temperature = random.normalvariate(25.0, 2.0) # ambient Celsius
            operating_hours = 0.0
            fault_count = 0
            
            # Injected anomalies for specific streetlights
            # 1. Nighttime Failure (SL-12) - fails on some nights
            is_failing_night_fail = (asset_id == "SL-12" and current_time.day % 3 == 0)
            
            # 2. Excessive Power Consumption (SL-34) - ballast degradation
            is_failing_high_power = (asset_id == "SL-34" and is_night)
            
            # 3. Voltage Anomaly (SL-56) - local line resistance / transformer issue
            is_failing_voltage = (asset_id == "SL-56" and current_time.day % 4 == 0)
            
            # 4. Intermittent Toggling / Flickering (SL-78)
            is_failing_flickering = (asset_id == "SL-78" and is_night and (hour % 2 == 0))
            
            # 5. High Age Degradation (SL-90)
            is_degraded = (asset_id == "SL-90")
            
            if is_night:
                operating_hours = 1.0
                if is_failing_night_fail:
                    power = 0.0
                    current = 0.0
                    fault_count = 1
                elif is_failing_high_power:
                    # Spikes high
                    power = power_rating * random.uniform(1.5, 2.2)
                    current = power / voltage
                    fault_count = 0
                elif is_failing_voltage:
                    voltage = random.uniform(140.0, 180.0) # Sag
                    power = power_rating * (voltage / 225.0) # simplified ohmic dependency
                    current = power / voltage
                    fault_count = 1
                elif is_failing_flickering:
                    # Flicker means OFF on even hours
                    power = 0.0
                    current = 0.0
                    fault_count = 1
                else:
                    # Normal Nighttime operation
                    if is_degraded:
                        # Degrading light consumes more power for less output
                        power = power_rating * random.uniform(1.15, 1.35)
                        voltage = voltage - random.uniform(5.0, 10.0) # higher line drop
                    else:
                        power = power_rating * random.normalvariate(1.0, 0.03)
                    current = power / voltage
                    temperature += 15.0 # heating up due to light operation
            else:
                # Daytime - normally OFF
                if is_failing_high_power:
                    # standby high draw
                    power = random.uniform(10.0, 20.0)
                    current = power / voltage
                else:
                    # Normal Daytime operation
                    power = random.uniform(0.0, 0.5) # standby power
                    current = power / voltage
            
            readings.append((
                asset_id,
                timestamp_str,
                hour,
                day_of_week,
                is_night,
                round(power, 2),
                round(voltage, 2),
                round(current, 3),
                round(temperature, 1),
                operating_hours,
                fault_count
            ))
            
        current_time += datetime.timedelta(hours=1)
        
    cursor.executemany("""
    INSERT INTO streetlight_readings (asset_id, timestamp, hour, day_of_week, is_night, power_consumption, voltage, current, temperature, operating_hours, fault_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, readings)
    
    conn.commit()
    conn.close()
    print(f"Generated {len(readings)} historical telemetry records.")

def setup_all():
    generate_streetlight_assets()
    generate_telemetry_data()

if __name__ == "__main__":
    setup_all()

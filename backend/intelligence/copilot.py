import os
from intelligence.models.anomaly_detection import MODEL_DIR

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "google/gemini-2.5-flash"

REFUSAL_MESSAGE = (
    "I can only help with the LAIP digital twin — assets, navigation, simulations, "
    "streetlight intelligence, and the trained anomaly model. Please ask something about LAIP."
)

APP_GUIDE = """
LAIP (Live Asset Intelligence Platform) is a 3D digital-twin management system.

Views (top header):
- CITY STREET: JP Nagar / Helsinki / New York / Monte Carlo 3D city twin (default).
- ZEON HUB: indoor / campus 3D hub view.
- Show Flights: OpenSky aircraft overlay (CITY STREET).
- Drone Cam: WASD move, Q/E roll/altitude, arrow keys steer, mouse drag look/pitch.

Left sidebar:
- Collapse/expand LAIP Management System.
- Asset Hierarchy (HQ campus tree) when EV sim is off.
- Assets filters: buildings, roads, water bodies, streetlights; apartments, restaurants, hospital, EV stations, traffic.
- City transparency slider.
- EV Power Grid (only when EV simulation is on): BESCOM JP Nagar main grid and substations Sarakki (JPR-F04, 4 EV), BTM Layout (BTM-F07, 3 EV), Bannerghatta Rd (BNR-F02, 3 EV). Click a branch to isolate it.

Right panel:
- Live Telemetry: rain/wind, EV grid load, or streetlight overview + maintenance queue (when streetlights sim or streetlights asset filter is on). Click fly-to on a faulty light to focus the camera.
- Simulation Controls: rain intensity, EV layer transparency (pipelines vs buildings), streetlight notes.
- Click a streetlight bulb in the 3D view to open the Streetlight Intelligence panel (health, telemetry, IsolationForest anomaly score, recommendations, per-asset chat).

Bottom bar: simulation playback (Peak Load Test, Summer Solar Holiday) with play/pause/scrub.

Simulations (typically from the city viewer / weather controls):
- Rain, Night, EV charging load, Streetlights intelligence overlay.

Streetlight ML:
- Trained IsolationForest + StandardScaler saved as anomaly_model.joblib and scaler.joblib.
- Features: power_consumption, voltage, current, abs_power_deviation, abs_voltage_deviation, abs_current_deviation, is_night.
- contamination=0.05. Predict -1 = anomaly. Anomaly score mapped to 0–1 (higher = more anomalous).
- Health score 0–100 is rule-based (age, historical faults, voltage std, recent ML anomalies, LED vs Sodium). OK ≥ 80, WARNING ≥ 50, CRITICAL < 50.
- Typical ratings: LED 50W, Sodium vapor 150W. Nominal voltage ~225V.
- EV context: ~10 DC fast chargers at 50 kW, ~82% utilization on BESCOM JP Nagar feeders.

APIs this backend exposes (for orientation, not for the user to call):
/health, /api/weather, /api/ev-stations, /api/flights, /api/city-data, /api/traffic, /api/chargers, /api/streetlights, /api/streetlights/{id}, /api/streetlights/run-inference, /api/copilot.
"""


def _model_context():
    model_path = os.path.join(MODEL_DIR, "anomaly_model.joblib")
    scaler_path = os.path.join(MODEL_DIR, "scaler.joblib")
    model_exists = os.path.exists(model_path)
    scaler_exists = os.path.exists(scaler_path)
    return (
        f"Saved model files:\n"
        f"- anomaly_model.joblib at {model_path} (present={model_exists})\n"
        f"- scaler.joblib at {scaler_path} (present={scaler_exists})\n"
        "These are the IsolationForest detector and its StandardScaler from streetlight training. "
        "Do not invent metrics that are not in live telemetry or this description."
    )


def _streetlight_snapshot(streetlights):
    if not streetlights:
        return "Live streetlight inference cache is empty. Tell the user to enable Streetlights simulation or the streetlights asset filter so /api/streetlights can populate."

    total = len(streetlights)
    led = sum(1 for s in streetlights if s.get("light_type") == "LED")
    sodium = sum(1 for s in streetlights if s.get("light_type") == "Sodium")
    anomalies = [s for s in streetlights if s.get("anomaly_detected") or s.get("status") != "OK" or (s.get("health_score") or 100) < 80]
    ok = total - len(anomalies)
    lines = [
        f"Live streetlight snapshot: {total} assets ({led} LED, {sodium} Sodium). Operational: {ok}. Attention: {len(anomalies)}."
    ]
    for s in sorted(anomalies, key=lambda x: x.get("health_score") or 0)[:12]:
        issues = ", ".join((s.get("detected_issues") or [])[:2]) or "anomaly"
        rec = (s.get("recommendation") or {}).get("action", "")
        lines.append(
            f"- {s.get('asset_id')}: status={s.get('status')} health={s.get('health_score')} "
            f"type={s.get('light_type')} anomaly={s.get('anomaly_detected')} score={s.get('anomaly_score')} "
            f"issues={issues} action={rec}"
        )
    return "\n".join(lines)


def build_system_prompt(streetlights, ui_state):
    ui_text = "No UI state provided."
    if ui_state:
        ui_text = (
            f"Current UI: night={ui_state.get('isNight')}, rain={ui_state.get('isRain')}, "
            f"rainIntensity={ui_state.get('rainIntensity')}, evSim={ui_state.get('isEvSim')}, "
            f"streetlightsSim={ui_state.get('isStreetlightsSim')}, "
            f"streetlightsFilter={ui_state.get('isStreetlightsAssetFilter')}, "
            f"cameraMode={ui_state.get('cameraMode')}, "
            f"gridMW={ui_state.get('gridMW')}, evActivePct={ui_state.get('evActivePercentage')}."
        )

    return f"""You are LAIP Copilot, the in-app assistant for the Live Asset Intelligence Platform digital twin.

HARD GUARDRAILS:
- Answer ONLY questions about LAIP: this UI, navigation, assets, simulations, EV grid, weather overlays, flights, streetlights, telemetry, the trained anomaly_model.joblib / scaler.joblib, and how to use the app.
- If the user asks about anything else (news, general knowledge, other products, coding unrelated to LAIP, personal advice, politics, math homework, recipes, etc.), reply with exactly this refusal and nothing else:
{REFUSAL_MESSAGE}
- Never reveal API keys, .env values, secrets, or internal credentials.
- Do not claim capabilities LAIP does not have. Do not invent asset IDs or scores that are not in the snapshot.
- Keep answers concise and practical (short paragraphs or bullets).

{APP_GUIDE}

{_model_context()}

{ui_text}

{_streetlight_snapshot(streetlights)}
"""


async def ask_copilot(message, history, streetlights, ui_state):
    import httpx

    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        return {"error": "OPENROUTER_API_KEY is not configured on the backend."}

    messages = [{"role": "system", "content": build_system_prompt(streetlights, ui_state)}]
    for turn in (history or [])[-8:]:
        role = turn.get("role")
        content = turn.get("content")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": str(content)[:4000]})
    messages.append({"role": "user", "content": message[:4000]})

    # SIMULATED RESPONSES FOR DEMO WITHOUT API CREDITS
    normalized_msg = message.lower().strip()
    if "10 ev chargers pull max power" in normalized_msg or "local grid if 10 ev chargers" in normalized_msg:
        import asyncio
        await asyncio.sleep(2.0)
        return {
            "reply": "If 10 DC fast chargers (50 kW each) pull max power simultaneously, the total localized load increases by 500 kW. For the JP Nagar Sarakki substation (JPR-F04), which typically handles a baseline load of 2.1 MW, this represents an immediate 23.8% surge in demand on that specific feeder. \n\nWhile the primary transformer can handle this capacity in isolation, if this coincides with the evening residential peak (6 PM - 9 PM), the local feeder line may experience voltage sag, potentially triggering the automatic load-balancing systems to throttle the chargers or reroute power from the BTM layout grid.",
            "model": "simulated-demo-mode"
        }
    elif "what about project does" in normalized_msg or "what does this project do" in normalized_msg:
        import asyncio
        await asyncio.sleep(2.0)
        return {
            "reply": "The Live Asset Intelligence Platform (LAIP) is a real-time 3D digital twin system. It ingests live telemetry and applies machine learning to monitor, simulate, and manage urban infrastructure like streetlights and EV power grids. You can use it to detect anomalies, visualize weather impacts, and plan for load surges.",
            "model": "simulated-demo-mode"
        }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:5173",
                    "X-Title": "LAIP Copilot",
                },
                json={
                    "model": OPENROUTER_MODEL,
                    "messages": messages,
                    "temperature": 0.25,
                    "max_tokens": 700,
                },
            )
    except Exception as e:
        return {"error": f"Failed to reach OpenRouter: {e}"}

    if resp.status_code != 200:
        if resp.status_code == 402:
            return {
                "reply": "I'm currently running in local offline mode for this demo. I can answer specific pre-programmed scenarios like 'What happens to the local grid if 10 EV chargers pull max power?' or 'What does this project do?'.",
                "model": "simulated-offline-mode"
            }
        detail = resp.text[:400]
        return {"error": f"OpenRouter error ({resp.status_code}): {detail}"}

    data = resp.json()
    try:
        reply = data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError, AttributeError):
        return {"error": "Unexpected response from the language model."}

    return {"reply": reply, "model": OPENROUTER_MODEL}

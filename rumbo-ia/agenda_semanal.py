"""Read the current week of a Google Calendar iCal subscription."""
import re
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

import requests
import recurring_ical_events
from flask import jsonify, request
from icalendar import Calendar

MADRID = ZoneInfo("Europe/Madrid")
FEED = re.compile(r"https://calendar\.google\.com/calendar/ical/[A-Za-z0-9_%+.@-]+/private-[A-Za-z0-9_-]+/basic\.ics")
LIMIT = 8_000_000


def calendar_week():
    body = request.get_json(silent=True)
    url = body.get("url") if isinstance(body, dict) else None
    if not isinstance(url, str) or len(url) > 2048 or not FEED.fullmatch(url):
        return jsonify(error="Introduce la dirección secreta iCal de Google Calendar."), 400
    today = datetime.now(MADRID).date()
    monday = today - timedelta(days=today.weekday())
    start = datetime.combine(monday, time.min, MADRID)
    end = start + timedelta(days=7)
    try:
        with requests.get(url, timeout=(4, 12), stream=True, allow_redirects=False) as upstream:
            if upstream.status_code != 200:
                raise ValueError("feed unavailable")
            data = bytearray()
            for chunk in upstream.iter_content(65536):
                data.extend(chunk)
                if len(data) > LIMIT:
                    raise ValueError("feed too large")
        calendar = Calendar.from_ical(bytes(data))
        rows = []
        for event in recurring_ical_events.of(calendar).between(start, end):
            if str(event.get("STATUS", "")).upper() == "CANCELLED":
                continue
            when = event.decoded("DTSTART")
            all_day = not isinstance(when, datetime)
            if all_day:
                day = max(when, monday)
                hour = ""
            else:
                if when.tzinfo is None:
                    when = when.replace(tzinfo=MADRID)
                when = when.astimezone(MADRID)
                day = max(when.date(), monday)
                hour = when.strftime("%H:%M") if when.date() >= monday else "En curso"
            if day < end.date():
                rows.append(dict(day=day.isoformat(), hour=hour, title=str(event.get("SUMMARY") or "Ocupado")))
        rows.sort(key=lambda row: (row["day"], row["hour"], row["title"]))
        return jsonify(start=monday.isoformat(), events=rows)
    except Exception:
        return jsonify(error="No se pudo leer tu calendario. Comprueba la conexión y la dirección iCal."), 502


def register_calendar(app):
    @app.post("/agenda-semanal")
    def agenda_semanal():
        response = app.make_response(calendar_week())
        response.headers["Cache-Control"] = "private, no-store"
        return response

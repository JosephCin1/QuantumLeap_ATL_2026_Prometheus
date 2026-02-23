# QuantumLeap_ATL_2026

Minimal SF Pro styled front-end demo with:

- `login.html`: login page with domain validation (`@uni.atlanta.edu`).
- CSV-backed credential lookup from `users.csv`.
- Hardcoded demo gate that only allows `john@uni.atlanta.edu` with password `123`.
- `chatbot.html`: protected chatbot page shown only after successful login.
- Role/clearance examples in CSV for Student, Advisor, and Administrator.

## Run locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

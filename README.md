# PitchMix

A small baseball analytics prototype that recommends a pitch based on historical data and visualizes pitch locations inside a strike zone using a simple UI.

# TODO - screenshot
---

## Features
- Load Statcast-style CSV pitch data into a SQLite database  
- FastAPI backend for pitch usage & recommendations  
- React frontend with:
  - Pitch usage chart  
  - Recommended pitch with confidence  
  - Strike zone visualization  
  - Batter silhouette that swaps sides for LHH/RHH  
- Automatically updates when pitcher, count, or handedness changes  

---

## Requirements
- Python 3.10+
- Node 20+
- npm 11+

---

## Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Load Data
Place all CSVs into:

```
backend/data/csvs/
```

Then run:

```bash
python etl/load_pitches.py
```

### Start Backend
```bash
uvicorn api.main:app --reload --port 8000
```

---

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open:

```
http://localhost:3000
```

---

## Project Structure

```
backend/     FastAPI app + ETL + SQLite
frontend/    React + Vite UI
```

---

## License

MIT

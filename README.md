# GST ITC Reconciliation App

This application helps in reconciling GST Input Tax Credit (ITC) by comparing GSTR-2B data with the Purchase Register.

## Structure

- `backend/`: FastAPI application for data processing and storage.
- `frontend/`: React + Vite + Tailwind CSS dashboard.

## Setup

### Backend
```bash
cd backend
pip install -r requirements.txt
PYTHONPATH=. uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

# GST ITC Reconciliation App

This application helps in reconciling GST Input Tax Credit (ITC) by comparing GSTR-2B data with the Purchase Register and calculating Rule 42 reversals, blocked credits, and reclaims.

## Project Structure

- `backend/`: FastAPI (Python) server for data processing and SQLite storage.
- `frontend/`: React (Vite) + Tailwind CSS dashboard for data visualization.

---

## Local Setup Guide

Follow these steps to get the application running on your local machine.

### Prerequisites
- **Python 3.8+**: [Download here](https://www.python.org/downloads/)
- **Node.js 18+**: [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)

---

### 1. Setup the Backend

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create a virtual environment (optional but recommended):**
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the FastAPI server:**
   ```bash
   PYTHONPATH=. uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   The backend will be running at `http://localhost:8000`.

---

### 2. Setup the Frontend

1. **Open a new terminal window/tab.**
2. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   The frontend will be running at `http://localhost:5173` (or the port shown in your terminal).

---

### 3. Usage

1. Open your browser and go to `http://localhost:5173`.
2. **Create a Client**: Enter a name and click "Add Client".
3. **Select Client**: Click on the newly created client to open their dashboard.
4. **Upload Data**: Go to the "Upload" tab and select an Excel/CSV file containing your GSTR-2B or Purchase Register data.
5. **Review Summary**: Use the "Summary" tab to view the calculated ITC reconciliation and Rule 42 reversals.
6. **Export**: Click "Export to Excel" to download the finalized reconciliation report.

---

## Troubleshooting

- **CORS Errors**: Ensure the backend is running on port 8000. The frontend is configured to proxy `/api` requests to `http://localhost:8000`.
- **Database**: The app uses a local SQLite file `gst_reconcile.db` in the root/backend directory. You can delete this file to reset the database.

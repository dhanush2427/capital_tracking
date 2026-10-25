from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
import sqlite3
import os

app = FastAPI(title="Personal Capital & Cash-Flow Engine")

DB_NAME = "capital.db"

# 1. DATABASE INITIALIZATION
def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            amount REAL NOT NULL,
            type TEXT NOT NULL,
            category TEXT NOT NULL,
            date TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

init_db()

# 2. DATA VALIDATION MODEL
class TransactionCreate(BaseModel):
    title: str = Field(..., min_length=1)
    amount: float = Field(..., gt=0)
    type: str  # 'Income', 'Expense', or 'Investment'
    category: str
    date: str

# 3. API ROUTES (BACKEND + ANALYTICS)
@app.get("/api/transactions")
def get_transactions():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM transactions ORDER BY date DESC, id DESC")
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

@app.post("/api/transactions")
def add_transaction(tx: TransactionCreate):
    if tx.type not in ["Income", "Expense", "Investment"]:
        raise HTTPException(status_code=400, detail="Invalid transaction type")
    
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO transactions (title, amount, type, category, date) VALUES (?, ?, ?, ?, ?)",
        (tx.title, tx.amount, tx.type, tx.category, tx.date)
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return {"id": new_id, "message": "Transaction recorded successfully"}

@app.delete("/api/transactions/{tx_id}")
def delete_transaction(tx_id: int):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM transactions WHERE id = ?", (tx_id,))
    conn.commit()
    conn.close()
    return {"message": "Transaction deleted"}

@app.get("/api/analytics")
def get_analytics():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM transactions")
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()

    total_income = sum(r["amount"] for r in rows if r["type"] == "Income")
    total_expense = sum(r["amount"] for r in rows if r["type"] == "Expense")
    total_investment = sum(r["amount"] for r in rows if r["type"] == "Investment")
    projected_wealth = round(total_investment * (1.12 ** 10), 2)
    net_cash = total_income - total_expense - total_investment
    
    # Financial Ratios
    investment_rate = round((total_investment / total_income * 100), 1) if total_income > 0 else 0.0
    expense_rate = round((total_expense / total_income * 100), 1) if total_income > 0 else 0.0
    savings_rate = round(((total_investment + max(0, net_cash)) / total_income * 100), 1) if total_income > 0 else 0.0

    # Category Breakdown for Charts
    expense_by_category = {}
    investment_by_category = {}
    for r in rows:
        if r["type"] == "Expense":
            expense_by_category[r["category"]] = expense_by_category.get(r["category"], 0) + r["amount"]
        elif r["type"] == "Investment":
            investment_by_category[r["category"]] = investment_by_category.get(r["category"], 0) + r["amount"]

    return {
        "total_income": total_income,
        "total_expense": total_expense,
        "total_investment": total_investment,
        "projected_wealth": projected_wealth,
        "net_cash": net_cash,
        "investment_rate": investment_rate,
        "expense_rate": expense_rate,
        "savings_rate": savings_rate,
        "expense_by_category": expense_by_category,
        "investment_by_category": investment_by_category
    }

# 4. SERVE FRONTEND FILES
if not os.path.exists("static"):
    os.makedirs("static")

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def serve_home():
    return FileResponse("static/index.html")

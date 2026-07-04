# app.py — ExpensePro | Flask + SQLite Backend
# ─────────────────────────────────────────────────────
# Run: python app.py
# Open: http://localhost:5000
# ─────────────────────────────────────────────────────

from flask import Flask, request, jsonify, send_from_directory, Response
import sqlite3
import os
import csv
import io
import time

# ─────────────────────────────────────────────────────
# App Configuration
# ─────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH  = os.path.join(BASE_DIR, 'expense_tracker.db')

# Serve all static files (HTML, CSS, JS) from this same directory
app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')


# ─────────────────────────────────────────────────────
# Database Helpers
# ─────────────────────────────────────────────────────
def get_db():
    """Open a new SQLite connection with row-factory for dict-like access."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")   # better concurrency
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Create all tables if they don't already exist."""
    with get_db() as conn:
        conn.executescript('''
            CREATE TABLE IF NOT EXISTS users (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                fullname  TEXT    NOT NULL,
                email     TEXT    UNIQUE NOT NULL,
                password  TEXT    NOT NULL,
                created   TEXT    NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS expenses (
                id          TEXT PRIMARY KEY,
                user_email  TEXT NOT NULL,
                type        TEXT NOT NULL DEFAULT 'expense',
                description TEXT NOT NULL,
                amount      REAL NOT NULL,
                category    TEXT NOT NULL,
                date        TEXT NOT NULL,
                created     TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (user_email) REFERENCES users(email)
            );

            -- Attempt to add 'type' column to existing table. Ignore error if it exists.
            -- This is a safe way to handle simple schema evolution in SQLite.
            -- We wrap it in a TRY block or just run and let it fail silently if exists.
        ''')
        try:
            conn.execute('ALTER TABLE expenses ADD COLUMN type TEXT NOT NULL DEFAULT "expense"')
        except sqlite3.OperationalError:
            pass # Column already exists
        
        conn.executescript('''
            CREATE TABLE IF NOT EXISTS settings (
                user_email TEXT PRIMARY KEY,
                budget     REAL NOT NULL DEFAULT 50000,
                FOREIGN KEY (user_email) REFERENCES users(email)
            );
        ''')


# ─────────────────────────────────────────────────────
# Static Page Routes
# ─────────────────────────────────────────────────────
@app.route('/')
def root():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/index.html')
def index_page():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/login.html')
def login_page():
    return send_from_directory(BASE_DIR, 'login.html')

@app.route('/signup.html')
def signup_page():
    return send_from_directory(BASE_DIR, 'signup.html')


# ─────────────────────────────────────────────────────
# AUTH API
# ─────────────────────────────────────────────────────
@app.route('/api/signup', methods=['POST'])
def signup():
    data     = request.get_json(silent=True) or {}
    fullname = (data.get('fullname') or '').strip()
    email    = (data.get('email')    or '').strip().lower()
    password = (data.get('password') or '').strip()

    # Validation
    if not fullname or not email or not password:
        return jsonify({'error': 'All fields are required'}), 400
    if '@' not in email:
        return jsonify({'error': 'Please enter a valid email address'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    try:
        with get_db() as conn:
            conn.execute(
                'INSERT INTO users (fullname, email, password) VALUES (?, ?, ?)',
                (fullname, email, password)
            )
            # Create a default budget row for the new user
            conn.execute(
                'INSERT OR IGNORE INTO settings (user_email, budget) VALUES (?, ?)',
                (email, 50000)
            )
        return jsonify({'message': 'Account created successfully'}), 201

    except sqlite3.IntegrityError:
        return jsonify({'error': 'Email already registered. Please log in instead.'}), 400


@app.route('/api/login', methods=['POST'])
def login():
    data     = request.get_json(silent=True) or {}
    email    = (data.get('email')    or '').strip().lower()
    password = (data.get('password') or '').strip()

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    with get_db() as conn:
        user = conn.execute(
            'SELECT * FROM users WHERE email = ? AND password = ?',
            (email, password)
        ).fetchone()

        if not user:
            return jsonify({'error': 'Invalid email or password'}), 401

        setting = conn.execute(
            'SELECT budget FROM settings WHERE user_email = ?', (email,)
        ).fetchone()
        budget = setting['budget'] if setting else 50000

    return jsonify({
        'user':   {'fullname': user['fullname'], 'email': user['email']},
        'budget': budget
    })


# ─────────────────────────────────────────────────────
# EXPENSES API
# ─────────────────────────────────────────────────────

# NOTE: /api/expenses/export MUST be declared BEFORE /api/expenses/<expense_id>
# so Flask matches the literal string "export" first.

@app.route('/api/expenses/export', methods=['GET'])
def export_expenses():
    """Download all expenses for a user as a CSV file with full report headers and totals."""
    email = (request.args.get('email') or '').strip().lower()
    if not email:
        return jsonify({'error': 'Email required'}), 400

    with get_db() as conn:
        # Get Budget
        setting = conn.execute('SELECT budget FROM settings WHERE user_email = ?', (email,)).fetchone()
        budget = setting['budget'] if setting else 50000

        # Get User info (for display name)
        user = conn.execute('SELECT fullname FROM users WHERE email = ?', (email,)).fetchone()
        fullname = user['fullname'] if user else email

        # Get Expenses
        rows = conn.execute(
            '''SELECT date, type, description, category, amount
               FROM expenses
               WHERE user_email = ?
               ORDER BY date DESC''',
            (email,)
        ).fetchall()

    # Calculate Totals
    total_expense = 0
    total_loan = 0
    total_payment = 0

    for row in rows:
        rtype = row.get('type', 'expense')
        amt = float(row['amount'])
        if rtype == 'expense':
            total_expense += amt
        elif rtype == 'loan':
            total_loan += amt
        elif rtype == 'payment':
            total_payment += amt

    final_balance = budget - total_expense + total_loan - total_payment

    # Build CSV Output
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header Section
    writer.writerow(['💎 ExpensePro Financial Report'])
    writer.writerow([])
    writer.writerow(['User', fullname])
    writer.writerow(['Email', email])
    import datetime
    writer.writerow(['Report Date', datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
    writer.writerow([])
    
    # Financial Summary Section
    writer.writerow(['--- FINANCIAL SUMMARY ---'])
    writer.writerow(['Allocated Budget', f'PKR {budget:,.2f}'])
    writer.writerow(['Total Spent (Expenses)', f'PKR {total_expense:,.2f}'])
    writer.writerow(['Total Loans Received', f'PKR {total_loan:,.2f}'])
    writer.writerow(['Total Payments Sent', f'PKR {total_payment:,.2f}'])
    writer.writerow(['Final Wallet Balance', f'PKR {final_balance:,.2f}'])
    writer.writerow([])
    
    # Data Table Section
    writer.writerow(['--- TRANSACTION HISTORY ---'])
    writer.writerow(['Date', 'Type', 'Description', 'Category', 'Amount (PKR)'])
    for row in rows:
        rtype = row.get('type', 'expense').capitalize()
        writer.writerow([row['date'], rtype, row['description'], row['category'], row['amount']])

    filename = f"ExpensePro_Report_{email.split('@')[0]}.csv"
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )


@app.route('/api/expenses', methods=['GET'])
def get_expenses():
    email = (request.args.get('email') or '').strip().lower()
    if not email:
        return jsonify({'error': 'Email required'}), 400

    with get_db() as conn:
        rows = conn.execute(
            '''SELECT id, user_email, type, description, amount, category, date
               FROM expenses
               WHERE user_email = ?
               ORDER BY date DESC''',
            (email,)
        ).fetchall()

    return jsonify([dict(r) for r in rows])


@app.route('/api/expenses', methods=['POST'])
def add_expense():
    data        = request.get_json(silent=True) or {}
    user_email  = (data.get('user_email')  or '').strip().lower()
    type        = (data.get('type')        or 'expense').strip().lower()
    description = (data.get('description') or '').strip()
    amount      = data.get('amount')
    category    = (data.get('category')    or '').strip()
    date        = (data.get('date')        or '').strip()

    if not all([user_email, description, amount, category, date]):
        return jsonify({'error': 'All fields are required'}), 400

    try:
        amount = float(amount)
        if amount <= 0:
            raise ValueError('Amount must be positive')
    except (ValueError, TypeError):
        return jsonify({'error': 'Amount must be a positive number'}), 400

    # Unique ID: millisecond timestamp
    expense_id = str(int(time.time() * 1000))

    with get_db() as conn:
        conn.execute(
            '''INSERT INTO expenses (id, user_email, type, description, amount, category, date)
               VALUES (?, ?, ?, ?, ?, ?, ?)''',
            (expense_id, user_email, type, description, amount, category, date)
        )

    expense = {
        'id': expense_id, 'user_email': user_email, 'type': type,
        'description': description, 'amount': amount,
        'category': category, 'date': date
    }
    return jsonify({'message': 'Expense added', 'expense': expense}), 201


@app.route('/api/expenses/<expense_id>', methods=['PUT'])
def update_expense(expense_id):
    data = request.get_json(silent=True) or {}

    with get_db() as conn:
        existing = conn.execute(
            'SELECT * FROM expenses WHERE id = ?', (expense_id,)
        ).fetchone()

        if not existing:
            return jsonify({'error': 'Expense not found'}), 404

        # Fall back to existing values if a field is not provided
        type        = (data.get('type')        or '').strip().lower() or existing.get('type', 'expense')
        description = (data.get('description') or '').strip() or existing['description']
        category    = (data.get('category')    or '').strip() or existing['category']
        date        = (data.get('date')        or '').strip() or existing['date']

        try:
            amount = float(data['amount']) if 'amount' in data else existing['amount']
            if amount <= 0:
                raise ValueError
        except (ValueError, TypeError):
            return jsonify({'error': 'Amount must be a positive number'}), 400

        conn.execute(
            '''UPDATE expenses
               SET type = ?, description = ?, amount = ?, category = ?, date = ?
               WHERE id = ?''',
            (type, description, amount, category, date, expense_id)
        )

    updated = {
        'id': expense_id,
        'type': type,
        'description': description,
        'amount': amount,
        'category': category,
        'date': date
    }
    return jsonify({'message': 'Expense updated', 'expense': updated})


@app.route('/api/expenses/<expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    with get_db() as conn:
        result = conn.execute(
            'DELETE FROM expenses WHERE id = ?', (expense_id,)
        )
        if result.rowcount == 0:
            return jsonify({'error': 'Expense not found'}), 404

    return jsonify({'message': 'Deleted successfully'})


# ─────────────────────────────────────────────────────
# SETTINGS (BUDGET) API
# ─────────────────────────────────────────────────────
@app.route('/api/settings/budget', methods=['GET'])
def get_budget():
    email = (request.args.get('email') or '').strip().lower()
    if not email:
        return jsonify({'error': 'Email required'}), 400

    with get_db() as conn:
        setting = conn.execute(
            'SELECT budget FROM settings WHERE user_email = ?', (email,)
        ).fetchone()

    budget = setting['budget'] if setting else 50000
    return jsonify({'budget': budget})


@app.route('/api/settings/budget', methods=['POST'])
def update_budget():
    data   = request.get_json(silent=True) or {}
    email  = (data.get('email') or '').strip().lower()
    budget = data.get('budget')

    if not email or budget is None:
        return jsonify({'error': 'Email and budget are required'}), 400

    try:
        budget = float(budget)
        if budget < 0:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({'error': 'Budget must be a positive number'}), 400

    with get_db() as conn:
        conn.execute(
            '''INSERT INTO settings (user_email, budget)
               VALUES (?, ?)
               ON CONFLICT(user_email) DO UPDATE SET budget = excluded.budget''',
            (email, budget)
        )

    return jsonify({'message': 'Budget updated', 'budget': budget})


# ─────────────────────────────────────────────────────
# Error Handlers
# ─────────────────────────────────────────────────────
@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({'error': 'Method not allowed'}), 405

@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Internal server error'}), 500


# ─────────────────────────────────────────────────────
# Entry Point
# ─────────────────────────────────────────────────────
if __name__ == '__main__':
    init_db()
    sep = '-' * 50
    print('\n' + sep)
    print('  ExpensePro -- Python / Flask Server')
    print(sep)
    print('  Open:     http://localhost:5000')
    print(f'  Database: {DB_PATH}')
    print(sep + '\n')
    app.run(debug=False, host='0.0.0.0', port=5000)

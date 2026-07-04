# Full-Stack-AI-Powered-Python-Expense-Tracker

💎 EXPENSEPRO - PREMIUM EXPENSE TRACKER 

Overview
--------
ExpensePro is a sleek, AI-inspired, full-stack expense tracking application designed to help users manage their finances professionally. It features a modern, cyberpunk-infused aesthetic, comprehensive data visualization, and an intelligent wallet management system that tracks standard expenses alongside loans and custom payments.

Features
--------
1. Advanced Wallet & Balance Management
   - The dashboard dynamically tracks your Total Wallet Balance.
   - Supports 3 distinct transaction types:
     * EXPENSE: Standard spending (deducts from balance).
     * LOAN: Money borrowed (adds to balance, marked differently).
     * PAYMENT: Money paid to others (deducts from balance).
   - A dedicated Budget vs. Spent tracking box visually displays spending thresholds.

2. Premium UI / UX
   - Dynamic Particles.js Background: A smooth, interactive background effect on all pages (Login, Signup, Dashboard) that repulses elegantly on click to prevent performance issues.
   - Dual-Font System: The professional 'Poppins' font is used for high readability on data tables and inputs, while the sci-fi 'Orbitron' font and neon glow effects are applied selectively to key headers and statistics for a cyberpunk aesthetic.
   - Fully responsive design prioritizing mobile and desktop layouts with glassmorphic cards.

3. Secure User Authentication
   - Built-in user authentication with dedicated, stylish Login and Sign Up pages.
   - Passwords are securely hashed and managed via the backend database.

4. Interactive Data Visualization
   - Integrates Chart.js to render a "Spending by Category" Doughnut Chart.
   - Tooltips dynamically display not just totals, but specific lists of items inside each category upon hovering over chart segments.

5. Data Export
   - A powerful Excel/CSV export function.
   - Generates a beautifully formatted CSV report featuring a structured header, financial summary (Total Spent, Loans Taken, Total Repayments), and a detailed itemized table.

Code Structure & Architecture
-----------------------------
ExpensePro relies on a lightweight Python/Flask backend and a clean HTML/Vanilla JS frontend.

- Backend: 
  * `app.py`: The core Python Flask server. It handles routing, user authentication, API endpoints (adding/fetching/deleting expenses), and CSV report generation. It communicates directly with the SQLite database.
  * `expense_tracker.db`: A local SQLite database utilizing WAL mode for robust, concurrent data handling. It stores user credentials and transaction records.

- Frontend:
  * `index.html`: The main dashboard structure. Contains the charts, wallet balance display, transaction history table, and forms to add new transactions.
  * `login.html` & `signup.html`: Dedicated pages for user authentication, styled with premium particle effects and neon glows.
  * `style.css`: The massive, centralized stylesheet powering the entire application's visuals—including CSS variables, glassmorphism, responsive grids, fonts, and cyber-neon effects.
  * `logic.js`: The frontend controller for the dashboard. It fetches data from the backend APIs, computes wallet balances dynamically, renders the Chart.js visualizer, handles form submissions, and formats UI numbers.
  * `auth.js`: Handles logic for the login and registration forms, passing credentials to the backend safely.

How to Run the Application
--------------------------
1. Ensure Python 3.x is installed on your system.
2. Install the necessary Python backend package (Flask):
   `pip install flask`
3. Open a terminal/command prompt in the project directory and run the server:
   `python app.py`
4. The server will start locally. Open your web browser and navigate to:
   `http://localhost:5000`
5. Create a new account on the Signup page, log in, and start tracking!

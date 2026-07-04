// logic.js — Main Dashboard Logic

// ─────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────
let budgetLimit = 50000;
let currentUser = null;
let allExpenses = [];
let lineChart = null;
let doughnutChart = null;
let barChart = null;

const CATEGORY_COLORS = {
    'Food & Drinks': '#f59e0b',
    'Transport':     '#3b82f6',
    'Utilities':     '#10b981',
    'Entertainment': '#8b5cf6',
    'Shopping':      '#ec4899',
    'Healthcare':    '#ef4444',
    'Education':     '#06b6d4',
    'Other':         '#6b7280',
    'Others':        '#6b7280'
};

const CATEGORY_ICONS = {
    'Food & Drinks': '🍔',
    'Transport':     '🚗',
    'Utilities':     '💡',
    'Entertainment': '🎮',
    'Shopping':      '🛍️',
    'Healthcare':    '🏥',
    'Education':     '📚',
    'Other':         '📦',
    'Others':        '📦'
};

// ─────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) return window.location.href = 'login.html';

    document.getElementById('user-name-display').textContent = currentUser.fullname || 'User';
    document.getElementById('add-date-input').value = new Date().toISOString().split('T')[0];

    // Register form handlers
    document.getElementById('addExpenseForm').addEventListener('submit', handleAddExpense);
    document.getElementById('budgetForm').addEventListener('submit', handleBudgetUpdate);
    document.getElementById('editForm').addEventListener('submit', handleEditExpense);

    // Load budget from server, then expenses
    loadBudgetFromServer().then(() => loadExpensesFromServer());

    // Period filter buttons
    setupPeriodButtons();

    // Voice input
    initVoiceInput();
});

// ─────────────────────────────────────────────────────
// Flash / Toast
// ─────────────────────────────────────────────────────
function showFlash(message, type = 'success') {
    const container = document.getElementById('flash-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `flash-toast flash-${type}`;
    toast.innerHTML = `
        <span>${type === 'success' ? '✅' : '❌'} ${message}</span>
        <button onclick="this.parentElement.remove()" class="flash-close">✕</button>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'toastSlideOut 0.4s ease forwards';
            setTimeout(() => toast.remove(), 400);
        }
    }, 4000);
}

// ─────────────────────────────────────────────────────
// Budget
// ─────────────────────────────────────────────────────
async function loadBudgetFromServer() {
    try {
        const res = await fetch(`/api/settings/budget?email=${encodeURIComponent(currentUser.email)}`);
        if (res.ok) {
            const data = await res.json();
            budgetLimit = data.budget;
            localStorage.setItem('userBudget', budgetLimit);
        }
    } catch {
        budgetLimit = parseFloat(localStorage.getItem('userBudget')) || 50000;
    }
}

async function handleBudgetUpdate(e) {
    e.preventDefault();
    const newBudget = parseFloat(document.getElementById('budget-input').value);
    if (isNaN(newBudget) || newBudget <= 0) {
        showFlash('Please enter a valid budget amount.', 'error');
        return;
    }
    try {
        const res = await fetch('/api/settings/budget', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentUser.email, budget: newBudget })
        });
        if (res.ok) {
            budgetLimit = newBudget;
            localStorage.setItem('userBudget', newBudget);
            showFlash(`Budget set to PKR ${newBudget.toLocaleString()} 💼`, 'success');
            closeBudgetModal();
            renderExpenses(allExpenses);
        } else {
            const err = await res.json();
            showFlash(err.error || 'Failed to update budget', 'error');
        }
    } catch {
        showFlash('Server error. Is the server running?', 'error');
    }
}

function openBudgetModal() {
    document.getElementById('budget-input').value = budgetLimit;
    document.getElementById('budgetModal').style.display = 'flex';
}
function closeBudgetModal() {
    document.getElementById('budgetModal').style.display = 'none';
}

// ─────────────────────────────────────────────────────
// Expenses — Load from Server
// ─────────────────────────────────────────────────────
async function loadExpensesFromServer() {
    try {
        const res = await fetch(`/api/expenses?email=${encodeURIComponent(currentUser.email)}`);
        if (res.ok) {
            allExpenses = await res.json();
        } else {
            allExpenses = [];
        }
    } catch {
        console.warn('Server offline, using localStorage fallback');
        allExpenses = JSON.parse(localStorage.getItem('expenses') || '[]');
    }
    renderExpenses(allExpenses);
}

// ─────────────────────────────────────────────────────
// Add Expense
// ─────────────────────────────────────────────────────
async function handleAddExpense(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');

    const newExpense = {
        user_email: currentUser.email,
        type: form.type.value,
        description: form.desc.value.trim(),
        amount: parseFloat(form.amount.value),
        category: form.category.value,
        date: form.date.value
    };

    if (!newExpense.description || !newExpense.amount || !newExpense.category || !newExpense.date) {
        showFlash('Please fill in all fields.', 'error');
        return;
    }

    btn.textContent = '⏳ Adding...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newExpense)
        });

        if (res.ok) {
            form.reset();
            document.getElementById('add-date-input').value = new Date().toISOString().split('T')[0];
            showFlash('Expense added successfully! ✅', 'success');
            await loadExpensesFromServer();
        } else {
            const err = await res.json();
            showFlash(err.error || 'Failed to add expense', 'error');
        }
    } catch {
        showFlash('Server error. Is the server running?', 'error');
    } finally {
        btn.textContent = '✅ Add Expense';
        btn.disabled = false;
    }
}

// ─────────────────────────────────────────────────────
// Delete Expense
// ─────────────────────────────────────────────────────
async function deleteExpense(id) {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
        const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showFlash('Expense deleted.', 'success');
            await loadExpensesFromServer();
        } else {
            showFlash('Failed to delete expense.', 'error');
        }
    } catch {
        showFlash('Server error. Is the server running?', 'error');
    }
}

// ─────────────────────────────────────────────────────
// Edit Expense
// ─────────────────────────────────────────────────────
function editExpense(id) {
    const expense = allExpenses.find(e => e.id === id);
    if (!expense) return;

    document.getElementById('edit-id').value = expense.id;
    document.getElementById('edit-type').value = expense.type || 'expense';
    document.getElementById('edit-desc').value = expense.description;
    document.getElementById('edit-amount').value = expense.amount;
    document.getElementById('edit-category').value = expense.category;
    document.getElementById('edit-date').value = expense.date;
    document.getElementById('editModal').style.display = 'flex';
}

async function handleEditExpense(e) {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const updated = {
        type: document.getElementById('edit-type').value,
        description: document.getElementById('edit-desc').value.trim(),
        amount: parseFloat(document.getElementById('edit-amount').value),
        category: document.getElementById('edit-category').value,
        date: document.getElementById('edit-date').value
    };

    try {
        const res = await fetch(`/api/expenses/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated)
        });

        if (res.ok) {
            showFlash('Expense updated! ✅', 'success');
            closeModal();
            await loadExpensesFromServer();
        } else {
            const err = await res.json();
            showFlash(err.error || 'Failed to update expense', 'error');
        }
    } catch {
        showFlash('Server error.', 'error');
    }
}

function closeModal() {
    document.getElementById('editModal').style.display = 'none';
}
function closeBalanceModal() {
    const m = document.getElementById('balanceModal');
    if (m) m.style.display = 'none';
}

// ─────────────────────────────────────────────────────
// Export CSV
// ─────────────────────────────────────────────────────
function exportCSV() {
    const url = `/api/expenses/export?email=${encodeURIComponent(currentUser.email)}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `expenses_${currentUser.email}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showFlash('Downloading Excel report... 📊', 'success');
}

// ─────────────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────────────
function logout() {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userBudget');
    window.location.href = 'login.html';
}

// ─────────────────────────────────────────────────────
// Period Filter Buttons
// ─────────────────────────────────────────────────────
function setupPeriodButtons() {
    const params = new URLSearchParams(window.location.search);
    const period = params.get('period') || 'all';

    const btnAll = document.getElementById('btn-period-all');
    const btnMonth = document.getElementById('btn-period-month');
    const btnWeek = document.getElementById('btn-period-week');

    if (period === 'all' && btnAll) btnAll.classList.add('active');
    if (period === 'month' && btnMonth) btnMonth.classList.add('active');
    if (period === 'week' && btnWeek) btnWeek.classList.add('active');

    const weekNavContainer = document.getElementById('week-nav-container');
    if (weekNavContainer) {
        weekNavContainer.style.display = period === 'week' ? 'flex' : 'none';
    }
}

function getFilteredExpenses(expenses) {
    const params = new URLSearchParams(window.location.search);
    const period = params.get('period') || 'all';
    const search = (document.getElementById('searchInput')?.value || '').toLowerCase();

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return expenses.filter(e => {
        const eDate = new Date(e.date + 'T00:00:00');

        let inPeriod = true;
        if (period === 'week') inPeriod = eDate >= startOfWeek;
        else if (period === 'month') inPeriod = eDate >= startOfMonth;

        const matchesSearch = !search ||
            e.description.toLowerCase().includes(search) ||
            e.category.toLowerCase().includes(search);

        return inPeriod && matchesSearch;
    });
}

// ─────────────────────────────────────────────────────
// Render Expenses (main dashboard update)
// ─────────────────────────────────────────────────────
function renderExpenses() {
    const filtered = getFilteredExpenses(allExpenses);
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    const expensesOnly = filtered.filter(e => e.type === 'expense' || !e.type);
    const loansOnly = filtered.filter(e => e.type === 'loan');
    const paymentsOnly = filtered.filter(e => e.type === 'payment');

    const totalSpent = expensesOnly.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    const totalLoans = loansOnly.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    const totalPayments = paymentsOnly.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    
    const balance = budgetLimit - totalSpent + totalLoans - totalPayments;
    const usedPct = budgetLimit > 0 ? Math.min((totalSpent / budgetLimit) * 100, 100) : 0;

    // Update stat boxes
    document.getElementById('budget-val').textContent = budgetLimit.toLocaleString();
    document.getElementById('total-val').textContent = totalSpent.toLocaleString();
    document.getElementById('balance-val').textContent = balance.toLocaleString();
    document.getElementById('count-val').textContent = filtered.length;

    // Update loans and payments stats
    const loanEl = document.getElementById('loan-val');
    if (loanEl) loanEl.textContent = 'PKR ' + totalLoans.toLocaleString();
    
    const paymentEl = document.getElementById('payment-val');
    if (paymentEl) paymentEl.textContent = 'PKR ' + totalPayments.toLocaleString();

    // Update avg spend
    const avgEl = document.getElementById('avg-val');
    if (avgEl) {
        const avg = expensesOnly.length > 0 ? totalSpent / expensesOnly.length : 0;
        avgEl.textContent = 'PKR ' + avg.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }

    // Color balance red if over budget
    const balanceEl = document.getElementById('balance-val');
    balanceEl.style.color = balance < 0 ? '#ef4444' : '';

    // Budget progress bar
    const progressBar = document.getElementById('budget-progress-bar');
    const progressLabel = document.getElementById('budget-progress-label');
    if (progressBar) {
        progressBar.style.width = usedPct.toFixed(1) + '%';
        progressBar.style.background = usedPct > 90
            ? 'linear-gradient(90deg, #ef4444, #f87171)'
            : usedPct > 70
            ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
            : 'linear-gradient(90deg, #8b5cf6, #fbbf24)';
    }
    if (progressLabel) {
        progressLabel.textContent = `${usedPct.toFixed(1)}% of budget used`;
        progressLabel.style.color = usedPct > 90 ? '#ef4444' : usedPct > 70 ? '#fbbf24' : '#a78bfa';
    }

    // Render table rows
    const tbody = document.getElementById('expense-table-body');
    tbody.innerHTML = '';

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; color:#6b7280; padding: 3rem;">
                    <div style="font-size:3rem; margin-bottom:1rem;">📭</div>
                    <div>No transactions found for this period.</div>
                </td>
            </tr>`;
    } else {
        filtered.forEach(e => {
            const icon = CATEGORY_ICONS[e.category] || '📦';
            const color = CATEGORY_COLORS[e.category] || '#6b7280';
            const formattedDate = new Date(e.date + 'T00:00:00').toLocaleDateString('en-PK', {
                day: '2-digit', month: 'short', year: 'numeric'
            });
            const typeStr = e.type || 'expense';
            let typeBadge = '';
            if (typeStr === 'expense') typeBadge = '<span style="color:#a78bfa; font-size:0.8rem;">💸 Expense</span>';
            else if (typeStr === 'loan') typeBadge = '<span style="color:#10b981; font-size:0.8rem;">🤝 Loan</span>';
            else if (typeStr === 'payment') typeBadge = '<span style="color:#ef4444; font-size:0.8rem;">📤 Payment</span>';
            
            tbody.innerHTML += `
                <tr>
                    <td style="color:#94a3b8; white-space:nowrap;">${formattedDate}</td>
                    <td>${typeBadge}</td>
                    <td>
                        <div style="font-weight:600; color:#f3f4f6;">${e.description}</div>
                    </td>
                    <td>
                        <span class="category-badge" style="background:${color}22; color:${color}; border:1px solid ${color}44;">
                            ${icon} ${e.category}
                        </span>
                    </td>
                    <td style="font-weight:700; color:#fbbf24; white-space:nowrap;">PKR ${parseFloat(e.amount).toLocaleString()}</td>
                    <td>
                        <div class="action-btns">
                            <button class="btn-edit" onclick="editExpense('${e.id}')" title="Edit">✏️</button>
                            <button class="btn-delete" onclick="deleteExpense('${e.id}')" title="Delete">🗑️</button>
                        </div>
                    </td>
                </tr>`;
        });
    }

    // Update all charts (using only actual expenses)
    updateCharts(expensesOnly);

    // Update AI insights (using only actual expenses)
    updateAIInsights(expensesOnly, totalSpent);
}

// ─────────────────────────────────────────────────────
// Charts
// ─────────────────────────────────────────────────────
function updateCharts(expenses) {
    if (typeof Chart === 'undefined') return;
    updateDoughnutChart(expenses);
}

function updateDoughnutChart(expenses) {
    const ctx = document.getElementById('doughnutChart');
    if (!ctx) return;

    // Group by category
    const catTotals = {};
    const catItems = {};
    expenses.forEach(e => {
        const cat = e.category;
        catTotals[cat] = (catTotals[cat] || 0) + parseFloat(e.amount || 0);
        if (!catItems[cat]) catItems[cat] = [];
        catItems[cat].push(`• ${e.description} (PKR ${parseFloat(e.amount).toLocaleString()})`);
    });

    const labels = Object.keys(catTotals);
    const data = Object.values(catTotals);
    const colors = labels.map(l => CATEGORY_COLORS[l] || '#6b7280');

    if (doughnutChart) doughnutChart.destroy();

    if (labels.length === 0) {
        ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
        return;
    }

    doughnutChart = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors.map(c => c + 'cc'),
                borderColor: colors,
                borderWidth: 2,
                hoverOffset: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#d1d5db',
                        padding: 15,
                        font: { size: 12, family: 'Poppins' },
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ` PKR ${ctx.parsed.toLocaleString()} (${((ctx.parsed / ctx.dataset.data.reduce((a,b)=>a+b,0))*100).toFixed(1)}%)`,
                        afterBody: ctx => {
                            if (ctx.length > 0) {
                                const cat = ctx[0].label;
                                const items = catItems[cat] || [];
                                return '\n' + items.join('\n');
                            }
                            return '';
                        }
                    },
                    backgroundColor: 'rgba(15,5,32,0.95)',
                    titleColor: '#fbbf24',
                    bodyColor: '#d1d5db',
                    borderColor: 'rgba(139,92,246,0.4)',
                    borderWidth: 1,
                    padding: 12
                }
            }
        }
    });
}


// ─────────────────────────────────────────────────────
// AI Insights
// ─────────────────────────────────────────────────────
function updateAIInsights(expenses, totalSpent) {
    const el = document.getElementById('ai-insights-box');
    if (!el) return;

    if (expenses.length === 0) {
        el.textContent = '💡 No expenses yet. Add your first transaction to get AI-powered spending insights!';
        return;
    }

    // Find top category
    const catMap = {};
    expenses.forEach(e => {
        catMap[e.category] = (catMap[e.category] || 0) + parseFloat(e.amount || 0);
    });
    const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];

    const usedPct = budgetLimit > 0 ? (totalSpent / budgetLimit) * 100 : 0;
    const avgPerDay = expenses.length > 0
        ? (totalSpent / Math.max(new Set(expenses.map(e => e.date)).size, 1))
        : 0;

    let insight = '';

    if (usedPct > 100) {
        insight = `🚨 Alert! You've exceeded your budget by PKR ${Math.abs(budgetLimit - totalSpent).toLocaleString()}. Your top spending category is ${topCat[0]} (PKR ${topCat[1].toLocaleString()}). Consider cutting back immediately!`;
    } else if (usedPct > 80) {
        insight = `⚠️ You've used ${usedPct.toFixed(0)}% of your budget. Top spending: ${topCat[0]} at PKR ${topCat[1].toLocaleString()}. Average daily spend is PKR ${avgPerDay.toLocaleString(undefined, {maximumFractionDigits: 0})}. Slow down on non-essentials.`;
    } else if (usedPct > 50) {
        insight = `📊 On track! You've used ${usedPct.toFixed(0)}% of your budget. ${topCat[0]} is your biggest expense category. Daily average: PKR ${avgPerDay.toLocaleString(undefined, {maximumFractionDigits: 0})}.`;
    } else {
        insight = `✅ Great job! Only ${usedPct.toFixed(0)}% of your budget used. You're saving well! Main spending area: ${topCat[0]}. Keep it up!`;
    }

    el.className = 'ai-content';
    el.textContent = insight;
}

// ─────────────────────────────────────────────────────
// Voice Input
// ─────────────────────────────────────────────────────
function initVoiceInput() {
    const voiceBtn = document.getElementById('voiceKey');
    if (!voiceBtn) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        voiceBtn.style.display = 'none';
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    let listening = false;

    window.voiceApp = {
        toggle() {
            if (listening) {
                recognition.stop();
            } else {
                recognition.start();
            }
        }
    };

    recognition.onstart = () => {
        listening = true;
        voiceBtn.classList.add('listening');
        const status = document.getElementById('voiceStatus');
        if (status) status.textContent = '🎤 Listening...';
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const descInput = document.querySelector('#addExpenseForm [name="desc"]');
        if (descInput) descInput.value = transcript;
        const status = document.getElementById('voiceStatus');
        if (status) status.textContent = `✅ Captured: "${transcript}"`;
    };

    recognition.onend = () => {
        listening = false;
        voiceBtn.classList.remove('listening');
        setTimeout(() => {
            const status = document.getElementById('voiceStatus');
            if (status) status.textContent = '';
        }, 3000);
    };

    recognition.onerror = (event) => {
        listening = false;
        voiceBtn.classList.remove('listening');
        showFlash('Voice input error: ' + event.error, 'error');
    };
}
// auth.js — Authentication & Flash Messages

// ─────────────────────────────────────────────────────
// Flash / Toast Notification
// ─────────────────────────────────────────────────────
function showFlash(message, type = 'success') {
    // Try page-specific flash elements first
    const flashEl = document.getElementById('flash-message');
    if (flashEl) {
        flashEl.textContent = message;
        flashEl.style.display = 'block';
        flashEl.style.backgroundColor = type === 'success'
            ? 'rgba(16, 185, 129, 0.12)'
            : 'rgba(248, 113, 113, 0.12)';
        flashEl.style.borderColor = type === 'success' ? '#10b981' : '#f87171';
        flashEl.style.color = type === 'success' ? '#10b981' : '#f87171';
        setTimeout(() => { flashEl.style.display = 'none'; }, 4000);
        return;
    }
    // Fallback: floating toast
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed; bottom: 30px; right: 30px; z-index: 9999;
        padding: 16px 24px; border-radius: 16px; font-weight: 600;
        font-family: 'Poppins', sans-serif; font-size: 0.95rem;
        backdrop-filter: blur(20px); animation: toastSlideIn 0.4s ease;
        max-width: 360px; box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        border: 1px solid ${type === 'success' ? 'rgba(16,185,129,0.4)' : 'rgba(248,113,113,0.4)'};
        background: ${type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(248,113,113,0.15)'};
        color: ${type === 'success' ? '#6ee7b7' : '#fca5a5'};
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastSlideOut 0.4s ease forwards';
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

// ─────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────
async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const email = form.elements['email'].value.trim();
    const password = form.elements['password'].value.trim();

    if (!email || !password) {
        showFlash('Please fill in all fields.', 'error');
        return;
    }

    btn.textContent = '⏳ Signing in...';
    btn.disabled = true;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            localStorage.setItem('userBudget', data.budget);
            window.location.href = 'index.html';
        } else {
            showFlash(data.error || 'Invalid credentials', 'error');
            btn.textContent = '🚀 Login to Dashboard';
            btn.disabled = false;
        }
    } catch (error) {
        showFlash('Cannot reach server. Please run: npm start', 'error');
        btn.textContent = '🚀 Login to Dashboard';
        btn.disabled = false;
    }
}

// ─────────────────────────────────────────────────────
// Signup
// ─────────────────────────────────────────────────────
async function handleSignup(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const fullname = form.elements['fullname'].value.trim();
    const email = form.elements['email'].value.trim();
    const password = form.elements['password'].value.trim();

    if (!fullname || !email || !password) {
        showFlash('Please fill in all fields.', 'error');
        return;
    }
    if (password.length < 6) {
        showFlash('Password must be at least 6 characters.', 'error');
        return;
    }

    btn.textContent = '⏳ Creating account...';
    btn.disabled = true;

    try {
        const response = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullname, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            showFlash('Account created! Redirecting to login...', 'success');
            setTimeout(() => { window.location.href = 'login.html'; }, 1500);
        } else {
            showFlash(data.error || 'Signup failed', 'error');
            btn.textContent = '✅ Create Account';
            btn.disabled = false;
        }
    } catch (error) {
        showFlash('Cannot reach server. Please run: npm start', 'error');
        btn.textContent = '✅ Create Account';
        btn.disabled = false;
    }
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
// Event Listeners
// ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    const signupForm = document.getElementById('signupForm');
    if (signupForm) signupForm.addEventListener('submit', handleSignup);
});
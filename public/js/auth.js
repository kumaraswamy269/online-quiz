/**
 * Authentication Helper for Vanilla HTML Pages
 */

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const errorMessage = document.getElementById('errorMessage');

  const showError = (msg) => {
    if (errorMessage) {
      errorMessage.textContent = msg;
      errorMessage.style.display = 'block';
    } else {
      alert(msg);
    }
  };

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;

      try {
        const res = await window.api.login(email, password);
        const user = res.data.user;
        if (user.role === 'admin') {
          window.location.href = '/admin/dashboard.html';
        } else {
          window.location.href = '/dashboard.html';
        }
      } catch (err) {
        showError(err.message || 'Login failed. Please check your credentials.');
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const role = document.getElementById('role') ? document.getElementById('role').value : 'student';

      try {
        await window.api.register(name, email, password, role);
        window.location.href = role === 'admin' ? '/admin/dashboard.html' : '/dashboard.html';
      } catch (err) {
        showError(err.message || 'Registration failed.');
      }
    });
  }
});

document.addEventListener('DOMContentLoaded', () => {
    // Tab switching functionality
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
  
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        
        // Update active tab button
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Show corresponding tab content
        tabContents.forEach(content => {
          content.classList.remove('active');
          if (content.id === tabId) {
            content.classList.add('active');
          }
        });
      });
    });
  
    // Password confirmation validation
    const registerForm = document.querySelector('#register form');
    if (registerForm) {
      const passwordInput = document.getElementById('register-password');
      const confirmPasswordInput = document.getElementById('register-confirm-password');
      
      registerForm.addEventListener('submit', (e) => {
        if (passwordInput.value !== confirmPasswordInput.value) {
          e.preventDefault();
          alert('Passwords do not match!');
          confirmPasswordInput.focus();
        }
      });
    }
  
    // Form submission with fetch API for better UX
    const loginForm = document.querySelector('#login form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(loginForm);
        const data = {
          username: formData.get('username'),
          password: formData.get('password')
        };
  
        try {
          const response = await fetch('/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
          });
  
          if (response.redirected) {
            window.location.href = response.url;
          } else {
            const result = await response.json();
            if (result.error) {
              showAlert(result.error, 'error');
            }
          }
        } catch (err) {
          console.error('Login error:', err);
          showAlert('An error occurred during login', 'error');
        }
      });
    }
  
    // Enhanced registration form handling
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(registerForm);
        const data = {
          username: formData.get('username'),
          email: formData.get('email'),
          password: formData.get('password'),
          confirmPassword: formData.get('confirmPassword')
        };
  
        if (data.password !== data.confirmPassword) {
          return showAlert('Passwords do not match', 'error');
        }
  
        try {
          const response = await fetch('/auth/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
          });
  
          if (response.redirected) {
            window.location.href = response.url;
          } else {
            const result = await response.json();
            if (result.error) {
              showAlert(result.error, 'error');
            }
          }
        } catch (err) {
          console.error('Registration error:', err);
          showAlert('An error occurred during registration', 'error');
        }
      });
    }
  
    // Helper function to show alerts
    function showAlert(message, type) {
      // Remove any existing alerts
      const existingAlert = document.querySelector('.alert');
      if (existingAlert) {
        existingAlert.remove();
      }
  
      const alertDiv = document.createElement('div');
      alertDiv.className = `alert alert-${type}`;
      alertDiv.textContent = message;
  
      const authBox = document.querySelector('.auth-box');
      authBox.insertBefore(alertDiv, authBox.firstChild);
  
      // Auto-remove after 5 seconds
      setTimeout(() => {
        alertDiv.remove();
      }, 5000);
    }
  
    // Input validation
    const usernameInputs = document.querySelectorAll('input[type="text"][name="username"]');
    usernameInputs.forEach(input => {
      input.addEventListener('input', () => {
        input.value = input.value.replace(/[^a-zA-Z0-9_]/g, '');
      });
    });
  
    // Password strength indicator
    const passwordInput = document.getElementById('register-password');
    if (passwordInput) {
      passwordInput.addEventListener('input', () => {
        const strengthIndicator = document.createElement('div');
        strengthIndicator.className = 'password-strength';
        
        const strength = checkPasswordStrength(passwordInput.value);
        strengthIndicator.innerHTML = `Strength: <span class="strength-${strength.level}">${strength.text}</span>`;
        
        const existingIndicator = document.querySelector('.password-strength');
        if (existingIndicator) {
          existingIndicator.replaceWith(strengthIndicator);
        } else {
          passwordInput.insertAdjacentElement('afterend', strengthIndicator);
        }
      });
    }
  
    function checkPasswordStrength(password) {
      const strength = {
        0: { level: 0, text: 'Very Weak' },
        1: { level: 1, text: 'Weak' },
        2: { level: 2, text: 'Moderate' },
        3: { level: 3, text: 'Strong' },
        4: { level: 4, text: 'Very Strong' }
      };
      
      let score = 0;
      if (password.length === 0) return strength[0];
      if (password.length > 6) score++;
      if (password.length > 10) score++;
      if (/[A-Z]/.test(password)) score++;
      if (/[0-9]/.test(password)) score++;
      if (/[^A-Za-z0-9]/.test(password)) score++;
      
      return strength[Math.min(score, 4)];
    }
  });
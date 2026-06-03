const showLogin = document.getElementById('show-login');
const showRegister = document.getElementById('show-register');
const wizardSection = document.getElementById('wizard-section');
const wizardTitle = document.getElementById('wizard-title');
const wizardDescription = document.getElementById('wizard-description');
const wizardBadge = document.getElementById('wizard-badge');
const roleStep = document.getElementById('role-step');
const detailsStep = document.getElementById('details-step');
const paymentStep = document.getElementById('payment-step');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const roleOptions = document.querySelectorAll('.role-option');
const stepPills = document.querySelectorAll('.step-pill');
const closeForm = document.getElementById('close-form');
const loginSubmit = document.getElementById('login-submit');
const continueToPayment = document.getElementById('continue-to-payment');
const backToDetails = document.getElementById('back-to-details');
const registerSubmit = document.getElementById('register-submit');
const welcomeSection = document.getElementById('welcome-section');
const welcomeHeading = document.getElementById('welcome-heading');
const welcomeText = document.getElementById('welcome-text');
const welcomeMeta = document.getElementById('welcome-meta');
const resetButton = document.getElementById('reset');
const selectedRoleTitle = document.getElementById('selected-role-title');
const selectedRoleCopy = document.getElementById('selected-role-copy');
const selectedRoleTag = document.getElementById('selected-role-tag');
const rankField = document.getElementById('rank-field');
const rankSelect = document.getElementById('rank-select');
const backToHome = document.getElementById('back-to-home');
const paymentOptions = document.querySelectorAll('.payment-option');

// ── Clave de sesión unificada (igual en todos los dashboards) ──
const SESSION_KEY = 'lutaedanca_user';

const persistSession = (user) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
};

const redirectToProfesorDashboard = (user) => {
  persistSession(user);
  window.location.assign('profesor-dashboard.html');
};

const redirectToStudentDashboard = (user) => {
  persistSession(user);
  window.location.assign('student-dashboard.html');
};
const redirectToModeratorDashboard = (user) => {
  persistSession(user);
  window.location.assign('moderador-dashboard.html');
}
const apiRequest = async (endpoint, payload) => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Error del servidor');
  return data;
};

const roleContent = {
  alumno: {
    label: 'Alumno',
    title: 'Alumno',
    copy: 'Entrena técnicas, recibe feedback y avanza en tu camino de grappling con clases guiadas.',
    accent: 'Entrenamiento'
  },
  profesor: {
    label: 'Profesor',
    title: 'Profesor',
    copy: 'Dirige sesiones, comparte metodología y construye una comunidad de entrenamiento fuerte.',
    accent: 'Enseñanza'
  },
  moderator: {
    label: 'Moderador',
    title: 'Moderador',
    copy: 'Supervisa la comunidad, gestiona contenido y asegura un ambiente positivo para todos.',
    accent: 'Moderación'
  },
  moderador: {
    label: 'Moderador',
    title: 'Moderador',
    copy: 'Supervisa la comunidad, gestiona contenido y asegura un ambiente positivo para todos.',
    accent: 'Moderación'
  }
};

let selectedRole = 'alumno';

function resetSteps() {
  roleStep.classList.remove('hidden');
  detailsStep.classList.add('hidden');
  paymentStep.classList.add('hidden');
  loginForm.classList.add('hidden');
  registerForm.classList.add('hidden');
  rankField.classList.add('hidden');
  rankSelect.value = '';
  stepPills.forEach(pill => pill.classList.remove('active'));
  document.querySelector('[data-step="role"]').classList.add('active');
  roleOptions.forEach(btn => btn.classList.remove('active'));
  selectedRole = 'alumno';
  updateRoleSelection(selectedRole);
}

function showStudentDetails() {
  detailsStep.classList.remove('hidden');
  paymentStep.classList.add('hidden');
  registerForm.classList.remove('hidden');
  loginForm.classList.add('hidden');

  if (selectedRole === 'alumno') {
    rankField.classList.remove('hidden');
    wizardTitle.textContent = 'Cuenta alumno';
    wizardDescription.textContent = 'Elige tu faixa, completa tus datos y continúa con el pago.';
  } else {
    rankField.classList.add('hidden');
    wizardTitle.textContent = 'Cuenta profesor';
    wizardDescription.textContent = 'Completa tus datos y continúa con el pago para solicitar la revisión docente.';
  } if (selectedRole === 'moderator') {
      rankField.classList.add('hidden');
      wizardTitle.textContent = 'Cuenta moderador';
      wizardDescription.textContent = 'Completa tus datos y continúa con el proceso para convertirte en moderador.';
  }

  wizardBadge.textContent = 'Datos del perfil';
  stepPills.forEach(pill => pill.classList.remove('active'));
  document.querySelector('[data-step="details"]').classList.add('active');
}

function updateRoleSelection(role) {
  selectedRole = role;
  const content = roleContent[role];
  selectedRoleTitle.textContent = content.title;
  selectedRoleCopy.textContent = content.copy;
  selectedRoleTag.textContent = content.label;
  roleOptions.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.role === role);
  });
}

function setStep(step, mode = 'register') {
  roleStep.classList.add('hidden');
  detailsStep.classList.add('hidden');
  paymentStep.classList.add('hidden');
  stepPills.forEach(pill => pill.classList.remove('active'));
  document.querySelector(`[data-step="${step}"]`).classList.add('active');

  if (step === 'role') {
    roleStep.classList.remove('hidden');
    wizardTitle.textContent = 'Elige tu camino';
    wizardDescription.textContent = 'Selecciona si quieres entrenar como alumno o guiar como profesor.';
    wizardBadge.textContent = 'Crea tu cuenta';
  }

  if (step === 'details') {
    detailsStep.classList.remove('hidden');
    if (mode === 'login') {
      loginForm.classList.remove('hidden');
      registerForm.classList.add('hidden');
      wizardTitle.textContent = 'Iniciar sesión';
      wizardDescription.textContent = 'Accede a tu espacio de entrenamiento con tu email y contraseña.';
      wizardBadge.textContent = 'Acceso rápido';
    } else {
      showStudentDetails();
    }
  }

  if (step === 'payment') {
    paymentStep.classList.remove('hidden');
    wizardTitle.textContent = 'Método de pago';
    wizardDescription.textContent = 'Elige cómo quieres cubrir tu plan y confirma tu cuenta.';
    wizardBadge.textContent = 'Finaliza tu alta';
  }
}

function resetView() {
  wizardSection.classList.add('hidden');
  welcomeSection.classList.add('hidden');
  document.getElementById('register-name').value = '';
  document.getElementById('register-email').value = '';
  document.getElementById('register-password').value = '';
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  rankSelect.value = '';
  const firstPayment = document.querySelector('input[name="payment-method"][value="tarjeta"]');
  if (firstPayment) firstPayment.checked = true;
  paymentOptions.forEach(opt => opt.classList.remove('active'));
  const firstOpt = document.querySelector('.payment-option');
  if (firstOpt) firstOpt.classList.add('active');
  resetSteps();
}

function showWizard(mode = 'register') {
  wizardSection.classList.remove('hidden');
  resetSteps();
  if (mode === 'login') {
    setStep('details', 'login');
  } else {
    setStep('role');
  }
  // Desplazar suavemente hacia la sección del asistente para una experiencia didáctica
  setTimeout(() => {
    wizardSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 60);
}

function showWelcome(role, name, paymentMethod = 'tarjeta') {
  wizardSection.classList.add('hidden');
  welcomeSection.classList.remove('hidden');

  const paymentLabel = { tarjeta: 'Tarjeta', paypal: 'PayPal', transferencia: 'Transferencia' }[paymentMethod] || 'Tarjeta';

  if (role === 'profesor') {
    welcomeHeading.textContent = `Bienvenido, ${name || 'profesor'}!`;
    welcomeText.textContent = 'Puedes guiar alumnos, compartir técnicas y construir una comunidad de entrenamiento fuerte.';
  } else if (role === 'moderator' || role === 'moderador') {
    welcomeHeading.textContent = `Bienvenido, ${name || 'moderador'}!`;
    welcomeText.textContent = 'Gracias por unirte como moderador. Tu rol es crucial para mantener una comunidad positiva y constructiva.';
  } else {
    welcomeHeading.textContent = `Bienvenido, ${name || 'alumno'}!`;
    welcomeText.textContent = 'Prepárate para entrenar, mejorar tus técnicas y avanzar en tu camino de grappling.';
  }

  const roleMetaLabel = roleContent[role]?.label || role;
  const chips = [`<span class="meta-chip">Rol: ${roleMetaLabel}</span>`];
  if (role === 'alumno' && rankSelect.value) {
    chips.push(`<span class="meta-chip">Rango: ${rankSelect.value}</span>`);
  }
  chips.push(`<span class="meta-chip">Pago: ${paymentLabel}</span>`);
  welcomeMeta.innerHTML = chips.join('');
}

// ── Listeners ──────────────────────────────────────────────────

showLogin.addEventListener('click', () => showWizard('login'));
showRegister.addEventListener('click', () => showWizard('register'));

roleOptions.forEach(option => {
  option.addEventListener('click', () => {
    updateRoleSelection(option.dataset.role);
    showStudentDetails();
  });
});

continueToPayment.addEventListener('click', () => {
  const requiredFields = ['register-name', 'register-email', 'register-password'];
  const hasEmpty = requiredFields.some(id => !document.getElementById(id).value.trim());
  if (hasEmpty) return;
  if (selectedRole === 'alumno' && !rankSelect.value) { rankSelect.focus(); return; }
  setStep('payment');
});

backToDetails.addEventListener('click', () => showStudentDetails());
backToHome.addEventListener('click', () => resetView());
closeForm.addEventListener('click', resetView);

paymentOptions.forEach(option => {
  option.addEventListener('click', () => {
    paymentOptions.forEach(item => item.classList.remove('active'));
    option.classList.add('active');
    const input = option.querySelector('input[type="radio"]');
    if (input) input.checked = true;
  });
});

// ── LOGIN ───────────────────────────────────────────────────────
loginSubmit.addEventListener('click', async () => {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();
  if (!email || !password) return;

  loginSubmit.disabled = true;
  try {
    const data = await apiRequest('/api/login', { email, password });
  const normalizedRole = data.user.rol === 'moderador' ? 'moderador' : data.user.rol;

    if (normalizedRole === 'alumno')   { redirectToStudentDashboard(data.user); return; }
    if (normalizedRole === 'profesor') { redirectToProfesorDashboard(data.user); return; }
    if (normalizedRole === 'moderador' || normalizedRole === 'moderator') { redirectToModeratorDashboard(data.user); return; }
    showWelcome(normalizedRole, data.user.nombre, data.user.metodo_pago);
  } catch (error) {
    alert(error.message);
  } finally {
    loginSubmit.disabled = false;
  }
});

// ── REGISTER  ──────────────────
registerSubmit.addEventListener('click', async () => {
  const name     = document.getElementById('register-name').value.trim();
  const email    = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value.trim();
  if (!name || !email || !password) return;
  if (selectedRole === 'alumno' && !rankSelect.value) { rankSelect.focus(); return; }

  const paymentMethod = document.querySelector('input[name="payment-method"]:checked')?.value || 'tarjeta';

  registerSubmit.disabled = true;
  try {
    const data = await apiRequest('/api/register', {
      nombre:       name,
      email,
      password,
      rol:          selectedRole,
      rango:        selectedRole === 'alumno' ? rankSelect.value : null,
      metodo_pago:  paymentMethod
    });

    if (data.user.rol === 'alumno')   { redirectToStudentDashboard(data.user); return; }
    if (data.user.rol === 'profesor') { redirectToProfesorDashboard(data.user); return; }

    showWelcome(data.user.rol, data.user.nombre, data.user.metodo_pago);
  } catch (error) {
    alert(error.message);
  } finally {
    registerSubmit.disabled = false;
  }
});

resetButton.addEventListener('click', () => {
  welcomeSection.classList.add('hidden');
  resetView();
});

resetView();

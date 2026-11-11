const form = document.querySelector('form');
const codeInput = document.querySelector('input');
const statusText = document.querySelector('#status');
const heading = document.querySelector('#heading');
const manualSection = document.querySelector('#manual');
const confirmationSection = document.querySelector('#done');

const LoginState = {
  Waiting: 'waiting',
  Exchanging: 'exchanging',
  Connected: 'connected',
  Cancelled: 'cancelled',
  Expired: 'expired',
  Failed: 'failed',
};

const stateLabels = {
  [LoginState.Waiting]: 'Ожидаем вход в браузере…',
  [LoginState.Exchanging]: 'Проверяем код…',
  [LoginState.Connected]: 'Теперь можно вернуться к вашему агенту.',
  [LoginState.Cancelled]: 'Вход отменён.',
  [LoginState.Expired]: 'Время входа истекло. Начните новую попытку в агенте.',
  [LoginState.Failed]: 'Не удалось завершить вход.',
};

async function poll() {
  const response = await fetch('./status', { cache: 'no-store' });
  const view = await response.json();
  statusText.textContent = (stateLabels[view.state] || view.state) + (view.error ? ' — ' + view.error : '');
  const pending = view.state === LoginState.Waiting || view.state === LoginState.Exchanging;

  if (pending) {
    return;
  }

  if (view.state === LoginState.Connected) {
    heading.textContent = heading.dataset.successLabel;
    manualSection.hidden = true;
    confirmationSection.hidden = false;
  } else {
    form.hidden = true;
  }

  clearInterval(timer);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const code = codeInput.value;
  codeInput.value = '';
  await fetch('./submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-PTAI-Login': form.dataset.loginToken },
    body: JSON.stringify({ code }),
  });
  await poll();
});

const timer = setInterval(
  () =>
    poll().catch(() => {
      statusText.textContent = 'Локальная страница входа закрыта.';
      clearInterval(timer);
    }),
  3000,
);
poll().catch(() => {});

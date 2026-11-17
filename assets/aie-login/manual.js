const form = document.querySelector('form');
const codeInput = document.querySelector('input');
const statusText = document.querySelector('#status');
const heading = document.querySelector('#heading');
const manualSection = document.querySelector('#manual');
const confirmationSection = document.querySelector('#done');
const tlsHelp = document.querySelector('#tls-help');

const LoginState = {
  Waiting: 'waiting',
  Exchanging: 'exchanging',
  Connected: 'connected',
  Cancelled: 'cancelled',
  Expired: 'expired',
  Failed: 'failed',
};

const stateLabels = {
  [LoginState.Waiting]: statusText.dataset.waiting,
  [LoginState.Exchanging]: statusText.dataset.exchanging,
  [LoginState.Connected]: statusText.dataset.connected,
  [LoginState.Cancelled]: statusText.dataset.cancelled,
  [LoginState.Expired]: statusText.dataset.expired,
  [LoginState.Failed]: statusText.dataset.failed,
};

async function poll() {
  const response = await fetch('./status', { cache: 'no-store' });
  const view = await response.json();
  const label = stateLabels[view.state] || view.state;
  statusText.textContent = view.error ? label.replace(/[.!?]$/, '') + ': ' + view.error : label;
  const pending = view.state === LoginState.Waiting || view.state === LoginState.Exchanging;

  if (pending) {
    return;
  }

  tlsHelp.hidden = view.state !== LoginState.Failed || view.certificate_error !== true;

  if (view.state === LoginState.Connected) {
    heading.textContent = heading.dataset.successLabel;
    manualSection.hidden = true;
    confirmationSection.hidden = false;
  } else {
    form.hidden = true;
    manualSection.hidden = true;
    confirmationSection.hidden = !tlsHelp.hidden;
    confirmationSection.textContent = statusText.dataset.retry;
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
      statusText.textContent = statusText.dataset.closed;
      clearInterval(timer);
    }),
  3000,
);
poll().catch(() => {});

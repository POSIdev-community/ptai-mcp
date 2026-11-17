const LoginLanguage = { English: 'en', Russian: 'ru' } as const;

export const loginTranslations = {
  en: {
    title: 'Sign in to PT AI MCP',
    successTitle: 'Signed in to PT AI MCP',
    heading: 'Connect AIE to your AI agent',
    success: 'Signed in',
    waiting: 'Waiting for sign-in in the browser…',
    exchanging: 'Checking the code…',
    connected: 'You can now return to your agent.',
    cancelled: 'Sign-in cancelled.',
    expired: 'Sign-in expired. Start a new attempt in your agent.',
    failed: 'Could not complete sign-in.',
    closed: 'The local sign-in page has closed.',
    serverLabel: 'Server',
    instructions: 'If AIE displayed a code, enter it here and click Continue.',
    explanation:
      'The AIE page may ask you to return to Visual Studio and refer to the code as a token. Use this form to connect to your AI agent. You do not need to open Visual Studio.',
    code: 'Authorization code',
    submit: 'Continue',
    hint: 'Do not paste the code into the agent chat. If sign-in has expired, start a new sign-in in your agent.',
    retry:
      'Return to your agent to check the sign-in status. After resolving the problem, start a new attempt with new links and a new code.',
    done: 'Connected to AIE. You can close this tab.',
    tlsHelp: 'Ways to resolve the certificate error',
    tlsCaTitle: 'Add a trusted certificate (recommended)',
    tlsCaBody:
      'Get the CA certificate in PEM format from your administrator and ask your agent to add it to the MCP configuration.',
    tlsExceptionTitle: 'Allow an exception for this development server',
    tlsExceptionBody:
      'This disables certificate verification for this address. Use only for a development server you trust. Explicitly authorize your agent to add the exception.',
    tlsExample: 'Configuration example',
    tlsCaHint: 'Set NODE_EXTRA_CA_CERTS in the MCP launch environment to the full path of the PEM file.',
    tlsCertificateHint:
      'If the certificate has expired or the hostname does not match, fix the certificate or server URL.',
    tlsExceptionHint: 'Add this address to PTAI_MCP_AIE_INSECURE_TLS_ORIGINS in the MCP launch environment.',
    tlsRestart:
      'After changing the settings, reconnect MCP or restart your client, then ask your agent to start a new sign-in.',
  },
  ru: {
    title: 'Вход в PT AI MCP',
    successTitle: 'Вход в PT AI MCP выполнен',
    heading: 'Подключение AIE к AI-агенту',
    success: 'Успешный вход',
    waiting: 'Ожидание входа в браузере…',
    exchanging: 'Проверка кода…',
    connected: 'Теперь можно вернуться к вашему агенту.',
    cancelled: 'Вход отменен.',
    expired: 'Время входа истекло. Начните новую попытку в агенте.',
    failed: 'Не удалось завершить вход.',
    closed: 'Локальная страница входа закрыта.',
    serverLabel: 'Сервер',
    instructions: 'Если AIE показал код, введите его здесь и нажмите «Продолжить».',
    explanation:
      'Страница AIE может предлагать вернуться в Visual Studio и называть код токеном. Для подключения к AI-агенту используйте эту форму. Visual Studio открывать не нужно.',
    code: 'Код авторизации',
    submit: 'Продолжить',
    hint: 'Не вставляйте код в чат агента. Если время входа истекло, начните новый вход в агенте.',
    retry:
      'Вернитесь к агенту, чтобы проверить состояние входа. После устранения проблемы начните новую попытку с новыми ссылками и кодом.',
    done: 'Подключение к AIE установлено. Эту вкладку можно закрыть.',
    tlsHelp: 'Как устранить ошибку сертификата',
    tlsCaTitle: 'Добавить доверенный сертификат (рекомендуется)',
    tlsCaBody:
      'Получите у администратора сертификат центра сертификации в формате PEM и попросите агента добавить его в конфигурацию MCP.',
    tlsExceptionTitle: 'Разрешить исключение для тестового стенда',
    tlsExceptionBody:
      'Отключает проверку сертификата для этого адреса. Используйте только для доверенного тестового стенда. Явно разрешите агенту добавить исключение.',
    tlsExample: 'Пример настройки',
    tlsCaHint: 'Задайте NODE_EXTRA_CA_CERTS в окружении запуска MCP, указав полный путь к PEM-файлу.',
    tlsCertificateHint: 'Если сертификат просрочен или имя сервера не совпадает, исправьте сертификат или адрес.',
    tlsExceptionHint: 'Добавьте этот адрес в PTAI_MCP_AIE_INSECURE_TLS_ORIGINS в окружении запуска MCP.',
    tlsRestart:
      'После изменения настроек переподключите MCP или перезапустите клиент, затем попросите агента начать новый вход.',
  },
} as const;

export function loginLanguage(acceptLanguage = ''): keyof typeof loginTranslations {
  const preferences = acceptLanguage.split(',').map((entry, index) => {
    const [tag, ...parameters] = entry.trim().toLowerCase().split(';');
    const quality = parameters.find((parameter) => parameter.trim().startsWith('q='));
    const weight = quality === undefined ? 1 : Number(quality.trim().slice(2));

    return { language: tag?.split('-')[0], weight, index };
  });

  const ranked = preferences.filter(({ weight }) => Number.isFinite(weight) && weight > 0 && weight <= 1);
  ranked.sort((a, b) => b.weight - a.weight || a.index - b.index);

  for (const { language } of ranked) {
    if (language === LoginLanguage.Russian || language === LoginLanguage.English) {
      return language;
    }
  }

  return LoginLanguage.English;
}

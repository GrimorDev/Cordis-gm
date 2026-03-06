import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'ssl0.ovh.net',
  port: 465,
  secure: true,
  auth: {
    user: 'no-reply@cordyn.pl',
    pass: 'yuP4Rd7qFp:Q',
  },
});

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function generateCode(): string {
  const rand = (n: number) =>
    Array.from({ length: n }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
  return `${rand(2)}-${rand(3)}-${rand(3)}`;
}

export async function sendDeletionEmail(to: string, code: string): Promise<void> {
  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #09090b; padding: 32px 16px; }
    .wrap { max-width: 480px; margin: 0 auto; }
    .card { background: #18181b; border-radius: 16px; border: 1px solid rgba(239,68,68,0.25); overflow: hidden; }
    .banner { background: linear-gradient(135deg, #dc2626 0%, #9f1239 100%); padding: 36px 32px; text-align: center; }
    .banner-icon { font-size: 40px; display: block; margin-bottom: 12px; }
    .banner-title { color: #fff; font-size: 22px; font-weight: 800; letter-spacing: -0.3px; }
    .banner-sub { color: rgba(255,255,255,0.7); font-size: 13px; margin-top: 4px; }
    .body { padding: 32px; }
    .body p { color: #a1a1aa; font-size: 14px; line-height: 1.65; margin-bottom: 16px; }
    .code-box { background: #09090b; border: 2px dashed rgba(239,68,68,0.4); border-radius: 12px; padding: 24px 16px; text-align: center; margin: 24px 0; }
    .code { font-family: 'Courier New', Courier, monospace; font-size: 30px; font-weight: 700; color: #f87171; letter-spacing: 0.12em; }
    .code-hint { color: #52525b; font-size: 12px; margin-top: 10px; }
    .warning { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 10px; padding: 12px 16px; }
    .warning p { color: #f87171; font-size: 13px; margin: 0; }
    .footer { text-align: center; color: #3f3f46; font-size: 12px; padding: 8px 32px 24px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="banner">
        <span class="banner-icon">⚠️</span>
        <div class="banner-title">Cordyn — Usunięcie konta</div>
        <div class="banner-sub">Kod potwierdzenia trwałego usunięcia</div>
      </div>
      <div class="body">
        <p>Cześć! Ktoś (prawdopodobnie Ty) poprosił o <strong style="color:#f87171">trwałe usunięcie konta</strong> w Cordyn. Poniżej znajdziesz jednorazowy kod potwierdzający.</p>
        <p>Wprowadź go w oknie usuwania konta:</p>
        <div class="code-box">
          <div class="code">${code}</div>
          <div class="code-hint">⏱ Ważny przez <strong>15 minut</strong> · Jednorazowy</div>
        </div>
        <p>Jeśli to nie Ty — zignoruj tę wiadomość. Konto zostanie usunięte tylko po wpisaniu kodu.</p>
        <div class="warning">
          <p>⚠️ Po usunięciu konta wszystkie Twoje dane zostaną permanentnie usunięte i nie będzie możliwości ich odzyskania.</p>
        </div>
      </div>
      <div class="footer">
        © 2025 Cordyn &nbsp;·&nbsp; no-reply@cordyn.pl<br>
        Wiadomość wysłana automatycznie — nie odpowiadaj na nią.
      </div>
    </div>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from: '"Cordyn" <no-reply@cordyn.pl>',
    to,
    subject: `Kod usunięcia konta Cordyn: ${code}`,
    html,
  });
}

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #09090b; padding: 32px 16px; }
    .wrap { max-width: 480px; margin: 0 auto; }
    .card { background: #18181b; border-radius: 16px; border: 1px solid rgba(99,102,241,0.25); overflow: hidden; }
    .banner { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 36px 32px; text-align: center; }
    .banner-icon { font-size: 40px; display: block; margin-bottom: 12px; }
    .banner-title { color: #fff; font-size: 22px; font-weight: 800; letter-spacing: -0.3px; }
    .banner-sub { color: rgba(255,255,255,0.7); font-size: 13px; margin-top: 4px; }
    .body { padding: 32px; }
    .body p { color: #a1a1aa; font-size: 14px; line-height: 1.65; margin-bottom: 16px; }
    .code-box { background: #09090b; border: 2px dashed rgba(99,102,241,0.4); border-radius: 12px; padding: 24px 16px; text-align: center; margin: 24px 0; }
    .code { font-family: 'Courier New', Courier, monospace; font-size: 30px; font-weight: 700; color: #818cf8; letter-spacing: 0.12em; }
    .code-hint { color: #52525b; font-size: 12px; margin-top: 10px; }
    .warning { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 10px; padding: 12px 16px; }
    .warning p { color: #f87171; font-size: 13px; margin: 0; }
    .footer { text-align: center; color: #3f3f46; font-size: 12px; padding: 8px 32px 24px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="banner">
        <span class="banner-icon">✉️</span>
        <div class="banner-title">Cordyn — Weryfikacja konta</div>
        <div class="banner-sub">Jednorazowy kod aktywacyjny</div>
      </div>
      <div class="body">
        <p>Cześć! Ktoś (prawdopodobnie Ty) poprosił o założenie nowego konta w <strong style="color:#e4e4e7">Cordyn</strong>. Poniżej znajdziesz swój jednorazowy kod weryfikacyjny.</p>
        <p>Wprowadź go w formularzu rejestracji:</p>
        <div class="code-box">
          <div class="code">${code}</div>
          <div class="code-hint">⏱ Ważny przez <strong>15 minut</strong> · Jednorazowy</div>
        </div>
        <p>Jeśli to nie Ty próbowałeś założyć konto — zignoruj tę wiadomość. Żadne konto nie zostanie utworzone bez użycia kodu.</p>
        <div class="warning">
          <p>⚠️ Nigdy nie udostępniaj tego kodu nikomu. Cordyn nigdy nie prosi o podanie kodu przez czat ani telefon.</p>
        </div>
      </div>
      <div class="footer">
        © 2025 Cordyn &nbsp;·&nbsp; no-reply@cordyn.pl<br>
        Wiadomość wysłana automatycznie — nie odpowiadaj na nią.
      </div>
    </div>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from: '"Cordyn" <no-reply@cordyn.pl>',
    to,
    subject: `Twój kod weryfikacyjny Cordyn: ${code}`,
    html,
  });
}

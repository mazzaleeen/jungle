<?php
define('JC_ADMIN', 1);
require __DIR__ . '/lib.php';

header('X-Robots-Tag: noindex, nofollow');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
$origins = array();
foreach (jc_sites() as $s) {
    if (preg_match('~^(https?://[^/]+)~i', $s['url'], $m)) $origins[$m[1]] = true;
}
$o = $origins ? ' ' . implode(' ', array_keys($origins)) : '';
header("Content-Security-Policy: default-src 'self'; img-src 'self' blob: data:$o; media-src 'self' blob:$o; style-src 'self' 'unsafe-inline'$o; font-src 'self' data:$o; script-src 'self'; frame-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'$o; form-action 'self'");
header('Cache-Control: no-store');

$configured = jc_configured();
if ($configured) jc_session_start();
$error = '';

if ($configured && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $t = isset($_POST['csrf']) ? $_POST['csrf'] : '';
    if (!hash_equals($_SESSION['csrf'], $t)) {
        $error = 'Страница устарела, попробуйте ещё раз.';
    } elseif (isset($_POST['logout'])) {
        $_SESSION = array();
        session_regenerate_id(true);
        header('Location: ./');
        exit;
    } elseif ($wait = jc_rl_blocked()) {
        $error = 'Слишком много неудачных попыток. Попробуйте через ' . $wait . ' мин.';
    } elseif (jc_login(isset($_POST['login']) ? $_POST['login'] : '', isset($_POST['password']) ? $_POST['password'] : '')) {
        jc_rl_clear();
        header('Location: ./');
        exit;
    } else {
        jc_rl_fail();
        usleep(400000);
        $error = 'Неверный логин или пароль.';
    }
}
$user = $configured ? jc_user() : null;
$v = '20261106e';
function h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
?><!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Админка — Джунгли Сити</title>
<link rel="icon" href="../images/favicon.ico">
<link rel="stylesheet" href="app.css?v=<?= $v ?>">
<?php if ($user): ?><meta name="csrf" content="<?= h($_SESSION['csrf']) ?>"><?php endif; ?>
</head>
<body class="<?= $user ? 'app' : 'auth' ?>">
<?php if (!$configured): ?>
  <img class="auth-logo" src="../images/image.png" alt="Джунгли Сити">
  <main class="auth-box">
    <h1>Админка ещё не подключена</h1>
    <p>Нужно добавить пароль и ключ GitHub в настройки репозитория (Settings → Secrets) и дождаться деплоя.</p>
  </main>
<?php elseif (!$user): ?>
  <img class="auth-logo" src="../images/image.png" alt="Джунгли Сити">
  <main class="auth-box">
    <h1>Вход</h1>
    <form method="post" class="auth-form" autocomplete="on">
      <input type="hidden" name="csrf" value="<?= h($_SESSION['csrf']) ?>">
      <label>Логин<input name="login" autocomplete="username" required autofocus></label>
      <label>Пароль<input name="password" type="password" autocomplete="current-password" required></label>
      <?php if ($error): ?><p class="auth-error"><?= h($error) ?></p><?php endif; ?>
      <button type="submit" class="btn btn--green">Войти</button>
    </form>
  </main>
<?php else: ?>
  <div id="app" data-user="<?= h($user) ?>"></div>
  <form method="post" id="logoutForm" hidden><input type="hidden" name="csrf" value="<?= h($_SESSION['csrf']) ?>"><input type="hidden" name="logout" value="1"></form>
  <script src="app.js?v=<?= $v ?>"></script>
<?php endif; ?>
</body>
</html>

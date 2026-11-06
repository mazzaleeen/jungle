<?php
// Собирает admin/config.php из секретов репозитория во время деплоя.
// Запускается только в GitHub Actions; на хостинг этот файл не попадает (.github исключён из деплоя).
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

$usersRaw = (string)getenv('ADMIN_USERS');
$token    = trim((string)getenv('ADMIN_GH_TOKEN'));
$repo     = (string)getenv('GITHUB_REPOSITORY');
$branch   = (string)getenv('GITHUB_REF_NAME') ?: 'main';
$out      = __DIR__ . '/../../admin/config.php';

$users = array();
foreach (preg_split('/\r\n|\r|\n|;/', $usersRaw) as $line) {
    $line = trim($line);
    if ($line === '' || strpos($line, ':') === false) continue;
    list($login, $pass) = array_map('trim', explode(':', $line, 2));
    $login = mb_strtolower($login);
    if ($login === '' || $pass === '') continue;
    if (mb_strlen($pass) < 8) { fwrite(STDERR, "Пароль для «{$login}» короче 8 символов — пропущен\n"); continue; }
    $users[$login] = password_hash($pass, PASSWORD_DEFAULT);
}

if (!$users || $token === '' || $repo === '') {
    echo "Админка не настроена (нет ADMIN_USERS или ADMIN_GH_TOKEN) — config.php не создан\n";
    if (is_file($out)) unlink($out);
    exit(0);
}

$cfg = array('repo' => $repo, 'branch' => $branch, 'token' => $token, 'users' => $users);
file_put_contents($out, "<?php\n// Создано автоматически при деплое. Не храните этот файл в репозитории.\nreturn " . var_export($cfg, true) . ";\n");
echo 'Админка: пользователей ' . count($users) . ', репозиторий ' . $repo . "\n";

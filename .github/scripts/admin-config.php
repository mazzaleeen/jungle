<?php
// Собирает admin/config.php из секретов репозитория во время деплоя.
// Запускается только в GitHub Actions; на хостинг этот файл не попадает (.github исключён из деплоя).
//
// Секрет ADMIN_USERS — по одному человеку на строку:
//   логин: пароль                 → доступ ко всем городам
//   логин: пароль: нн             → только Нижний Новгород
//   логин: пароль: нн, орёл       → несколько городов
//   логин: пароль: все            → все города
// Названия городов — из admin/sites.json (поле aliases). Двоеточие в пароле использовать нельзя.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

$root     = __DIR__ . '/../..';
$usersRaw = (string)getenv('ADMIN_USERS');
$token    = trim((string)getenv('ADMIN_GH_TOKEN'));
$out      = $root . '/admin/config.php';

$sitesJson = json_decode((string)@file_get_contents($root . '/admin/sites.json'), true);
$alias = array('все' => '*', 'all' => '*', '*' => '*');
foreach (isset($sitesJson['sites']) ? $sitesJson['sites'] : array() as $s) {
    $alias[mb_strtolower($s['id'])] = $s['id'];
    $alias[mb_strtolower($s['name'])] = $s['id'];
    foreach (isset($s['aliases']) ? $s['aliases'] : array() as $a) $alias[mb_strtolower(trim($a))] = $s['id'];
}

$users = array();
$problems = 0;
foreach (preg_split('/\r\n|\r|\n|;/', $usersRaw) as $n => $line) {
    $line = trim($line);
    if ($line === '' || strpos($line, ':') === false) continue;
    $parts = array_map('trim', explode(':', $line));
    $login = mb_strtolower($parts[0]);
    $pass = isset($parts[1]) ? $parts[1] : '';
    if (count($parts) > 3) { fwrite(STDERR, "Строка " . ($n + 1) . " («{$login}»): слишком много двоеточий — в пароле их быть не должно. Пропущено.\n"); $problems++; continue; }
    if ($login === '' || $pass === '') continue;
    if (mb_strlen($pass) < 8) { fwrite(STDERR, "Пароль для «{$login}» короче 8 символов — пропущен\n"); $problems++; continue; }
    $sites = array('*');
    if (count($parts) === 3) {
        $sites = array();
        foreach (preg_split('/[,\s]+/u', mb_strtolower($parts[2])) as $w) {
            if ($w === '') continue;
            if (!isset($alias[$w])) { $sites = null; break; }
            $sites[] = $alias[$w];
        }
        if (!$sites) { fwrite(STDERR, "Для «{$login}» не понял города «{$parts[2]}» — пользователь пропущен\n"); $problems++; continue; }
        if (in_array('*', $sites, true)) $sites = array('*');
        $sites = array_values(array_unique($sites));
    }
    $users[$login] = array('hash' => password_hash($pass, PASSWORD_DEFAULT), 'sites' => $sites);
}

if (!$users || $token === '') {
    echo "Админка не настроена (нет ADMIN_USERS или ADMIN_GH_TOKEN) — config.php не создан\n";
    if (is_file($out)) unlink($out);
    exit(0);
}

$cfg = array('token' => $token, 'users' => $users);
file_put_contents($out, "<?php\n// Создано автоматически при деплое. Не храните этот файл в репозитории.\nreturn " . var_export($cfg, true) . ";\n");
foreach ($users as $l => $u) echo "Админка: {$l} — " . (in_array('*', $u['sites'], true) ? 'все города' : implode(', ', $u['sites'])) . "\n";
if ($problems) echo "Внимание: строк с ошибками — {$problems}, подробности выше.\n";

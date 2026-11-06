<?php
// Проверка хостинга для будущей админки. После проверки файл удалить.
header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex');
$rows = array();
function row(&$rows, $name, $ok, $info = '') { $rows[] = array($name, $ok, $info); }

row($rows, 'PHP работает', true, 'версия ' . PHP_VERSION);
row($rows, 'Версия PHP 7.4 или новее', version_compare(PHP_VERSION, '7.4.0', '>='), PHP_VERSION);
row($rows, 'Расширение curl (связь с GitHub)', function_exists('curl_init'));
row($rows, 'Расширение openssl (https)', extension_loaded('openssl'));
row($rows, 'Расширение json', function_exists('json_encode'));
row($rows, 'Сессии (вход по паролю)', function_exists('session_start'));
row($rows, 'password_hash (хранение пароля)', function_exists('password_hash'));
row($rows, 'Обработка картинок (GD)', extension_loaded('gd'), extension_loaded('gd') ? (function_exists('imagewebp') ? 'есть WebP' : 'без WebP') : '');
row($rows, 'Загрузка файлов разрешена', (bool)ini_get('file_uploads'), 'до ' . ini_get('upload_max_filesize') . ' за файл, до ' . ini_get('post_max_size') . ' за раз');
row($rows, 'Сайт открыт по https', (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https'));

// запись во временную папку
$tmp = @tempnam(sys_get_temp_dir(), 'jt');
row($rows, 'Запись во временную папку', $tmp && @file_put_contents($tmp, 'ok') === 2);
if ($tmp) @unlink($tmp);

// исходящее соединение с GitHub
$gh = false; $ghInfo = '';
if (function_exists('curl_init')) {
    $c = curl_init('https://api.github.com/zen');
    curl_setopt_array($c, array(CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_USERAGENT => 'jucity-hosting-check'));
    $r = curl_exec($c);
    $code = curl_getinfo($c, CURLINFO_HTTP_CODE);
    $err = curl_error($c);
    curl_close($c);
    $gh = ($code === 200);
    $ghInfo = $gh ? 'ответ получен' : ('код ' . $code . ($err ? ', ' . $err : ''));
}
row($rows, 'Сервер может обратиться к GitHub', $gh, $ghInfo);

$all = true; foreach ($rows as $r) { if (!$r[1]) $all = false; }
?><!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Проверка хостинга</title>
<style>
body{font-family:system-ui,sans-serif;background:#F4F0FC;color:#2e0b5e;margin:0;padding:24px 16px}
.box{max-width:640px;margin:0 auto;background:#fff;border-radius:20px;padding:24px;box-shadow:0 10px 30px rgba(74,17,133,.1)}
h1{font-size:22px;margin:0 0 6px}p{margin:0 0 18px;color:#6E5F80}
table{width:100%;border-collapse:collapse}td{padding:10px 6px;border-top:1px solid #E7DFF7;font-size:15px;vertical-align:top}
td.s{width:28px;font-size:18px}td.i{color:#6E5F80;font-size:13px;text-align:right}
.res{margin-top:18px;padding:14px 16px;border-radius:14px;font-weight:700}
.ok{background:#E3F4DD;color:#2b6b1c}.bad{background:#FDE7EC;color:#9b1c3a}
</style></head><body><div class="box">
<h1>Проверка хостинга для админки</h1>
<p><?= htmlspecialchars(isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '') ?> · <?= date('d.m.Y H:i') ?></p>
<table>
<?php foreach ($rows as $r): list($n, $ok, $i) = $r; ?>
<tr><td class="s"><?= $ok ? '✅' : '❌' ?></td><td><?= htmlspecialchars($n) ?></td><td class="i"><?= htmlspecialchars($i) ?></td></tr>
<?php endforeach; ?>
</table>
<div class="res <?= $all ? 'ok' : 'bad' ?>"><?= $all ? 'Всё необходимое есть — админку можно делать.' : 'Не всё есть — пришлите скриншот этой страницы.' ?></div>
</div></body></html>

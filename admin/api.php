<?php
define('JC_ADMIN', 1);
require __DIR__ . '/lib.php';

header('X-Robots-Tag: noindex, nofollow');
header('X-Content-Type-Options: nosniff');

if (!jc_configured()) jc_fail('Админка ещё не настроена', 503);
jc_session_start();
if (!jc_user()) jc_fail('Нужно войти заново', 401);

$action = isset($_GET['action']) ? $_GET['action'] : '';
$isPost = $_SERVER['REQUEST_METHOD'] === 'POST';

if ($isPost) {
    $t = isset($_SERVER['HTTP_X_CSRF']) ? $_SERVER['HTTP_X_CSRF'] : '';
    if (!hash_equals($_SESSION['csrf'], $t)) jc_fail('Сессия устарела, обновите страницу', 403);
}
session_write_close(); // не держим блокировку сессии во время долгих запросов к GitHub

function jc_body() {
    $raw = file_get_contents('php://input');
    $d = json_decode($raw, true);
    if (!is_array($d)) jc_fail('Пустой запрос');
    return $d;
}

function jc_detect_type($bin) {
    if (strncmp($bin, "\x89PNG", 4) === 0) return 'png';
    if (strncmp($bin, "\xFF\xD8\xFF", 3) === 0) return 'jpg';
    if (substr($bin, 0, 4) === 'RIFF' && substr($bin, 8, 4) === 'WEBP') return 'webp';
    if (substr($bin, 4, 4) === 'ftyp') return 'mp4';
    return null;
}

$PAGE_TITLES = array(
    'index.html' => 'Главная', 'komnaty.html' => 'Комнаты', 'animations.html' => 'Анимации',
    'paketnye-predlozheniya.html' => 'Пакетные предложения', 'dopolneniya.html' => 'Впечатления',
    'vypusknoy.html' => 'Выпускные', 'torty.html' => 'Торты', 'menu.html' => 'Ресторан',
);

try {
    switch ($action) {
        case 'me':
            jc_json(array('user' => jc_user()));

        case 'pages':
            $out = array();
            foreach (jc_list_pages() as $p) {
                $out[] = array('path' => $p, 'title' => isset($PAGE_TITLES[$p]) ? $PAGE_TITLES[$p] : $p);
            }
            usort($out, function ($a, $b) use ($PAGE_TITLES) {
                $ka = array_search($a['path'], array_keys($PAGE_TITLES));
                $kb = array_search($b['path'], array_keys($PAGE_TITLES));
                $ka = $ka === false ? 99 : $ka; $kb = $kb === false ? 99 : $kb;
                return $ka - $kb;
            });
            jc_json(array('pages' => $out));

        case 'file':
            $path = isset($_GET['path']) ? $_GET['path'] : '';
            if (!preg_match(JC_PAGE_RE, $path)) jc_fail('Недопустимый файл');
            $f = jc_get_file($path);
            jc_json(array('path' => $path, 'content' => $f['content'], 'sha' => $f['sha']));

        case 'upload':
            if (!$isPost) jc_fail('Нужен POST', 405);
            $path = isset($_POST['path']) ? $_POST['path'] : '';
            if (!preg_match(JC_UPLOAD_RE, $path)) jc_fail('Недопустимое имя файла');
            if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) jc_fail('Файл не загрузился, попробуйте ещё раз');
            $size = (int)$_FILES['file']['size'];
            $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
            $limit = $ext === 'mp4' ? JC_MAX_VIDEO : JC_MAX_IMAGE;
            if ($size > $limit) jc_fail($ext === 'mp4' ? 'Видео больше 30 МБ — сожмите его и попробуйте снова' : 'Фото слишком большое');
            $bin = file_get_contents($_FILES['file']['tmp_name']);
            $type = jc_detect_type($bin);
            $okType = ($ext === 'mp4' && $type === 'mp4') || ($ext === 'webp' && $type === 'webp')
                || ($ext === 'png' && $type === 'png') || (($ext === 'jpg' || $ext === 'jpeg') && $type === 'jpg');
            if (!$okType) jc_fail('Этот формат файла не поддерживается');
            $sha = jc_upload_blob($bin);
            unset($bin);
            jc_json(array('path' => $path, 'sha' => $sha));

        case 'save':
            if (!$isPost) jc_fail('Нужен POST', 405);
            $d = jc_body();
            $changes = array();
            $expected = array();
            $files = isset($d['files']) && is_array($d['files']) ? $d['files'] : array();
            $uploads = isset($d['uploads']) && is_array($d['uploads']) ? $d['uploads'] : array();
            if (!$files && !$uploads) jc_fail('Нечего сохранять');
            if (count($files) > 20 || count($uploads) > 200) jc_fail('Слишком много изменений за раз');
            foreach ($files as $f) {
                if (!isset($f['path'], $f['content']) || !preg_match(JC_PAGE_RE, $f['path'])) jc_fail('Недопустимый файл');
                if (strlen($f['content']) > 3000000 || stripos($f['content'], '<html') === false) jc_fail('Страница «' . $f['path'] . '» выглядит повреждённой — сохранение отменено');
                $changes[] = array('path' => $f['path'], 'content' => $f['content']);
                $expected[$f['path']] = isset($f['base']) ? $f['base'] : null;
            }
            foreach ($uploads as $u) {
                if (!isset($u['path'], $u['sha']) || !preg_match(JC_UPLOAD_RE, $u['path']) || !preg_match('~^[0-9a-f]{40}$~', $u['sha'])) jc_fail('Недопустимый файл');
                $changes[] = array('path' => $u['path'], 'sha' => $u['sha']);
            }
            $summary = isset($d['message']) ? trim(preg_replace('~\s+~u', ' ', (string)$d['message'])) : '';
            if ($summary === '') $summary = 'правка страниц';
            $summary = mb_substr($summary, 0, 140);
            $msg = 'Админка (' . jc_user() . '): ' . $summary;
            $sha = jc_commit($changes, $msg, $expected);
            $newShas = array();
            foreach ($changes as $c) if (isset($c['content'])) $newShas[$c['path']] = jc_git_blob_sha($c['content']);
            jc_json(array('commit' => $sha, 'shas' => $newShas));

        case 'history':
            jc_json(array('items' => jc_history()));

        case 'revert':
            if (!$isPost) jc_fail('Нужен POST', 405);
            $d = jc_body();
            $sha = jc_revert(isset($d['sha']) ? (string)$d['sha'] : '', 'Админка (' . jc_user() . '): ');
            jc_json(array('commit' => $sha));

        case 'status':
            jc_json(jc_deploy_status(isset($_GET['sha']) ? $_GET['sha'] : ''));

        default:
            jc_fail('Неизвестное действие', 404);
    }
} catch (JcGitHubError $e) {
    $code = $e->status >= 400 && $e->status < 600 ? $e->status : 500;
    if ($code === 401) $code = 502; // ошибка токена GitHub, а не сессии пользователя
    jc_fail($e->getMessage(), $code);
} catch (Throwable $e) {
    error_log('jcadmin: ' . $e->getMessage());
    jc_fail('Внутренняя ошибка админки', 500);
}

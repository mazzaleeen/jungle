<?php
// Админка сайта «Джунгли Сити» — общие функции.
// Все правки сохраняются коммитом в GitHub, дальше сайт выкладывается обычным деплоем.

if (!defined('JC_ADMIN')) { http_response_code(404); exit; }

error_reporting(E_ALL);
ini_set('display_errors', '0');

const JC_PAGE_RE   = '~^[a-z0-9_-]+\.html$~';
const JC_UPLOAD_RE = '~^assets/uploads/[a-z0-9_-]+(/[a-z0-9_-]+)*\.(webp|jpg|jpeg|png|mp4)$~';
const JC_MAX_IMAGE = 8388608;    // 8 МБ
const JC_MAX_VIDEO = 31457280;   // 30 МБ

function jc_base_config() {
    static $cfg = null;
    if ($cfg !== null) return $cfg;
    $file = __DIR__ . '/config.php';
    $cfg = is_file($file) ? include $file : array();
    if (!is_array($cfg)) $cfg = array();
    $cfg += array('users' => array(), 'token' => '');
    // пользователи: логин => ['hash' => ..., 'sites' => ['*'] | ['nn', 'orel', ...]]
    foreach ($cfg['users'] as $login => $u) {
        if (is_string($u)) $cfg['users'][$login] = array('hash' => $u, 'sites' => array('*'));
    }
    return $cfg;
}

/** Города из sites.json: id => [name, repo, branch, url, pages]. */
function jc_sites() {
    static $sites = null;
    if ($sites !== null) return $sites;
    $sites = array();
    $d = json_decode((string)@file_get_contents(__DIR__ . '/sites.json'), true);
    if (is_array($d) && isset($d['sites'])) foreach ($d['sites'] as $s) {
        if (empty($s['id']) || empty($s['repo'])) continue;
        $s += array('branch' => 'main', 'name' => $s['id'], 'url' => '../', 'pages' => array());
        $bc = jc_base_config();
        if (!empty($bc['site_urls'][$s['id']])) $s['url'] = $bc['site_urls'][$s['id']]; // только для проверки на тестовом сервере
        $sites[$s['id']] = $s;
    }
    return $sites;
}

$GLOBALS['JC_CUR_SITE'] = null;
function jc_use_site($id) { $GLOBALS['JC_CUR_SITE'] = $id; }
function jc_cur_site() { return $GLOBALS['JC_CUR_SITE']; }

/** Настройки с учётом выбранного города (репозиторий, ветка). */
function jc_config() {
    $c = jc_base_config();
    $id = jc_cur_site();
    $sites = jc_sites();
    if ($id && isset($sites[$id])) {
        $c['repo'] = $sites[$id]['repo'];
        $c['branch'] = $sites[$id]['branch'];
        if (!empty($c['mock_dirs'][$id])) $c['mock_dir'] = $c['mock_dirs'][$id];
    } else {
        $c += array('repo' => '', 'branch' => 'main');
    }
    return $c;
}

function jc_configured() {
    $c = jc_base_config();
    if (!jc_sites() || !$c['users']) return false;
    return !empty($c['token']) || !empty($c['mock_dirs']);
}

/** Города, доступные текущему пользователю (проверяется на каждом запросе). */
function jc_allowed_sites() {
    $u = jc_user();
    $c = jc_base_config();
    if (!$u || !isset($c['users'][$u])) return array();
    $want = $c['users'][$u]['sites'];
    $out = array();
    foreach (jc_sites() as $id => $s) if (in_array('*', $want, true) || in_array($id, $want, true)) $out[] = $id;
    return $out;
}

function jc_is_https() {
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') return true;
    if (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') return true;
    return false;
}

function jc_session_start() {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $path = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/') . '/';
    session_name('jcadmin');
    session_set_cookie_params(array(
        'lifetime' => 0, 'path' => $path, 'secure' => jc_is_https(),
        'httponly' => true, 'samesite' => 'Strict',
    ));
    ini_set('session.use_strict_mode', '1');
    session_start();
    $now = time();
    if (!empty($_SESSION['user']) && (!isset($_SESSION['seen']) || $now - $_SESSION['seen'] > 43200)) {
        $_SESSION = array();
        session_regenerate_id(true);
    }
    $_SESSION['seen'] = $now;
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(24));
}

function jc_user() {
    return isset($_SESSION['user']) ? $_SESSION['user'] : null;
}

// ---------- ограничение попыток входа ----------
function jc_rl_file() {
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'x';
    return rtrim(sys_get_temp_dir(), '/') . '/jcadmin_rl_' . md5($ip . __DIR__) . '.json';
}
function jc_rl_blocked() {
    $f = jc_rl_file();
    if (!is_file($f)) return 0;
    $d = json_decode((string)@file_get_contents($f), true);
    if (!is_array($d)) return 0;
    $recent = array_filter($d, function ($t) { return $t > time() - 900; });
    if (count($recent) >= 8) return max(1, (int)ceil((min($recent) + 900 - time()) / 60));
    return 0;
}
function jc_rl_fail() {
    $f = jc_rl_file();
    $d = is_file($f) ? json_decode((string)@file_get_contents($f), true) : array();
    if (!is_array($d)) $d = array();
    $d = array_values(array_filter($d, function ($t) { return $t > time() - 900; }));
    $d[] = time();
    @file_put_contents($f, json_encode($d), LOCK_EX);
}
function jc_rl_clear() { @unlink(jc_rl_file()); }

function jc_login($login, $password) {
    $c = jc_base_config();
    $login = mb_strtolower(trim((string)$login));
    $hash = isset($c['users'][$login]['hash']) ? $c['users'][$login]['hash'] : null;
    // одинаковое время ответа, есть такой логин или нет
    $ok = $hash ? password_verify((string)$password, $hash) : (password_hash('x', PASSWORD_DEFAULT) && false);
    if ($hash && $ok) {
        session_regenerate_id(true);
        $_SESSION['user'] = $login;
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
        return true;
    }
    return false;
}

// ---------- ответы ----------
function jc_json($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function jc_fail($msg, $code = 400) { jc_json(array('error' => $msg), $code); }

// ---------- GitHub ----------
class JcGitHubError extends Exception {
    public $status;
    public function __construct($msg, $status = 0) { parent::__construct($msg); $this->status = $status; }
}

function jc_gh($method, $path, $body = null, $accept = 'application/vnd.github+json') {
    $c = jc_config();
    $url = (!empty($c['api_base']) ? rtrim($c['api_base'], '/') : 'https://api.github.com') . $path;
    $ch = curl_init($url);
    $headers = array(
        'Accept: ' . $accept,
        'X-GitHub-Api-Version: 2022-11-28',
        'User-Agent: jucity-admin',
    );
    if (!empty($c['token'])) $headers[] = 'Authorization: Bearer ' . $c['token'];
    if ($body !== null) {
        $payload = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $headers[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    }
    curl_setopt_array($ch, array(
        CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 120, CURLOPT_CONNECTTIMEOUT => 15,
    ));
    $raw = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($raw === false) throw new JcGitHubError('Нет связи с GitHub: ' . $err, 502);
    if ($accept !== 'application/vnd.github+json') {
        if ($code >= 400) throw new JcGitHubError('GitHub ответил ошибкой ' . $code, $code);
        return $raw;
    }
    $json = json_decode($raw, true);
    if ($code >= 400) {
        $m = is_array($json) && isset($json['message']) ? $json['message'] : ('код ' . $code);
        throw new JcGitHubError('GitHub: ' . $m, $code);
    }
    return $json;
}

function jc_repo_path() {
    $c = jc_config();
    return '/repos/' . $c['repo'];
}

function jc_git_blob_sha($content) {
    return sha1('blob ' . strlen($content) . "\0" . $content);
}

// ----- mock (для проверки без GitHub) -----
function jc_mock() { $c = jc_config(); return !empty($c['mock_dir']) ? rtrim($c['mock_dir'], '/') : null; }
function jc_mock_state() {
    $f = jc_mock() . '/.mock/state.json';
    $d = is_file($f) ? json_decode(file_get_contents($f), true) : null;
    return is_array($d) ? $d : array('commits' => array());
}
function jc_mock_save_state($s) {
    @mkdir(jc_mock() . '/.mock/blobs', 0777, true);
    file_put_contents(jc_mock() . '/.mock/state.json', json_encode($s, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

/** Текущий текст файла и его sha. */
function jc_get_file($path) {
    if ($m = jc_mock()) {
        $f = $m . '/' . $path;
        if (!is_file($f)) throw new JcGitHubError('Файл не найден', 404);
        $c = file_get_contents($f);
        return array('content' => $c, 'sha' => jc_git_blob_sha($c));
    }
    $c = jc_config();
    $meta = jc_gh('GET', jc_repo_path() . '/contents/' . str_replace('%2F', '/', rawurlencode($path)) . '?ref=' . rawurlencode($c['branch']));
    $raw = jc_gh('GET', jc_repo_path() . '/git/blobs/' . $meta['sha'], null, 'application/vnd.github.raw+json');
    return array('content' => $raw, 'sha' => $meta['sha']);
}

function jc_list_pages() {
    if ($m = jc_mock()) {
        $out = array();
        foreach (glob($m . '/*.html') as $f) $out[] = basename($f);
        sort($out);
        return $out;
    }
    $c = jc_config();
    $list = jc_gh('GET', jc_repo_path() . '/contents?ref=' . rawurlencode($c['branch']));
    $out = array();
    foreach ($list as $e) if ($e['type'] === 'file' && preg_match(JC_PAGE_RE, $e['name'])) $out[] = $e['name'];
    sort($out);
    return $out;
}

/** Загружает файл в хранилище GitHub (без коммита), возвращает sha. */
function jc_upload_blob($binary) {
    if ($m = jc_mock()) {
        $sha = jc_git_blob_sha($binary);
        @mkdir($m . '/.mock/blobs', 0777, true);
        file_put_contents($m . '/.mock/blobs/' . $sha, $binary);
        return $sha;
    }
    $r = jc_gh('POST', jc_repo_path() . '/git/blobs', array('content' => base64_encode($binary), 'encoding' => 'base64'));
    return $r['sha'];
}

/**
 * Один коммит из нескольких файлов.
 * $changes: [['path'=>..., 'content'=>текст] | ['path'=>..., 'sha'=>blob] | ['path'=>..., 'delete'=>true]]
 * $expected: [path => sha, который видел редактор] — защита от одновременных правок.
 */
function jc_commit($changes, $message, $expected = array()) {
    if ($m = jc_mock()) return jc_mock_commit($changes, $message, $expected);
    $c = jc_config();
    $rp = jc_repo_path();
    for ($attempt = 0; $attempt < 3; $attempt++) {
        $ref = jc_gh('GET', $rp . '/git/ref/heads/' . rawurlencode($c['branch']));
        $head = $ref['object']['sha'];
        $commit = jc_gh('GET', $rp . '/git/commits/' . $head);
        foreach ($expected as $path => $sha) {
            if (!$sha) continue;
            try {
                $cur = jc_gh('GET', $rp . '/contents/' . str_replace('%2F', '/', rawurlencode($path)) . '?ref=' . $head);
                $cur = $cur['sha'];
            } catch (JcGitHubError $e) { $cur = null; }
            if ($cur !== $sha) {
                throw new JcGitHubError('Страницу «' . $path . '» уже изменили (возможно, другой человек или разработчик). Обновите страницу в админке и внесите правку ещё раз.', 409);
            }
        }
        $tree = array();
        foreach ($changes as $ch) {
            if (!empty($ch['delete'])) {
                $tree[] = array('path' => $ch['path'], 'mode' => '100644', 'type' => 'blob', 'sha' => null);
            } elseif (isset($ch['content'])) {
                $b = jc_gh('POST', $rp . '/git/blobs', array('content' => $ch['content'], 'encoding' => 'utf-8'));
                $tree[] = array('path' => $ch['path'], 'mode' => '100644', 'type' => 'blob', 'sha' => $b['sha']);
            } else {
                $tree[] = array('path' => $ch['path'], 'mode' => '100644', 'type' => 'blob', 'sha' => $ch['sha']);
            }
        }
        $newTree = jc_gh('POST', $rp . '/git/trees', array('base_tree' => $commit['tree']['sha'], 'tree' => $tree));
        if ($newTree['sha'] === $commit['tree']['sha']) return $head; // ничего не изменилось — пустую правку не создаём
        $newCommit = jc_gh('POST', $rp . '/git/commits', array(
            'message' => $message, 'tree' => $newTree['sha'], 'parents' => array($head),
        ));
        try {
            jc_gh('PATCH', $rp . '/git/refs/heads/' . rawurlencode($c['branch']), array('sha' => $newCommit['sha'], 'force' => false));
            return $newCommit['sha'];
        } catch (JcGitHubError $e) {
            if ($e->status !== 422) throw $e;
            // кто-то успел сохранить раньше — повторяем на свежей версии
        }
    }
    throw new JcGitHubError('Не удалось сохранить: сайт одновременно меняется. Попробуйте ещё раз через минуту.', 409);
}

function jc_mock_commit($changes, $message, $expected) {
    $m = jc_mock();
    foreach ($expected as $path => $sha) {
        if (!$sha) continue;
        $f = $m . '/' . $path;
        $cur = is_file($f) ? jc_git_blob_sha(file_get_contents($f)) : null;
        if ($cur !== $sha) throw new JcGitHubError('Страницу «' . $path . '» уже изменили. Обновите страницу в админке и внесите правку ещё раз.', 409);
    }
    $st = jc_mock_state();
    $files = array();
    foreach ($changes as $ch) {
        $f = $m . '/' . $ch['path'];
        $before = is_file($f) ? file_get_contents($f) : null;
        if ($before !== null) {
            $bs = jc_git_blob_sha($before);
            @mkdir($m . '/.mock/blobs', 0777, true);
            file_put_contents($m . '/.mock/blobs/' . $bs, $before);
        } else $bs = null;
        if (!empty($ch['delete'])) {
            @unlink($f);
            $as = null;
        } else {
            $data = isset($ch['content']) ? $ch['content'] : file_get_contents($m . '/.mock/blobs/' . $ch['sha']);
            @mkdir(dirname($f), 0777, true);
            file_put_contents($f, $data);
            $as = jc_git_blob_sha($data);
            file_put_contents($m . '/.mock/blobs/' . $as, $data);
        }
        $files[] = array('path' => $ch['path'], 'before' => $bs, 'after' => $as);
    }
    $sha = sha1(uniqid('', true));
    array_unshift($st['commits'], array('sha' => $sha, 'message' => $message, 'date' => gmdate('c'), 'files' => $files));
    jc_mock_save_state($st);
    return $sha;
}

function jc_history() {
    if (jc_mock()) {
        $st = jc_mock_state();
        $out = array();
        foreach (array_slice($st['commits'], 0, 30) as $c) $out[] = array('sha' => $c['sha'], 'message' => $c['message'], 'date' => $c['date'], 'author' => 'mock');
        return $out;
    }
    $c = jc_config();
    $list = jc_gh('GET', jc_repo_path() . '/commits?sha=' . rawurlencode($c['branch']) . '&per_page=30');
    $out = array();
    foreach ($list as $it) {
        $out[] = array('sha' => $it['sha'], 'message' => $it['commit']['message'],
            'date' => $it['commit']['author']['date'], 'author' => $it['commit']['author']['name']);
    }
    return $out;
}

/** Возвращает файлы из коммита к состоянию до него (новым коммитом). */
function jc_revert($sha, $prefix = '') {
    if (!preg_match('~^[0-9a-f]{40}$~', $sha)) throw new JcGitHubError('Неверная правка', 400);
    if ($m = jc_mock()) {
        $st = jc_mock_state();
        foreach ($st['commits'] as $c) if ($c['sha'] === $sha) {
            $changes = array();
            foreach ($c['files'] as $f) {
                if ($f['before'] === null) $changes[] = array('path' => $f['path'], 'delete' => true);
                else $changes[] = array('path' => $f['path'], 'sha' => $f['before']);
            }
            return jc_mock_commit($changes, $prefix . 'вернули как было — «' . jc_revert_title($c['message']) . '»', array());
        }
        throw new JcGitHubError('Правка не найдена', 404);
    }
    $rp = jc_repo_path();
    $commit = jc_gh('GET', $rp . '/commits/' . $sha);
    if (empty($commit['parents'])) throw new JcGitHubError('Эту правку нельзя откатить', 400);
    $parent = $commit['parents'][0]['sha'];
    $pc = jc_gh('GET', $rp . '/git/commits/' . $parent);
    $tree = jc_gh('GET', $rp . '/git/trees/' . $pc['tree']['sha'] . '?recursive=1');
    $map = array();
    foreach ($tree['tree'] as $e) if ($e['type'] === 'blob') $map[$e['path']] = $e['sha'];
    $changes = array();
    foreach ($commit['files'] as $f) {
        $p = $f['filename'];
        if (strpos($p, '.github/') === 0) throw new JcGitHubError('Эту правку нельзя откатить из админки — в ней менялись настройки деплоя.', 400);
        if ($f['status'] === 'renamed' && isset($f['previous_filename'])) {
            $changes[] = array('path' => $p, 'delete' => true);
            $changes[] = array('path' => $f['previous_filename'], 'sha' => $map[$f['previous_filename']]);
        } elseif (isset($map[$p])) {
            $changes[] = array('path' => $p, 'sha' => $map[$p]);
        } else {
            $changes[] = array('path' => $p, 'delete' => true);
        }
    }
    $msg = $prefix . 'вернули как было — «' . jc_revert_title($commit['commit']['message']) . '»';
    return jc_commit($changes, $msg, array());
}

function jc_revert_title($message) {
    $first = strtok((string)$message, "\n");
    return preg_replace('~^Админка \([^)]*\): ~u', '', $first);
}

/** Статус выкладки на сайт для коммита. */
function jc_deploy_status($sha) {
    if (jc_mock()) return array('state' => 'done');
    if (!preg_match('~^[0-9a-f]{40}$~', $sha)) return array('state' => 'unknown');
    try {
        $r = jc_gh('GET', jc_repo_path() . '/actions/runs?head_sha=' . $sha . '&per_page=5');
    } catch (JcGitHubError $e) {
        return array('state' => 'unknown'); // у ключа нет доступа к Actions — просто не показываем ход выкладки
    }
    if (empty($r['workflow_runs'])) return array('state' => 'queued');
    $run = $r['workflow_runs'][0];
    if ($run['status'] !== 'completed') return array('state' => 'running');
    return array('state' => $run['conclusion'] === 'success' ? 'done' : 'failed', 'url' => $run['html_url']);
}

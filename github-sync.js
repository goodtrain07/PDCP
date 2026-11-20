/**
 * 文湖線月台門訓練機 (PDCP) — GitHub 雲端題庫一鍵發布模組
 * 讓教官在手機或電腦後台直接將 scenarios.json 發布至 GitHub Pages，免手動上傳檔案。
 */

window.PDCPGitHubSync = (function () {
    const CONFIG_KEY = 'pdcp_github_sync_config_v1';

    /** 若目前網址位於 GitHub Pages (*.github.io)，自動推算帳號與專案名稱 */
    function detectFromLocation() {
        const host = window.location.hostname || '';
        const pathname = window.location.pathname || '';
        if (host.endsWith('.github.io')) {
            const owner = host.replace(/\.github\.io$/i, '');
            const parts = pathname.split('/').filter(Boolean);
            const repo = parts.length > 0 ? parts[0] : `${owner}.github.io`;
            return { owner, repo };
        }
        return { owner: '', repo: '' };
    }

    function loadConfig() {
        const detected = detectFromLocation();
        let saved = {};
        try {
            saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') || {};
        } catch (e) {
            saved = {};
        }
        return {
            owner: saved.owner || detected.owner || '',
            repo: saved.repo || detected.repo || '',
            branch: saved.branch || 'main',
            filePath: saved.filePath || 'scenarios.json',
            token: saved.token || ''
        };
    }

    function saveConfig(cfg) {
        const clean = {
            owner: (cfg.owner || '').trim(),
            repo: (cfg.repo || '').trim(),
            branch: (cfg.branch || 'main').trim() || 'main',
            filePath: (cfg.filePath || 'scenarios.json').trim().replace(/^\/+/, '') || 'scenarios.json',
            token: (cfg.token || '').trim()
        };
        localStorage.setItem(CONFIG_KEY, JSON.stringify(clean));
        return clean;
    }

    function clearToken() {
        const cfg = loadConfig();
        cfg.token = '';
        saveConfig(cfg);
    }

    /** 支援繁體中文與 Emoji 的安全 UTF-8 Base64 編碼 */
    function utf8ToBase64(str) {
        const bytes = new TextEncoder().encode(str);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /** 將劇本清單直接發布至 GitHub 儲存庫的 scenarios.json */
    async function publishScenarios(scenarios, overrideConfig = null) {
        const cfg = overrideConfig ? saveConfig(overrideConfig) : loadConfig();

        if (!cfg.owner || !cfg.repo) {
            throw new Error('請先填寫 GitHub 帳號 (Owner) 與專案名稱 (Repo)。');
        }
        if (!cfg.token) {
            throw new Error('請先貼上您的 GitHub 教官發布金鑰 (Personal Access Token)。');
        }

        const apiUrl = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${cfg.filePath.split('/').map(encodeURIComponent).join('/')}`;
        const headers = {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${cfg.token}`,
            'X-GitHub-Api-Version': '2022-11-28'
        };

        // 1. 取得目前檔案的 sha（若檔案已存在則更新，不存在則新建）
        let sha = undefined;
        const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(cfg.branch)}&t=${Date.now()}`, {
            method: 'GET',
            headers
        });

        if (getRes.ok) {
            const existing = await getRes.json();
            sha = existing.sha;
        } else if (getRes.status === 401) {
            throw new Error('GitHub 金鑰無效或已過期，請重新檢查 Token。');
        } else if (getRes.status === 403) {
            throw new Error('GitHub 金鑰權限不足（需要 Contents 讀寫權限）。');
        } else if (getRes.status !== 404) {
            const errData = await getRes.json().catch(() => ({}));
            throw new Error(`讀取 GitHub 失敗 (${getRes.status})：${errData.message || '請檢查帳號與專案名稱'}`);
        }

        // 2. 寫入新版 scenarios.json
        const jsonText = JSON.stringify(scenarios, null, 2) + '\n';
        const body = {
            message: `更新 PDCP 訓練劇本 (共 ${scenarios.length} 個狀況)`,
            content: utf8ToBase64(jsonText),
            branch: cfg.branch
        };
        if (sha) {
            body.sha = sha;
        }

        const putRes = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!putRes.ok) {
            const errData = await putRes.json().catch(() => ({}));
            if (putRes.status === 401) {
                throw new Error('GitHub 金鑰驗證失敗，請確認 Token 是否正確。');
            }
            if (putRes.status === 403) {
                throw new Error('無寫入權限！請確認 Token 已勾選「Contents: Read and write」。');
            }
            if (putRes.status === 404) {
                throw new Error('找不到該 GitHub 專案或分支，請檢查帳號、專案名稱與分支 (main)。');
            }
            if (putRes.status === 409) {
                throw new Error('檔案版本衝突（可能剛被其他裝置更新），請再按一次發布。');
            }
            throw new Error(`發布失敗 (${putRes.status})：${errData.message || '未知錯誤'}`);
        }

        return await putRes.json();
    }

    return {
        detectFromLocation,
        loadConfig,
        saveConfig,
        clearToken,
        publishScenarios
    };
})();

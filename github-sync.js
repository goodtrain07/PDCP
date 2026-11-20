/**
 * 文湖線月台門訓練機 (PDCP) — 教官密碼保險箱與 GitHub 雲端題庫一鍵發布模組
 * 使用 PBKDF2-HMAC-SHA256 (300,000 次) + AES-256-CBC + HMAC-SHA256 認證加密，
 * 教官僅需輸入密碼即可解鎖後台並一鍵發布新版題庫至 GitHub Pages。
 */

window.PDCPGitHubSync = (function () {
    // 內建已加密之發布保險箱（不含任何明文金鑰）
    const BUILTIN_VAULT = {
        owner: 'goodtrain07',
        repo: 'PDCP',
        branch: 'main',
        filePath: 'scenarios.json',
        iterations: 300000,
        salt: 'EqedVky1lRizcHdecXHzjw==',
        iv: 'YOSadQ+R5hEnGMxqaUf0VQ==',
        data: 'frfwUXdjefVSsMOLcH023WVMRbru1N40vx2eLqsCULDfOQZFNDEk68I+IQ56IK7TTe33ki01DwA7sv6VLIz/VTyIYsAtKYkxFmzrU9QxZ9/7vJa1Ftu+faNTXO5AQ3HC',
        mac: 'y8jDugPjzR+LfWH6j38+jaILqSMlnHJMkRPJwwfVzMA='
    };

    // 僅保存在目前瀏覽器分頁記憶體中，關閉分頁自動登出
    let unlockedToken = '';

    function base64ToBytes(b64) {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) {
            bytes[i] = bin.charCodeAt(i);
        }
        return bytes;
    }

    function utf8ToBase64(str) {
        const bytes = new TextEncoder().encode(str);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    function constantTimeEqual(a, b) {
        if (a.length !== b.length) return false;
        let diff = 0;
        for (let i = 0; i < a.length; i++) {
            diff |= (a[i] ^ b[i]);
        }
        return diff === 0;
    }

    /** 以教官密碼驗證並解鎖雲端發布保險箱 */
    async function unlockWithPassword(password) {
        if (!password) {
            throw new Error('請輸入教官密碼。');
        }
        if (!window.crypto || !window.crypto.subtle) {
            throw new Error('目前瀏覽器不支援安全加密解鎖（請透過 HTTPS 網址開啟）。');
        }

        const pwdBytes = new TextEncoder().encode(String(password).trim());
        const saltBytes = base64ToBytes(BUILTIN_VAULT.salt);
        const ivBytes = base64ToBytes(BUILTIN_VAULT.iv);
        const cipherBytes = base64ToBytes(BUILTIN_VAULT.data);
        const expectedMac = base64ToBytes(BUILTIN_VAULT.mac);

        // 1. PBKDF2-HMAC-SHA256 衍生 64 bytes (前 32 bytes AES Key + 後 32 bytes HMAC Key)
        const baseKey = await window.crypto.subtle.importKey(
            'raw',
            pwdBytes,
            { name: 'PBKDF2' },
            false,
            ['deriveBits']
        );
        const derivedBits = await window.crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: saltBytes,
                iterations: BUILTIN_VAULT.iterations,
                hash: 'SHA-256'
            },
            baseKey,
            512
        );
        const derived = new Uint8Array(derivedBits);
        const aesKeyBytes = derived.slice(0, 32);
        const macKeyBytes = derived.slice(32, 64);

        // 2. 驗證 HMAC-SHA256(iv || ciphertext)
        const macInput = new Uint8Array(ivBytes.length + cipherBytes.length);
        macInput.set(ivBytes, 0);
        macInput.set(cipherBytes, ivBytes.length);

        const hmacKey = await window.crypto.subtle.importKey(
            'raw',
            macKeyBytes,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        const computedMacBuf = await window.crypto.subtle.sign('HMAC', hmacKey, macInput);
        const computedMac = new Uint8Array(computedMacBuf);

        if (!constantTimeEqual(computedMac, expectedMac)) {
            throw new Error('密碼錯誤，請重新輸入！');
        }

        // 3. AES-256-CBC 解密
        const aesKey = await window.crypto.subtle.importKey(
            'raw',
            aesKeyBytes,
            { name: 'AES-CBC' },
            false,
            ['decrypt']
        );
        const plainBuf = await window.crypto.subtle.decrypt(
            { name: 'AES-CBC', iv: ivBytes },
            aesKey,
            cipherBytes
        );

        unlockedToken = new TextDecoder().decode(plainBuf);
        return true;
    }

    function isUnlocked() {
        return !!unlockedToken;
    }

    function lock() {
        unlockedToken = '';
    }

    /** 一鍵將最新題庫發布至 GitHub 儲存庫的 scenarios.json */
    async function publishScenarios(scenarios) {
        if (!unlockedToken) {
            throw new Error('尚未登入教官後台，請重新輸入密碼登入。');
        }

        const { owner, repo, branch, filePath } = BUILTIN_VAULT;
        const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}`;
        const headers = {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${unlockedToken}`,
            'X-GitHub-Api-Version': '2022-11-28'
        };

        // 1. 取得目前檔案的 sha
        let sha = undefined;
        const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}&t=${Date.now()}`, {
            method: 'GET',
            headers
        });

        if (getRes.ok) {
            const existing = await getRes.json();
            sha = existing.sha;
        } else if (getRes.status === 401 || getRes.status === 403) {
            throw new Error('雲端發布憑證無效或權限不足。');
        } else if (getRes.status !== 404) {
            const errData = await getRes.json().catch(() => ({}));
            throw new Error(`讀取雲端題庫失敗 (${getRes.status})：${errData.message || '請稍後再試'}`);
        }

        // 2. 寫入新版 scenarios.json
        const jsonText = JSON.stringify(scenarios, null, 2) + '\n';
        const body = {
            message: `更新 PDCP 訓練劇本 (共 ${scenarios.length} 個狀況)`,
            content: utf8ToBase64(jsonText),
            branch: branch
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
            if (putRes.status === 409) {
                throw new Error('雲端檔案剛被其他裝置更新，請再按一次發布！');
            }
            throw new Error(`發布失敗 (${putRes.status})：${errData.message || '請檢查網路連線'}`);
        }

        return await putRes.json();
    }

    return {
        unlockWithPassword,
        isUnlocked,
        lock,
        publishScenarios
    };
})();

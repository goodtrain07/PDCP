/**
 * 文湖線月台門訓練機 (PDCP) — 主程式與面板渲染
 */

(function () {
    const STORAGE_KEY = 'pdcp_trainer_scenarios_v1';
    const DRAFT_FLAG_KEY = 'pdcp_has_local_draft_v1';
    const {
        COL1, COL2, COL3, COL4, COL5, LEFT_YS,
        LIGHTS, CONTROLS, AudioFX
    } = window.PDCP_COMPONENTS;

    let scenarios = [];
    let engine = null;
    let admin = null;

    function createLabel(zh, en) {
        return `<div class="label-text">${zh}<br><span class="label-eng">${en}</span></div>`;
    }

    /** 取得線上網站最新題庫 (scenarios.json)，若為離線 file:// 則退回內建預設 */
    async function fetchSiteDefaultScenarios() {
        try {
            const res = await fetch(`./scenarios.json?t=${Date.now()}`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    return { data, fromRemote: true };
                }
            }
        } catch (e) {
            // 離線 file:// 或無網路環境
        }
        return { data: null, fromRemote: false };
    }

    /**
     * 智慧題庫載入：
     * 1. 若教官在本機後台有「未發布的草稿」，優先載入草稿方便繼續編輯。
     * 2. 一般學員每次連網開啟，一律抓取網站最新 scenarios.json 並更新離線快取。
     * 3. 若無網路，則自動使用上次離線快取或內建預設題庫。
     */
    async function loadScenarios() {
        const hasDraft = localStorage.getItem(DRAFT_FLAG_KEY) === '1';
        const cachedRaw = localStorage.getItem(STORAGE_KEY);
        let cached = null;
        if (cachedRaw) {
            try {
                const parsed = JSON.parse(cachedRaw);
                if (Array.isArray(parsed) && parsed.length > 0) cached = parsed;
            } catch (e) {}
        }

        if (hasDraft && cached) {
            return cached;
        }

        const { data: remoteData, fromRemote } = await fetchSiteDefaultScenarios();
        if (fromRemote && remoteData) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteData));
            return remoteData;
        }

        if (cached) {
            return cached;
        }
        return JSON.parse(JSON.stringify(window.PDCP_DEFAULT_SCENARIOS || []));
    }

    function saveScenariosToStorage(nextScenarios, markAsDraft = true) {
        scenarios = nextScenarios;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
        if (markAsDraft) {
            localStorage.setItem(DRAFT_FLAG_KEY, '1');
        } else {
            localStorage.removeItem(DRAFT_FLAG_KEY);
        }
        populateScenarioSelector();
    }

    /** 建立硬體面板 HTML 並綁定所有 44 個元件 */
    function buildHardwarePanel(panelEl) {
        let html = '<div class="bottom-grey-section"></div>';

        // 1. 左側 1~8 號門 (綠燈、紅燈、CUTOUT 旋鈕)
        for (let i = 1; i <= 8; i++) {
            const y = LEFT_YS[i - 1];
            html += `
                <div class="component" style="left:${COL1}%; top:${y}%;">
                    <div class="led-bezel"><div class="led green" data-light="door_${i}_close"></div></div>
                    ${createLabel(`自動門1-${i}閉鎖`, 'CLOSE & LOCKED')}
                </div>
                <div class="component" style="left:${COL2}%; top:${y}%;">
                    <div class="led-bezel"><div class="led red off" data-light="door_${i}_fault"></div></div>
                    ${createLabel(`自動門${i}故障`, 'MALFUNCTION')}
                </div>
                <div class="component" style="left:${COL3}%; top:${y}%;">
                    <div class="knob black" data-toggle="door_${i}_cutout" title="自動門 ${i} 切換 (AUTO / CUTOUT)"></div>
                    ${createLabel(`自動門${i}切換`, 'CUTOUT / AUTO')}
                </div>
            `;
        }

        // 2. 左側下方 4 顆綠燈
        const bottomLeft = [
            { id: 'all_asd_close', zh: '所有自動門閉鎖', en: 'ALL ASD CLOSE & LOCKED', large: false },
            { id: 'pos_1_2_close', zh: '第1-2 (POSITION 1-2)', en: 'CLOSE & LOCKED', large: false },
            { id: 'ems_1_20', zh: '1-20', en: '', large: true },
            { id: 'ems_21_40', zh: '21-40', en: '', large: true }
        ];
        bottomLeft.forEach((item, idx) => {
            const y = LEFT_YS[8 + idx];
            const scaleStyle = item.large ? 'style="transform: scale(1.1);"' : '';
            html += `
                <div class="component" style="left:${COL1}%; top:${y}%;">
                    <div class="led-bezel"><div class="led green" data-light="${item.id}"></div></div>
                    <div class="label-text" ${scaleStyle}>${item.zh}<br><span class="label-eng">${item.en}</span></div>
                </div>
            `;
        });

        // 3. 右側控制面板元件
        const rightComponents = [
            {
                x: COL4, y: 7.5,
                html: `<div class="led-bezel"><div class="led white" data-light="pdcp_power"></div></div>${createLabel('電源指示', 'PDCP POWER')}`
            },
            {
                x: COL5, y: 7.5,
                html: `<div class="led-bezel"><div class="led red off" data-light="pdcp_mcp"></div></div>${createLabel('斷路器指示', 'PDCP MCP')}`
            },
            {
                x: COL5, y: 15.5,
                html: `<div class="knob black" data-lamptest="lamp_test" title="燈號測試鈕"></div>${createLabel('燈號測試鈕', 'LAMP TEST ON/OFF')}`
            },
            {
                x: COL4, y: 22.5,
                html: `<div class="led-bezel"><div class="led white off" data-light="fully_open"></div></div>${createLabel('自動門完全開啟', 'FULLY OPEN')}`
            },
            {
                x: COL4, y: 30,
                html: `<div class="led-bezel"><div class="led red off" data-light="obstruction"></div></div>${createLabel('自動門阻塞', 'OBSTRUCTION')}`
            },
            {
                x: COL5, y: 36.5,
                html: `
                    <div class="label-text" style="margin-bottom:2px;">自動 AUTO&nbsp;&nbsp;手動 MANUAL</div>
                    <div class="keyhole-bezel" data-toggle="key_mode" title="自動/手動鑰匙孔">
                        <div class="keyhole-inner"><div class="keyhole-slot"></div></div>
                    </div>
                    <div class="label-yellow" style="margin-top: 5px;">請壓到底再轉</div>
                `
            },
            {
                x: COL4, y: 43.5,
                html: `<div class="led-bezel"><div class="led white off" data-light="open_indicator"></div></div>${createLabel('自動門開啟警示聲', 'OPEN INDICATOR')}`
            },
            {
                x: COL4, y: 53.5,
                html: `
                    <div class="label-text" style="position:absolute; top:-10px; font-size:0.6em; left:-2em;">開<br>OPEN</div>
                    <div class="knob green" data-toggle="knob_cmd_1" title="旋鈕 1：自動門開啟指令"></div>
                    <div class="label-text" style="position:absolute; top:-10px; font-size:0.6em; right:-2.5em;">閉<br>CLOSE</div>
                    <div class="label-text" style="position:absolute; left:-2.5em; font-size:1.2em;">1</div>
                    ${createLabel('自動門開啟指令', 'OPEN COMMAND')}
                `
            },
            {
                x: COL4, y: 62.5,
                html: `
                    <div class="label-text" style="position:absolute; top:-10px; font-size:0.6em; left:-2.5em;">開<br>ENABLE</div>
                    <div class="knob green" data-toggle="knob_cmd_2" title="旋鈕 2：自動門作動指令"></div>
                    <div class="label-text" style="position:absolute; top:-10px; font-size:0.6em; right:-3em;">閉<br>DISABLE</div>
                    <div class="label-text" style="position:absolute; left:-2.5em; font-size:1.2em;">2</div>
                    ${createLabel('自動門作動指令', 'ENABLE COMMAND')}
                `
            },
            {
                x: COL5 + 1.5, y: 58,
                html: `<div class="label-yellow" style="background:transparent; border-color:#d4ac0d; color:#b78c00; font-size:0.6em; line-height:1.15;">※務必同時轉動<br>旋鈕1、旋鈕2</div>`
            },
            {
                x: COL4, y: 70.5,
                html: `
                    <div class="push-btn-bezel black" data-momentary="buzzer_btn" title="按鈕 3：蜂鳴器">
                        <div class="push-btn black">3</div>
                    </div>
                    ${createLabel('自動門蜂鳴器', 'BUZZER X LIGHT')}
                `
            },
            {
                x: COL3 + 10, y: 77.5,
                html: `<div class="knob black" data-toggle="sel_pos_1" title="選擇位置 1"></div>${createLabel('選擇位置 1', 'SELECTION 1')}`
            },
            {
                x: COL4 + 6, y: 77.5,
                html: `<div class="led-bezel"><div class="led white off" data-light="pos_1_active"></div></div>${createLabel('執行位置 1', 'POSITION 1 ACTIVE')}`
            },
            {
                x: COL3 + 10, y: 84,
                html: `<div class="knob black" data-toggle="sel_pos_2" title="選擇位置 2"></div>${createLabel('選擇位置 2', 'SELECTION 2')}`
            },
            {
                x: COL4 + 6, y: 84,
                html: `<div class="led-bezel"><div class="led white off" data-light="pos_2_active"></div></div>${createLabel('執行位置 2', 'POSITION 2 ACTIVE')}`
            }
        ];

        rightComponents.forEach(comp => {
            html += `<div class="component" style="left:${comp.x}%; top:${comp.y}%;">${comp.html}</div>`;
        });

        // 4. 底部 Bypass 區
        html += `
            <div class="component" style="left: 20%; top: 94%;">
                <div style="background:#e74c3c; color:white; font-size:0.6em; padding:2px 4px; font-weight:bold; position:absolute; top:-3.6em; white-space:nowrap; border-radius:2px;">緊急門旁通按鈕<br>PUSH ON</div>
                <div class="push-btn-bezel ed" data-momentary="ed_bypass_btn" title="緊急門旁通按鈕 (ED BYPASS)">
                    <div class="push-btn ed"></div>
                </div>
                <div class="label-yellow" style="position:absolute; bottom:-3em; font-size:0.8em;">緊急門旁通<br>ED BYPASS</div>
            </div>
            <div class="component" style="left: 60%; top: 94%;">
                <div class="label-text" style="position:absolute; top:-3em; font-size:0.7em;">SD Bypass<br>OFF &nbsp;&nbsp;&nbsp;&nbsp; ON</div>
                <div class="knob red" data-toggle="sd_bypass_knob" title="月台門旁通旋鈕 (SD BYPASS)"></div>
                <div class="label-yellow" style="position:absolute; bottom:-3em; font-size:0.75em; left:-1.5em;">月台門旁通<br>SD BYPASS</div>
            </div>
            <div class="component" style="left: 82%; top: 94%;">
                <div class="label-text" style="position:absolute; top:-3.5em; font-size:0.7em;">SD Bypass<br>Push ON</div>
                <div class="push-btn-bezel sd" data-momentary="sd_bypass_btn" title="月台門旁通按鈕 (SD BYPASS)">
                    <div class="push-btn sd"></div>
                </div>
            </div>
        `;

        panelEl.innerHTML = html;

        // 綁定切換型元件 (旋鈕與鑰匙)
        panelEl.querySelectorAll('[data-toggle]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                engine.toggleControl(el.dataset.toggle);
            });
        });

        // 綁定燈號測試鈕
        panelEl.querySelectorAll('[data-lamptest]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                engine.triggerLampTest();
            });
        });

        // 綁定瞬時按鈕 (使用 Pointer Events，完美相容滑鼠與手機觸控長按)
        panelEl.querySelectorAll('[data-momentary]').forEach(el => {
            const id = el.dataset.momentary;

            el.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                if (el.setPointerCapture) {
                    try { el.setPointerCapture(e.pointerId); } catch (_) {}
                }
                engine.pressMomentary(id);
            });

            const releaseHandler = (e) => {
                e.preventDefault();
                engine.releaseMomentary(id);
            };
            el.addEventListener('pointerup', releaseHandler);
            el.addEventListener('pointercancel', releaseHandler);
        });
    }

    /** 根據引擎狀態同步畫面燈號與旋鈕位置 */
    function renderPanelState({ lights, controls, lampTestActive }) {
        LIGHTS.forEach(l => {
            const el = document.querySelector(`[data-light="${l.id}"]`);
            if (!el) return;
            const state = lampTestActive ? 'on' : (lights[l.id] || l.defaultState);
            el.classList.remove('off', 'blink');
            if (state === 'off') {
                el.classList.add('off');
            } else if (state === 'blink') {
                el.classList.add('blink');
            }
        });

        CONTROLS.forEach(c => {
            const isOn = controls[c.id] === 'on';
            if (c.id === 'key_mode') {
                const el = document.querySelector('[data-toggle="key_mode"]');
                if (el) el.classList.toggle('active', isOn);
            } else if (c.kind === 'toggle') {
                const el = document.querySelector(`[data-toggle="${c.id}"]`);
                if (el) el.classList.toggle('on', isOn);
            } else if (c.kind === 'lamp_test') {
                const el = document.querySelector(`[data-lamptest="${c.id}"]`);
                if (el) el.classList.toggle('on', isOn);
            } else if (c.kind === 'momentary') {
                const el = document.querySelector(`[data-momentary="${c.id}"]`);
                if (el) el.classList.toggle('pressed', isOn);
            }
        });
    }

    /** 更新頂部劇本選單 */
    function populateScenarioSelector(keepSelectedId = null) {
        const selector = document.getElementById('scenario-selector');
        const prev = keepSelectedId || selector.value;
        if (scenarios.length === 0) {
            selector.innerHTML = `<option value="">（尚無劇本，請至後台新增）</option>`;
            return;
        }
        selector.innerHTML = scenarios.map(sc =>
            `<option value="${sc.id}">${sc.title}</option>`
        ).join('');

        if (prev && scenarios.some(s => s.id === prev)) {
            selector.value = prev;
        }
    }

    function updateStatusBar(message, level = 'normal') {
        const container = document.getElementById('status-container');
        const textEl = document.getElementById('status-text');
        textEl.textContent = message;
        container.className = `status-row level-${level}`;
    }

    function updateProgressBadge({ active, completed, current, total }) {
        const badge = document.getElementById('step-progress-badge');
        if (!active || total === 0) {
            badge.textContent = '自由模式';
            badge.className = 'step-progress-badge idle';
        } else if (completed) {
            badge.textContent = `已完成 (${total}/${total})`;
            badge.className = 'step-progress-badge done';
        } else {
            badge.textContent = `步驟 ${current + 1} / ${total}`;
            badge.className = 'step-progress-badge active';
        }
    }

    function updateHoldBar(ratio) {
        const bar = document.getElementById('hold-progress-fill');
        if (!bar) return;
        bar.style.width = `${Math.round(ratio * 100)}%`;
        bar.style.opacity = ratio > 0 ? '1' : '0';
    }

    async function init() {
        const panelEl = document.getElementById('panel-container');
        buildHardwarePanel(panelEl);

        engine = new window.PDCPEngine({
            onRender: renderPanelState,
            onStatus: updateStatusBar,
            onProgress: updateProgressBadge,
            onHoldProgress: updateHoldBar
        });

        scenarios = await loadScenarios();
        populateScenarioSelector();
        engine.resetPanel(false);

        // 頂部控制列按鈕
        document.getElementById('btn-trigger').addEventListener('click', () => {
            const id = document.getElementById('scenario-selector').value;
            const sc = scenarios.find(s => s.id === id);
            if (sc) engine.startScenario(sc);
        });

        document.getElementById('btn-reset').addEventListener('click', () => {
            engine.resetPanel(false);
        });

        document.getElementById('btn-hint').addEventListener('click', () => {
            engine.showHint();
        });

        const muteBtn = document.getElementById('btn-mute');
        muteBtn.addEventListener('click', () => {
            const nextMuted = !AudioFX.isMuted();
            AudioFX.setMuted(nextMuted);
            muteBtn.textContent = nextMuted ? '🔇' : '🔊';
            muteBtn.title = nextMuted ? '音效已靜音（點擊開啟）' : '音效已開啟（點擊靜音）';
        });

        // 教官後台初始化
        admin = new window.PDCPAdmin({
            modalEl: document.getElementById('admin-modal'),
            listEl: document.getElementById('admin-scenario-list'),
            editorEl: document.getElementById('admin-editor-pane'),
            toastEl: document.getElementById('admin-toast'),
            getScenarios: () => scenarios,
            saveScenarios: (list) => saveScenariosToStorage(list),
            resetToDefault: async () => {
                localStorage.removeItem(DRAFT_FLAG_KEY);
                localStorage.removeItem(STORAGE_KEY);
                const { data: remoteData } = await fetchSiteDefaultScenarios();
                const fresh = remoteData || JSON.parse(JSON.stringify(window.PDCP_DEFAULT_SCENARIOS || []));
                saveScenariosToStorage(fresh, false);
                return fresh;
            },
            onTestScenario: (scId) => {
                populateScenarioSelector(scId);
                const sc = scenarios.find(s => s.id === scId);
                if (sc) engine.startScenario(sc);
            }
        });

        // 教官後台密碼登入視窗
        const loginDialog = document.getElementById('login-dialog');
        const passwordInput = document.getElementById('admin-password-input');
        const loginStatusBox = document.getElementById('login-status-box');
        const btnConfirmLogin = document.getElementById('btn-confirm-login');

        function setLoginStatus(msg, type = '') {
            loginStatusBox.textContent = msg;
            loginStatusBox.className = `publish-status-box ${type}`;
        }

        function openLoginDialog() {
            passwordInput.value = '';
            setLoginStatus('', '');
            loginDialog.classList.add('open');
            setTimeout(() => passwordInput.focus(), 50);
        }

        function closeLoginDialog() {
            loginDialog.classList.remove('open');
            passwordInput.value = '';
        }

        async function handleAdminLogin() {
            const pwd = passwordInput.value;
            if (!pwd) {
                setLoginStatus('❌ 請輸入教官密碼！', 'error');
                return;
            }
            btnConfirmLogin.disabled = true;
            setLoginStatus('⏳ 驗證密碼並解鎖安全保險箱...', 'info');
            try {
                await window.PDCPGitHubSync.unlockWithPassword(pwd);
                closeLoginDialog();
                admin.open();
                admin.showToast('🔓 教官後台已解鎖！修改完成可直接點「☁️ 發布到網路」。');
            } catch (err) {
                setLoginStatus(`❌ ${err.message}`, 'error');
                passwordInput.select();
            } finally {
                btnConfirmLogin.disabled = false;
            }
        }

        document.getElementById('btn-open-admin').addEventListener('click', () => {
            if (window.PDCPGitHubSync.isUnlocked()) {
                admin.open();
            } else {
                openLoginDialog();
            }
        });
        document.getElementById('btn-close-login').addEventListener('click', closeLoginDialog);
        document.getElementById('btn-cancel-login').addEventListener('click', closeLoginDialog);
        loginDialog.addEventListener('click', (e) => {
            if (e.target === loginDialog) closeLoginDialog();
        });
        btnConfirmLogin.addEventListener('click', handleAdminLogin);
        passwordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleAdminLogin();
            }
        });

        document.getElementById('btn-close-admin').addEventListener('click', () => admin.close());
        document.getElementById('btn-admin-logout').addEventListener('click', () => {
            window.PDCPGitHubSync.lock();
            admin.close();
            updateStatusBar('🔒 已登出並鎖定教官後台。', 'normal');
        });
        document.getElementById('btn-admin-add').addEventListener('click', () => admin.addScenario());
        document.getElementById('btn-admin-save').addEventListener('click', () => admin.commitSave());
        document.getElementById('btn-admin-export').addEventListener('click', () => admin.exportJson());
        document.getElementById('btn-admin-reset-default').addEventListener('click', () => admin.handleResetDefault());

        // 一鍵發布到網路（免填任何設定，直接同步到 GitHub）
        const btnPublish = document.getElementById('btn-admin-publish');
        btnPublish.addEventListener('click', async () => {
            if (!window.PDCPGitHubSync.isUnlocked()) {
                openLoginDialog();
                return;
            }
            admin.commitSave();
            const originalText = btnPublish.textContent;
            btnPublish.disabled = true;
            btnPublish.textContent = '⏳ 發布中...';
            try {
                await window.PDCPGitHubSync.publishScenarios(admin.draftScenarios);
                saveScenariosToStorage(JSON.parse(JSON.stringify(admin.draftScenarios)), false);
                admin.showToast('✅ 發布成功！約 30 秒內所有手機重整網頁即可同步最新演練！');
            } catch (err) {
                admin.showToast(`❌ ${err.message}`, true);
            } finally {
                btnPublish.disabled = false;
                btnPublish.textContent = originalText;
            }
        });

        const importInput = document.getElementById('input-import-json');
        document.getElementById('btn-admin-import').addEventListener('click', () => {
            importInput.value = '';
            importInput.click();
        });
        importInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                admin.importJsonFile(e.target.files[0]);
            }
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();

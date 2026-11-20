/**
 * 文湖線月台門訓練機 (PDCP) — 硬體面板元件定義與音效模組
 * 統一管理面板上所有指示燈 (25 顆) 與控制元件 (19 個)，供模擬器與教官後台共用。
 */

window.PDCP_COMPONENTS = (function () {
    // 面板座標欄位百分比
    const COL1 = 16;
    const COL2 = 32;
    const COL3 = 48;
    const COL4 = 72;
    const COL5 = 88;
    const LEFT_YS = [6.5, 13, 19.5, 26, 32.5, 39, 45.5, 52, 61, 67.5, 74, 80.5];

    /**
     * 所有指示燈清單
     * defaultState: 'on' | 'off' | 'blink'
     */
    const LIGHTS = [];

    // 1~8 號自動門：閉鎖綠燈 + 故障紅燈
    for (let i = 1; i <= 8; i++) {
        const y = LEFT_YS[i - 1];
        LIGHTS.push({
            id: `door_${i}_close`,
            name: `自動門 1-${i} 閉鎖 (綠燈)`,
            group: '左側 1~8 號門指示燈',
            color: 'green',
            defaultState: 'on',
            x: COL1,
            y: y,
            zh: `自動門1-${i}閉鎖`,
            en: 'CLOSE & LOCKED'
        });
        LIGHTS.push({
            id: `door_${i}_fault`,
            name: `自動門 ${i} 故障 (紅燈)`,
            group: '左側 1~8 號門指示燈',
            color: 'red',
            defaultState: 'off',
            x: COL2,
            y: y,
            zh: `自動門${i}故障`,
            en: 'MALFUNCTION'
        });
    }

    // 左側下方 4 顆綠燈
    LIGHTS.push(
        {
            id: 'all_asd_close',
            name: '所有自動門閉鎖 (綠燈)',
            group: '左側系統總覽燈',
            color: 'green',
            defaultState: 'on',
            x: COL1,
            y: LEFT_YS[8],
            zh: '所有自動門閉鎖',
            en: 'ALL ASD CLOSE & LOCKED'
        },
        {
            id: 'pos_1_2_close',
            name: '第 1-2 位置閉鎖 (綠燈)',
            group: '左側系統總覽燈',
            color: 'green',
            defaultState: 'on',
            x: COL1,
            y: LEFT_YS[9],
            zh: '第1-2 (POSITION 1-2)',
            en: 'CLOSE & LOCKED'
        },
        {
            id: 'ems_1_20',
            name: '緊急門 1-20 EMS (綠燈)',
            group: '左側系統總覽燈',
            color: 'green',
            defaultState: 'on',
            x: COL1,
            y: LEFT_YS[10],
            zh: '1-20',
            en: '',
            largeLabel: true
        },
        {
            id: 'ems_21_40',
            name: '緊急門 21-40 EMS (綠燈)',
            group: '左側系統總覽燈',
            color: 'green',
            defaultState: 'on',
            x: COL1,
            y: LEFT_YS[11],
            zh: '21-40',
            en: '',
            largeLabel: true
        }
    );

    // 右側指示燈
    LIGHTS.push(
        {
            id: 'pdcp_power',
            name: '電源指示 PDCP POWER (白燈)',
            group: '右側狀態指示燈',
            color: 'white',
            defaultState: 'on',
            x: COL4,
            y: 7.5,
            zh: '電源指示',
            en: 'PDCP POWER'
        },
        {
            id: 'pdcp_mcp',
            name: '斷路器指示 PDCP MCP (紅燈)',
            group: '右側狀態指示燈',
            color: 'red',
            defaultState: 'off',
            x: COL5,
            y: 7.5,
            zh: '斷路器指示',
            en: 'PDCP MCP'
        },
        {
            id: 'fully_open',
            name: '自動門完全開啟 FULLY OPEN (白燈)',
            group: '右側狀態指示燈',
            color: 'white',
            defaultState: 'off',
            x: COL4,
            y: 22.5,
            zh: '自動門完全開啟',
            en: 'FULLY OPEN'
        },
        {
            id: 'obstruction',
            name: '自動門阻塞 OBSTRUCTION (紅燈)',
            group: '右側狀態指示燈',
            color: 'red',
            defaultState: 'off',
            x: COL4,
            y: 30,
            zh: '自動門阻塞',
            en: 'OBSTRUCTION'
        },
        {
            id: 'open_indicator',
            name: '自動門開啟警示聲 OPEN INDICATOR (白燈)',
            group: '右側狀態指示燈',
            color: 'white',
            defaultState: 'off',
            x: COL4,
            y: 43.5,
            zh: '自動門開啟警示聲',
            en: 'OPEN INDICATOR'
        },
        {
            id: 'pos_1_active',
            name: '執行位置 1 ACTIVE (白燈)',
            group: '右側狀態指示燈',
            color: 'white',
            defaultState: 'off',
            x: COL4 + 6,
            y: 77.5,
            zh: '執行位置 1',
            en: 'POSITION 1 ACTIVE'
        },
        {
            id: 'pos_2_active',
            name: '執行位置 2 ACTIVE (白燈)',
            group: '右側狀態指示燈',
            color: 'white',
            defaultState: 'off',
            x: COL4 + 6,
            y: 84,
            zh: '執行位置 2',
            en: 'POSITION 2 ACTIVE'
        }
    );

    /**
     * 所有可操作控制元件清單
     * kind:
     *   - 'toggle': 兩段式切換（旋鈕 / 鑰匙），狀態為 'off' | 'on'
     *   - 'momentary': 瞬時按鈕（點擊觸發或長按觸發）
     *   - 'lamp_test': 燈號測試旋鈕（點擊自動亮 1.2 秒後彈回）
     */
    const CONTROLS = [];

    // 1~8 號門切換旋鈕 (CUTOUT / AUTO)
    for (let i = 1; i <= 8; i++) {
        CONTROLS.push({
            id: `door_${i}_cutout`,
            name: `自動門 ${i} 切換旋鈕 (AUTO / CUTOUT)`,
            group: '左側 1~8 號門切換旋鈕',
            kind: 'toggle',
            offLabel: 'AUTO (自動)',
            onLabel: 'CUTOUT (隔離)',
            x: COL3,
            y: LEFT_YS[i - 1],
            zh: `自動門${i}切換`,
            en: 'CUTOUT / AUTO'
        });
    }

    // 右側與底部控制元件
    CONTROLS.push(
        {
            id: 'lamp_test',
            name: '燈號測試鈕 (LAMP TEST)',
            group: '右側控制元件',
            kind: 'lamp_test',
            offLabel: 'OFF',
            onLabel: 'TEST',
            x: COL5,
            y: 15.5,
            zh: '燈號測試鈕',
            en: 'LAMP TEST ON/OFF'
        },
        {
            id: 'key_mode',
            name: '自動/手動鑰匙孔 (AUTO / MANUAL)',
            group: '右側控制元件',
            kind: 'toggle',
            offLabel: 'AUTO (自動)',
            onLabel: 'MANUAL (手動)',
            x: COL5,
            y: 36.5
        },
        {
            id: 'knob_cmd_1',
            name: '旋鈕 1：自動門開啟指令 (CLOSE / OPEN)',
            group: '右側控制元件',
            kind: 'toggle',
            offLabel: 'CLOSE (閉)',
            onLabel: 'OPEN (開)',
            x: COL4,
            y: 53.5
        },
        {
            id: 'knob_cmd_2',
            name: '旋鈕 2：自動門作動指令 (DISABLE / ENABLE)',
            group: '右側控制元件',
            kind: 'toggle',
            offLabel: 'DISABLE (閉)',
            onLabel: 'ENABLE (開)',
            x: COL4,
            y: 62.5
        },
        {
            id: 'buzzer_btn',
            name: '按鈕 3：自動門蜂鳴器 (BUZZER)',
            group: '右側控制元件',
            kind: 'momentary',
            offLabel: '放開',
            onLabel: '按壓',
            x: COL4,
            y: 70.5
        },
        {
            id: 'sel_pos_1',
            name: '選擇位置 1 旋鈕 (SELECTION 1)',
            group: '右側控制元件',
            kind: 'toggle',
            offLabel: 'OFF',
            onLabel: 'ON (選擇位置 1)',
            x: COL3 + 10,
            y: 77.5
        },
        {
            id: 'sel_pos_2',
            name: '選擇位置 2 旋鈕 (SELECTION 2)',
            group: '右側控制元件',
            kind: 'toggle',
            offLabel: 'OFF',
            onLabel: 'ON (選擇位置 2)',
            x: COL3 + 10,
            y: 84
        },
        {
            id: 'ed_bypass_btn',
            name: '緊急門旁通按鈕 (ED BYPASS 紅按鈕)',
            group: '底部旁通 (Bypass) 區',
            kind: 'momentary',
            offLabel: '放開',
            onLabel: '按壓',
            x: 20,
            y: 94
        },
        {
            id: 'sd_bypass_knob',
            name: '月台門旁通旋鈕 (SD BYPASS 紅旋鈕)',
            group: '底部旁通 (Bypass) 區',
            kind: 'toggle',
            offLabel: 'OFF',
            onLabel: 'ON',
            x: 60,
            y: 94
        },
        {
            id: 'sd_bypass_btn',
            name: '月台門旁通按鈕 (SD BYPASS 黃按鈕)',
            group: '底部旁通 (Bypass) 區',
            kind: 'momentary',
            offLabel: '放開',
            onLabel: '按壓',
            x: 82,
            y: 94
        }
    );

    const LIGHT_MAP = Object.fromEntries(LIGHTS.map(l => [l.id, l]));
    const CONTROL_MAP = Object.fromEntries(CONTROLS.map(c => [c.id, c]));

    /**
     * Web Audio API 簡易音效器（免外部音檔，純瀏覽器發聲）
     */
    const AudioFX = (function () {
        let ctx = null;
        let buzzerOsc = null;
        let buzzerGain = null;
        let muted = false;

        function ensureCtx() {
            if (muted) return null;
            if (!ctx) {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (AudioContextClass) {
                    ctx = new AudioContextClass();
                }
            }
            if (ctx && ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }
            return ctx;
        }

        function playClick(freq = 520, duration = 0.045) {
            const c = ensureCtx();
            if (!c) return;
            try {
                const osc = c.createOscillator();
                const gain = c.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, c.currentTime);
                gain.gain.setValueAtTime(0.08, c.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
                osc.connect(gain);
                gain.connect(c.destination);
                osc.start();
                osc.stop(c.currentTime + duration);
            } catch (e) {}
        }

        function playSuccess() {
            const c = ensureCtx();
            if (!c) return;
            [660, 880].forEach((f, idx) => {
                setTimeout(() => playClick(f, 0.12), idx * 90);
            });
        }

        function playError() {
            const c = ensureCtx();
            if (!c) return;
            playClick(200, 0.18);
        }

        function startBuzzer() {
            const c = ensureCtx();
            if (!c || buzzerOsc) return;
            try {
                buzzerOsc = c.createOscillator();
                buzzerGain = c.createGain();
                buzzerOsc.type = 'sawtooth';
                buzzerOsc.frequency.setValueAtTime(880, c.currentTime);
                buzzerGain.gain.setValueAtTime(0.09, c.currentTime);
                buzzerOsc.connect(buzzerGain);
                buzzerGain.connect(c.destination);
                buzzerOsc.start();
            } catch (e) {}
        }

        function stopBuzzer() {
            if (buzzerOsc) {
                try {
                    buzzerOsc.stop();
                    buzzerOsc.disconnect();
                } catch (e) {}
                buzzerOsc = null;
            }
            if (buzzerGain) {
                try { buzzerGain.disconnect(); } catch (e) {}
                buzzerGain = null;
            }
        }

        function setMuted(isMuted) {
            muted = !!isMuted;
            if (muted) stopBuzzer();
        }

        function isMuted() {
            return muted;
        }

        return { playClick, playSuccess, playError, startBuzzer, stopBuzzer, setMuted, isMuted };
    })();

    return {
        COL1, COL2, COL3, COL4, COL5, LEFT_YS,
        LIGHTS,
        CONTROLS,
        LIGHT_MAP,
        CONTROL_MAP,
        AudioFX
    };
})();

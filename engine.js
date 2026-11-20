/**
 * 文湖線月台門訓練機 (PDCP) — 資料驅動 SOP 劇本引擎
 * 負責面板硬體狀態管理、燈號連動、長按計時與劇本步驟驗證。
 */

window.PDCPEngine = (function () {
    const { LIGHTS, CONTROLS, LIGHT_MAP, CONTROL_MAP, AudioFX } = window.PDCP_COMPONENTS;

    class Engine {
        constructor(callbacks = {}) {
            this.callbacks = callbacks;
            this.lights = {};
            this.controls = {};
            this.lampTestActive = false;
            this.lampTestTimer = null;

            this.activeScenario = null;
            this.currentStepIndex = 0;
            this.completed = false;

            this.holdTimer = null;
            this.holdInterval = null;
            this.holdControlId = null;

            this.resetPanel(true);
        }

        /** 將所有燈號與旋鈕恢復為系統預設正常狀態 */
        resetPanel(silent = false) {
            this._clearTimers();
            this.activeScenario = null;
            this.currentStepIndex = 0;
            this.completed = false;
            this.lampTestActive = false;

            LIGHTS.forEach(l => {
                this.lights[l.id] = l.defaultState;
            });
            CONTROLS.forEach(c => {
                this.controls[c.id] = 'off';
            });

            this._emitRender();
            this._emitProgress();
            this._emitHoldProgress(0, null);
            if (!silent) {
                this._emitStatus('🟢 系統已復原，請選擇模擬狀況並點擊「發送狀況」開始練習。', 'normal');
            }
        }

        /** 啟動指定劇本 */
        startScenario(scenario) {
            if (!scenario) return;
            this.resetPanel(true);
            this.activeScenario = JSON.parse(JSON.stringify(scenario));
            this.currentStepIndex = 0;
            this.completed = false;

            // 套用劇本初始燈號狀態
            if (this.activeScenario.initialLights) {
                Object.entries(this.activeScenario.initialLights).forEach(([lightId, state]) => {
                    if (LIGHT_MAP[lightId] && (state === 'on' || state === 'off' || state === 'blink')) {
                        this.lights[lightId] = state;
                    }
                });
            }

            // 如果沒有設定任何步驟，直接視為展示情境
            if (!this.activeScenario.steps || this.activeScenario.steps.length === 0) {
                this.completed = true;
            }

            this._emitRender();
            this._emitProgress();
            this._emitStatus(this.activeScenario.description || `⚠️ 已觸發：${this.activeScenario.title}`, 'warning');
            AudioFX.playError();
        }

        /** 取得目前步驟 */
        getCurrentStep() {
            if (!this.activeScenario || this.completed) return null;
            return this.activeScenario.steps[this.currentStepIndex] || null;
        }

        /** 顯示當前步驟的練習提示 */
        showHint() {
            const step = this.getCurrentStep();
            if (!step) {
                if (this.completed && this.activeScenario) {
                    this._emitStatus('✅ 此狀況已完成！可點擊「系統復原」或切換其他狀況。', 'success');
                } else {
                    this._emitStatus('💡 目前為自由操作模式。請從上方選擇一個模擬狀況並按「發送狀況」。', 'normal');
                }
                return;
            }
            const stepNum = this.currentStepIndex + 1;
            const total = this.activeScenario.steps.length;
            this._emitStatus(`💡 [步驟 ${stepNum}/${total} 提示] ${step.title}`, 'info');
        }

        /** 操作兩段式旋鈕或鑰匙 */
        toggleControl(controlId) {
            const meta = CONTROL_MAP[controlId];
            if (!meta || meta.kind !== 'toggle') return;

            const nextVal = this.controls[controlId] === 'on' ? 'off' : 'on';
            this.controls[controlId] = nextVal;
            AudioFX.playClick(nextVal === 'on' ? 600 : 420, 0.05);

            // 自由操作模式：提供基本硬體連動體驗
            if (!this.activeScenario) {
                this._applyFreeModeBehavior(controlId, nextVal);
                this._emitRender();
                const stateLabel = nextVal === 'on' ? meta.onLabel : meta.offLabel;
                this._emitStatus(`🔧 [自由操作] ${meta.name} → ${stateLabel}`, 'normal');
                return;
            }

            this._emitRender();

            if (this.completed) {
                const stateLabel = nextVal === 'on' ? meta.onLabel : meta.offLabel;
                this._emitStatus(`🔧 [動作] ${meta.name} → ${stateLabel}（本劇本已完成，可按系統復原）`, 'normal');
                return;
            }

            this._evaluateAfterToggle(controlId, nextVal);
        }

        /** 操作燈號測試鈕 (LAMP TEST) */
        triggerLampTest() {
            if (this.lampTestActive) return;
            this.lampTestActive = true;
            this.controls['lamp_test'] = 'on';
            AudioFX.playClick(740, 0.06);
            this._emitRender();
            this._emitStatus('💡 [動作] 執行 Lamp Test，全體面板燈號測試中...', 'info');

            this.lampTestTimer = setTimeout(() => {
                this.lampTestActive = false;
                this.controls['lamp_test'] = 'off';
                this._emitRender();

                if (!this.activeScenario) {
                    this._emitStatus('💡 [自由操作] Lamp Test 完畢，所有燈號已恢復正常顯示。', 'normal');
                    return;
                }
                if (this.completed) {
                    this._emitStatus('💡 [動作] Lamp Test 完畢。', 'normal');
                    return;
                }
                this._evaluateAction('lamp_test');
            }, 1200);
        }

        /** 按下瞬時按鈕 (蜂鳴器 / ED Bypass / SD Bypass) */
        pressMomentary(controlId) {
            const meta = CONTROL_MAP[controlId];
            if (!meta || meta.kind !== 'momentary') return;

            this.controls[controlId] = 'on';
            if (controlId === 'buzzer_btn') {
                AudioFX.startBuzzer();
            } else {
                AudioFX.playClick(500, 0.05);
            }
            this._emitRender();

            if (!this.activeScenario) {
                this._emitStatus(`🔧 [自由操作] 按壓「${meta.name}」`, 'normal');
                return;
            }
            if (this.completed) {
                this._emitStatus('ℹ️ 此劇本已完成，請點擊「系統復原」進行下一次練習。', 'normal');
                return;
            }

            const step = this.getCurrentStep();
            if (!step) return;

            if (step.type === 'action') {
                this._evaluateAction(controlId);
            } else if (step.type === 'hold') {
                if (step.controlId === controlId) {
                    this._startHold(step, controlId);
                } else {
                    AudioFX.playError();
                    this._emitStatus(step.wrongActionHint || `❌ [錯誤] 目前步驟應操作其他元件，請檢查 SOP！`, 'error');
                }
            } else {
                AudioFX.playError();
                this._emitStatus(step.wrongActionHint || `❌ [錯誤] 請先完成前置步驟：${step.title}`, 'error');
            }
        }

        /** 放開瞬時按鈕 */
        releaseMomentary(controlId) {
            const meta = CONTROL_MAP[controlId];
            if (!meta || meta.kind !== 'momentary') return;

            if (this.controls[controlId] !== 'on' && this.holdControlId !== controlId) return;

            this.controls[controlId] = 'off';
            if (controlId === 'buzzer_btn') {
                AudioFX.stopBuzzer();
            }
            this._emitRender();

            // 如果正在進行長按倒數且尚未完成，視為提早放開失敗
            if (this.holdControlId === controlId && this.holdTimer) {
                const step = this.getCurrentStep();
                this._clearHoldTimers();
                this._emitHoldProgress(0, null);
                AudioFX.playError();
                const msg = (step && step.releaseEarlyMessage)
                    ? step.releaseEarlyMessage
                    : '❌ [操作失敗] 尚未按滿指定秒數即放開按鈕！請重新長按。';
                this._emitStatus(msg, 'error');
            }
        }

        /** 檢查 toggle 型步驟 */
        _evaluateAfterToggle(controlId, newVal) {
            const step = this.getCurrentStep();
            if (!step) return;

            if (step.type !== 'state_match') {
                AudioFX.playError();
                this._emitStatus(step.wrongActionHint || `❌ [錯誤] 目前步驟為「${step.title}」。`, 'error');
                return;
            }

            const conditions = Array.isArray(step.conditions) ? step.conditions : [];
            const targetIds = conditions.map(c => c.controlId);

            // 檢查所有條件是否皆已滿足
            const matchedCount = conditions.filter(c => this.controls[c.controlId] === c.value).length;
            if (conditions.length > 0 && matchedCount === conditions.length) {
                this._completeCurrentStep();
                return;
            }

            // 如果操作的是本步驟相關元件，但尚未全部到位（例如雙旋鈕只轉了其中一顆）
            if (targetIds.includes(controlId)) {
                const meta = CONTROL_MAP[controlId];
                const stateLabel = newVal === 'on' ? meta.onLabel : meta.offLabel;
                if (conditions.length > 1) {
                    this._emitStatus(`🔧 [動作中 ${matchedCount}/${conditions.length}] ${meta.name} → ${stateLabel}，請繼續完成本步驟其餘項目。`, 'info');
                } else {
                    this._emitStatus(`🔧 [動作] ${meta.name} → ${stateLabel}`, 'normal');
                }
            } else {
                AudioFX.playError();
                this._emitStatus(step.wrongActionHint || `❌ [錯誤] 請先完成：${step.title}`, 'error');
            }
        }

        /** 檢查單次觸發動作 (action) */
        _evaluateAction(controlId) {
            const step = this.getCurrentStep();
            if (!step) return;

            if (step.type === 'action' && step.controlId === controlId) {
                this._completeCurrentStep();
            } else {
                AudioFX.playError();
                this._emitStatus(step.wrongActionHint || `❌ [錯誤] 目前步驟為「${step.title}」。`, 'error');
            }
        }

        /** 啟動長按計時 */
        _startHold(step, controlId) {
            this._clearHoldTimers();
            const durationMs = Math.max(0.5, Number(step.durationSec) || 3) * 1000;
            const startTime = Date.now();
            this.holdControlId = controlId;

            const baseMsg = step.holdingMessage || `🚄 [按住中] 持續按壓中，請勿放開！`;
            this._emitStatus(`${baseMsg} (${(durationMs / 1000).toFixed(1)}s)`, 'info');
            this._emitHoldProgress(0.02, controlId);

            this.holdInterval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const ratio = Math.min(1, elapsed / durationMs);
                const remain = Math.max(0, (durationMs - elapsed) / 1000).toFixed(1);
                this._emitHoldProgress(ratio, controlId);
                this._emitStatus(`${baseMsg} (剩餘 ${remain} 秒)`, 'info');
            }, 60);

            this.holdTimer = setTimeout(() => {
                this._clearHoldTimers();
                this._emitHoldProgress(0, null);
                this._completeCurrentStep();
            }, durationMs);
        }

        /** 完成目前步驟，套用燈號變化並推進到下一步 */
        _completeCurrentStep() {
            const step = this.getCurrentStep();
            if (!step) return;

            // 套用此步驟完成後的燈號連動變化
            if (step.lightChanges) {
                Object.entries(step.lightChanges).forEach(([lightId, state]) => {
                    if (LIGHT_MAP[lightId] && (state === 'on' || state === 'off' || state === 'blink')) {
                        this.lights[lightId] = state;
                    }
                });
            }

            this.currentStepIndex += 1;
            const isAllDone = this.currentStepIndex >= this.activeScenario.steps.length;
            if (isAllDone) {
                this.completed = true;
            }

            AudioFX.playSuccess();
            this._emitRender();
            this._emitProgress();

            if (isAllDone) {
                const finalMsg = step.successMessage || this.activeScenario.successMessage || '✅ [操作成功] 全部 SOP 步驟已完成！';
                this._emitStatus(finalMsg, 'success');
            } else {
                const msg = step.successMessage || `✅ [步驟 ${this.currentStepIndex} 正確] 請進行下一步。`;
                this._emitStatus(msg, 'success');
            }
        }

        /** 自由操作模式下的直覺硬體回饋 */
        _applyFreeModeBehavior(controlId, val) {
            if (controlId === 'sel_pos_1') {
                this.lights['pos_1_active'] = val;
            } else if (controlId === 'sel_pos_2') {
                this.lights['pos_2_active'] = val;
            } else if (controlId === 'knob_cmd_1' || controlId === 'knob_cmd_2') {
                if (this.controls['key_mode'] === 'on') {
                    const bothOpen = this.controls['knob_cmd_1'] === 'on' && this.controls['knob_cmd_2'] === 'on';
                    this.lights['fully_open'] = bothOpen ? 'on' : 'off';
                    this.lights['all_asd_close'] = bothOpen ? 'off' : 'on';
                    for (let i = 1; i <= 8; i++) {
                        this.lights[`door_${i}_close`] = bothOpen ? 'off' : 'on';
                    }
                }
            }
        }

        _clearHoldTimers() {
            if (this.holdTimer) {
                clearTimeout(this.holdTimer);
                this.holdTimer = null;
            }
            if (this.holdInterval) {
                clearInterval(this.holdInterval);
                this.holdInterval = null;
            }
            this.holdControlId = null;
        }

        _clearTimers() {
            this._clearHoldTimers();
            if (this.lampTestTimer) {
                clearTimeout(this.lampTestTimer);
                this.lampTestTimer = null;
            }
            AudioFX.stopBuzzer();
        }

        _emitRender() {
            if (this.callbacks.onRender) {
                this.callbacks.onRender({
                    lights: this.lights,
                    controls: this.controls,
                    lampTestActive: this.lampTestActive
                });
            }
        }

        _emitStatus(message, level) {
            if (this.callbacks.onStatus) {
                this.callbacks.onStatus(message, level);
            }
        }

        _emitProgress() {
            if (this.callbacks.onProgress) {
                const total = this.activeScenario ? this.activeScenario.steps.length : 0;
                this.callbacks.onProgress({
                    active: !!this.activeScenario,
                    completed: this.completed,
                    current: this.currentStepIndex,
                    total: total,
                    currentStep: this.getCurrentStep()
                });
            }
        }

        _emitHoldProgress(ratio, controlId) {
            if (this.callbacks.onHoldProgress) {
                this.callbacks.onHoldProgress(ratio, controlId);
            }
        }
    }

    return Engine;
})();

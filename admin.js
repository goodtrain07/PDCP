/**
 * 文湖線月台門訓練機 (PDCP) — 教官後台管理介面 (免寫程式視覺化編輯器)
 */

window.PDCPAdmin = (function () {
    const { LIGHTS, CONTROLS, LIGHT_MAP, CONTROL_MAP } = window.PDCP_COMPONENTS;

    const TOGGLE_CONTROLS = CONTROLS.filter(c => c.kind === 'toggle');
    const ACTION_CONTROLS = CONTROLS.filter(c => c.kind === 'momentary' || c.kind === 'lamp_test');
    const HOLD_CONTROLS = CONTROLS.filter(c => c.kind === 'momentary');

    function uid(prefix = 'id') {
        return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    }

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function buildGroupedControlOptions(list, selectedId) {
        const groups = {};
        list.forEach(c => {
            if (!groups[c.group]) groups[c.group] = [];
            groups[c.group].push(c);
        });
        return Object.entries(groups).map(([groupName, items]) => {
            const opts = items.map(c =>
                `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
            ).join('');
            return `<optgroup label="${escapeHtml(groupName)}">${opts}</optgroup>`;
        }).join('');
    }

    function buildGroupedLightOptions(selectedId) {
        const groups = {};
        LIGHTS.forEach(l => {
            if (!groups[l.group]) groups[l.group] = [];
            groups[l.group].push(l);
        });
        return Object.entries(groups).map(([groupName, items]) => {
            const opts = items.map(l =>
                `<option value="${l.id}" ${l.id === selectedId ? 'selected' : ''}>${escapeHtml(l.name)}</option>`
            ).join('');
            return `<optgroup label="${escapeHtml(groupName)}">${opts}</optgroup>`;
        }).join('');
    }

    class AdminController {
        constructor(options) {
            this.modalEl = options.modalEl;
            this.listEl = options.listEl;
            this.editorEl = options.editorEl;
            this.toastEl = options.toastEl;
            this.getScenarios = options.getScenarios;
            this.saveScenarios = options.saveScenarios;
            this.resetToDefault = options.resetToDefault;
            this.onTestScenario = options.onTestScenario;

            this.draftScenarios = [];
            this.selectedIndex = 0;
        }

        open() {
            this.draftScenarios = JSON.parse(JSON.stringify(this.getScenarios() || []));
            if (this.selectedIndex >= this.draftScenarios.length) {
                this.selectedIndex = Math.max(0, this.draftScenarios.length - 1);
            }
            this.modalEl.classList.add('open');
            this.render();
        }

        close() {
            this.modalEl.classList.remove('open');
        }

        showToast(msg, isError = false) {
            if (!this.toastEl) return;
            this.toastEl.textContent = msg;
            this.toastEl.className = `admin-toast show ${isError ? 'error' : ''}`;
            clearTimeout(this._toastTimer);
            this._toastTimer = setTimeout(() => {
                this.toastEl.classList.remove('show');
            }, 2600);
        }

        render() {
            this.renderList();
            this.renderEditor();
        }

        renderList() {
            if (this.draftScenarios.length === 0) {
                this.listEl.innerHTML = `<div class="admin-empty">尚無任何劇本，請點擊上方「＋ 新增劇本」。</div>`;
                return;
            }
            this.listEl.innerHTML = this.draftScenarios.map((sc, idx) => `
                <div class="scenario-item ${idx === this.selectedIndex ? 'active' : ''}" data-idx="${idx}">
                    <div class="scenario-item-title">${escapeHtml(sc.title || '未命名劇本')}</div>
                    <div class="scenario-item-meta">${(sc.steps || []).length} 個步驟</div>
                    <div class="scenario-item-actions">
                        <button type="button" class="mini-btn" data-act="up" data-idx="${idx}" title="上移" ${idx === 0 ? 'disabled' : ''}>▲</button>
                        <button type="button" class="mini-btn" data-act="down" data-idx="${idx}" title="下移" ${idx === this.draftScenarios.length - 1 ? 'disabled' : ''}>▼</button>
                        <button type="button" class="mini-btn" data-act="dup" data-idx="${idx}" title="複製">複製</button>
                        <button type="button" class="mini-btn danger" data-act="del" data-idx="${idx}" title="刪除">刪除</button>
                    </div>
                </div>
            `).join('');

            this.listEl.querySelectorAll('.scenario-item').forEach(el => {
                el.addEventListener('click', (e) => {
                    if (e.target.closest('button')) return;
                    this.selectedIndex = Number(el.dataset.idx);
                    this.render();
                });
            });

            this.listEl.querySelectorAll('button[data-act]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = Number(btn.dataset.idx);
                    const act = btn.dataset.act;
                    if (act === 'up' && idx > 0) {
                        [this.draftScenarios[idx - 1], this.draftScenarios[idx]] = [this.draftScenarios[idx], this.draftScenarios[idx - 1]];
                        this.selectedIndex = idx - 1;
                        this.render();
                    } else if (act === 'down' && idx < this.draftScenarios.length - 1) {
                        [this.draftScenarios[idx + 1], this.draftScenarios[idx]] = [this.draftScenarios[idx], this.draftScenarios[idx + 1]];
                        this.selectedIndex = idx + 1;
                        this.render();
                    } else if (act === 'dup') {
                        const copy = JSON.parse(JSON.stringify(this.draftScenarios[idx]));
                        copy.id = uid('sc');
                        copy.title = `${copy.title} (複製)`;
                        this.draftScenarios.splice(idx + 1, 0, copy);
                        this.selectedIndex = idx + 1;
                        this.render();
                        this.showToast('已複製劇本，記得按「儲存變更」生效');
                    } else if (act === 'del') {
                        if (!confirm(`確定要刪除劇本「${this.draftScenarios[idx].title}」嗎？`)) return;
                        this.draftScenarios.splice(idx, 1);
                        this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.draftScenarios.length - 1));
                        this.render();
                        this.showToast('已刪除劇本');
                    }
                });
            });

            // 自動將目前選取的劇本卡片捲動至可視範圍
            const activeItem = this.listEl.querySelector('.scenario-item.active');
            if (activeItem && typeof activeItem.scrollIntoView === 'function') {
                activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
            }
        }

        addScenario() {
            const num = this.draftScenarios.length + 1;
            this.draftScenarios.push({
                id: uid('sc'),
                title: `操作 ${num}：新模擬狀況`,
                description: `⚠️ [操作 ${num}] 發生突發狀況，請依 SOP 排除！`,
                successMessage: '✅ [操作成功] 已完成處置！請復原系統。',
                initialLights: {},
                steps: [
                    {
                        id: uid('st'),
                        title: '步驟 1：切換鑰匙至手動 (MANUAL)',
                        type: 'state_match',
                        conditions: [{ controlId: 'key_mode', value: 'on' }],
                        successMessage: '🔧 [步驟 1 正確] 鑰匙已切換至手動。',
                        wrongActionHint: '❌ [錯誤] 請先將鑰匙切換至手動 (MANUAL)！',
                        lightChanges: {}
                    }
                ]
            });
            this.selectedIndex = this.draftScenarios.length - 1;
            this.render();
            this.showToast('已新增空白劇本');
        }

        renderEditor() {
            const sc = this.draftScenarios[this.selectedIndex];
            if (!sc) {
                this.editorEl.innerHTML = `<div class="admin-empty">請先新增或從左側選擇一個劇本進行編輯。</div>`;
                return;
            }

            if (!sc.initialLights) sc.initialLights = {};
            if (!Array.isArray(sc.steps)) sc.steps = [];

            // 初始燈號分組渲染
            const lightGroups = {};
            LIGHTS.forEach(l => {
                if (!lightGroups[l.group]) lightGroups[l.group] = [];
                lightGroups[l.group].push(l);
            });

            const initialLightsHtml = Object.entries(lightGroups).map(([groupName, items]) => `
                <div class="light-group">
                    <div class="light-group-title">${escapeHtml(groupName)}</div>
                    <div class="light-grid">
                        ${items.map(l => {
                            const override = sc.initialLights[l.id] || 'default';
                            const effective = override === 'default' ? l.defaultState : override;
                            return `
                                <div class="light-chip state-${effective} ${override !== 'default' ? 'modified' : ''}" data-light-id="${l.id}">
                                    <span class="chip-dot color-${l.color} state-${effective}"></span>
                                    <span class="chip-name">${escapeHtml(l.name.replace(/\s*\(.*?\)/g, ''))}</span>
                                    <select class="chip-select" data-init-light="${l.id}">
                                        <option value="default" ${override === 'default' ? 'selected' : ''}>預設 (${l.defaultState === 'on' ? '亮' : '滅'})</option>
                                        <option value="on" ${override === 'on' ? 'selected' : ''}>恆亮</option>
                                        <option value="off" ${override === 'off' ? 'selected' : ''}>熄滅</option>
                                        <option value="blink" ${override === 'blink' ? 'selected' : ''}>閃爍</option>
                                    </select>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `).join('');

            // SOP 步驟清單渲染
            const stepsHtml = sc.steps.map((step, sIdx) => this._renderStepCard(step, sIdx, sc.steps.length)).join('');

            this.editorEl.innerHTML = `
                <div class="editor-section">
                    <div class="section-header">
                        <h3>1. 劇本基本資訊</h3>
                        <button type="button" class="btn-admin primary" id="btn-test-current">▶ 儲存並立即試玩此劇本</button>
                    </div>
                    <div class="form-row">
                        <label>劇本名稱（顯示在下拉選單）</label>
                        <input type="text" id="ed-title" value="${escapeHtml(sc.title)}" placeholder="例如：操作 5：4號門阻塞故障">
                    </div>
                    <div class="form-row">
                        <label>狀況觸發時提示訊息（頂部狀態列）</label>
                        <input type="text" id="ed-desc" value="${escapeHtml(sc.description)}" placeholder="例如：⚠️ 4號月台門阻塞紅燈亮起，請依 SOP 處理！">
                    </div>
                    <div class="form-row">
                        <label>全部步驟完成時提示訊息</label>
                        <input type="text" id="ed-success" value="${escapeHtml(sc.successMessage)}" placeholder="例如：✅ 操作成功！">
                    </div>
                </div>

                <div class="editor-section">
                    <div class="section-header">
                        <h3>2. 狀況發生時的「初始面板燈號」</h3>
                        <button type="button" class="mini-btn" id="btn-clear-init-lights">全部恢復預設</button>
                    </div>
                    <p class="section-hint">只須更改與正常狀態不同的燈號（例如某號門閉鎖燈設為「熄滅」、故障紅燈設為「閃爍」）。</p>
                    ${initialLightsHtml}
                </div>

                <div class="editor-section">
                    <div class="section-header">
                        <h3>3. SOP 操作步驟清單（由上而下依序執行）</h3>
                        <button type="button" class="btn-admin success" id="btn-add-step">＋ 新增步驟</button>
                    </div>
                    <div class="steps-container" id="steps-container">
                        ${stepsHtml || '<div class="admin-empty">目前沒有步驟，請點擊「＋ 新增步驟」。</div>'}
                    </div>
                </div>
            `;

            this._bindEditorEvents(sc);
        }

        _renderStepCard(step, sIdx, total) {
            const type = step.type || 'state_match';
            let configHtml = '';

            if (type === 'state_match') {
                const conditions = Array.isArray(step.conditions) && step.conditions.length > 0
                    ? step.conditions
                    : [{ controlId: 'key_mode', value: 'on' }];
                step.conditions = conditions;

                configHtml = `
                    <div class="sub-block">
                        <div class="sub-block-header">
                            <span>需要達成的開關 / 旋鈕條件（若設多個，代表須同時到位、不限先後順序）</span>
                            <button type="button" class="mini-btn" data-step-act="add-cond" data-sidx="${sIdx}">＋ 新增條件</button>
                        </div>
                        ${conditions.map((cond, cIdx) => {
                            const ctrl = CONTROL_MAP[cond.controlId] || TOGGLE_CONTROLS[0];
                            return `
                                <div class="cond-row">
                                    <select class="cond-ctrl" data-sidx="${sIdx}" data-cidx="${cIdx}">
                                        ${buildGroupedControlOptions(TOGGLE_CONTROLS, cond.controlId)}
                                    </select>
                                    <span class="arrow">→</span>
                                    <select class="cond-val" data-sidx="${sIdx}" data-cidx="${cIdx}">
                                        <option value="on" ${cond.value === 'on' ? 'selected' : ''}>${escapeHtml(ctrl.onLabel || 'ON')}</option>
                                        <option value="off" ${cond.value === 'off' ? 'selected' : ''}>${escapeHtml(ctrl.offLabel || 'OFF')}</option>
                                    </select>
                                    ${conditions.length > 1 ? `<button type="button" class="mini-btn danger" data-step-act="del-cond" data-sidx="${sIdx}" data-cidx="${cIdx}">✕</button>` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            } else if (type === 'action') {
                const ctrlId = step.controlId || 'lamp_test';
                step.controlId = ctrlId;
                configHtml = `
                    <div class="sub-block">
                        <div class="form-row inline">
                            <label>目標按鈕 / 測試鈕</label>
                            <select class="step-ctrl" data-sidx="${sIdx}">
                                ${buildGroupedControlOptions(ACTION_CONTROLS, ctrlId)}
                            </select>
                        </div>
                    </div>
                `;
            } else if (type === 'hold') {
                const ctrlId = step.controlId || 'sd_bypass_btn';
                step.controlId = ctrlId;
                const dur = Number(step.durationSec) || 3;
                configHtml = `
                    <div class="sub-block">
                        <div class="form-grid-2">
                            <div class="form-row">
                                <label>長按目標按鈕</label>
                                <select class="step-ctrl" data-sidx="${sIdx}">
                                    ${buildGroupedControlOptions(HOLD_CONTROLS, ctrlId)}
                                </select>
                            </div>
                            <div class="form-row">
                                <label>需要持續按壓秒數 (秒)</label>
                                <input type="number" min="1" max="15" step="0.5" class="step-dur" data-sidx="${sIdx}" value="${dur}">
                            </div>
                        </div>
                        <div class="form-row">
                            <label>按住期間提示訊息</label>
                            <input type="text" class="step-hold-msg" data-sidx="${sIdx}" value="${escapeHtml(step.holdingMessage || '')}" placeholder="例如：🚄 持續按壓中... 列車離站中 (請勿放開！)">
                        </div>
                        <div class="form-row">
                            <label>提早放開失敗訊息</label>
                            <input type="text" class="step-early-msg" data-sidx="${sIdx}" value="${escapeHtml(step.releaseEarlyMessage || '')}" placeholder="例如：❌ 未滿指定秒數即放開！列車急停。">
                        </div>
                    </div>
                `;
            }

            // 此步驟完成後的燈號連動
            const lightChanges = step.lightChanges || {};
            const changeEntries = Object.entries(lightChanges);

            return `
                <div class="step-card" data-sidx="${sIdx}">
                    <div class="step-card-header">
                        <span class="step-badge">步驟 ${sIdx + 1}</span>
                        <input type="text" class="step-title-input" data-sidx="${sIdx}" value="${escapeHtml(step.title || '')}" placeholder="步驟名稱（用於練習提示）">
                        <div class="step-header-btns">
                            <button type="button" class="mini-btn" data-step-act="up" data-sidx="${sIdx}" ${sIdx === 0 ? 'disabled' : ''}>▲</button>
                            <button type="button" class="mini-btn" data-step-act="down" data-sidx="${sIdx}" ${sIdx === total - 1 ? 'disabled' : ''}>▼</button>
                            <button type="button" class="mini-btn danger" data-step-act="del" data-sidx="${sIdx}">刪除</button>
                        </div>
                    </div>

                    <div class="step-card-body">
                        <div class="form-row inline">
                            <label>操作類型</label>
                            <select class="step-type-select" data-sidx="${sIdx}">
                                <option value="state_match" ${type === 'state_match' ? 'selected' : ''}>旋鈕 / 鑰匙切換到位（支援單一或同時多個）</option>
                                <option value="action" ${type === 'action' ? 'selected' : ''}>單次按壓按鈕 / 執行 Lamp Test</option>
                                <option value="hold" ${type === 'hold' ? 'selected' : ''}>持續長按按鈕 N 秒（如 Bypass 離站）</option>
                            </select>
                        </div>

                        ${configHtml}

                        <div class="form-grid-2">
                            <div class="form-row">
                                <label>完成本步驟時顯示的提示</label>
                                <input type="text" class="step-ok-msg" data-sidx="${sIdx}" value="${escapeHtml(step.successMessage || '')}" placeholder="例如：✅ 步驟完成，請進行下一步">
                            </div>
                            <div class="form-row">
                                <label>操作錯誤時的提醒訊息</label>
                                <input type="text" class="step-err-msg" data-sidx="${sIdx}" value="${escapeHtml(step.wrongActionHint || '')}" placeholder="例如：❌ 請先完成此步驟再進行其他操作">
                            </div>
                        </div>

                        <div class="sub-block">
                            <div class="sub-block-header">
                                <span>完成本步驟後的燈號連動（選填）</span>
                                <div>
                                    <button type="button" class="mini-btn" data-step-act="preset-open" data-sidx="${sIdx}" title="套用全門開啟燈號">快捷：全門開啟</button>
                                    <button type="button" class="mini-btn" data-step-act="preset-close" data-sidx="${sIdx}" title="套用全門閉鎖燈號">快捷：全門閉鎖</button>
                                    <button type="button" class="mini-btn" data-step-act="add-light" data-sidx="${sIdx}">＋ 新增燈號變化</button>
                                </div>
                            </div>
                            ${changeEntries.length === 0 ? '<div class="muted-text">無（燈號維持原樣）</div>' : changeEntries.map(([lid, lstate]) => `
                                <div class="cond-row">
                                    <select class="lc-light" data-sidx="${sIdx}" data-old-lid="${lid}">
                                        ${buildGroupedLightOptions(lid)}
                                    </select>
                                    <span class="arrow">→</span>
                                    <select class="lc-state" data-sidx="${sIdx}" data-lid="${lid}">
                                        <option value="on" ${lstate === 'on' ? 'selected' : ''}>恆亮</option>
                                        <option value="off" ${lstate === 'off' ? 'selected' : ''}>熄滅</option>
                                        <option value="blink" ${lstate === 'blink' ? 'selected' : ''}>閃爍</option>
                                    </select>
                                    <button type="button" class="mini-btn danger" data-step-act="del-light" data-sidx="${sIdx}" data-lid="${lid}">✕</button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }

        _bindEditorEvents(sc) {
            const titleInput = this.editorEl.querySelector('#ed-title');
            titleInput.addEventListener('input', () => {
                sc.title = titleInput.value;
                const activeTitle = this.listEl.querySelector(`.scenario-item[data-idx="${this.selectedIndex}"] .scenario-item-title`);
                if (activeTitle) activeTitle.textContent = sc.title || '未命名劇本';
            });

            this.editorEl.querySelector('#ed-desc').addEventListener('input', e => {
                sc.description = e.target.value;
            });
            this.editorEl.querySelector('#ed-success').addEventListener('input', e => {
                sc.successMessage = e.target.value;
            });

            // 初始燈號變更
            this.editorEl.querySelectorAll('select[data-init-light]').forEach(sel => {
                sel.addEventListener('change', () => {
                    const lid = sel.dataset.initLight;
                    if (sel.value === 'default') {
                        delete sc.initialLights[lid];
                    } else {
                        sc.initialLights[lid] = sel.value;
                    }
                    this.renderEditor();
                });
            });

            this.editorEl.querySelector('#btn-clear-init-lights').addEventListener('click', () => {
                sc.initialLights = {};
                this.renderEditor();
            });

            // 儲存並立即試玩
            this.editorEl.querySelector('#btn-test-current').addEventListener('click', () => {
                this.commitSave();
                this.close();
                if (this.onTestScenario) {
                    this.onTestScenario(sc.id);
                }
            });

            // 新增步驟
            this.editorEl.querySelector('#btn-add-step').addEventListener('click', () => {
                const n = sc.steps.length + 1;
                sc.steps.push({
                    id: uid('st'),
                    title: `步驟 ${n}：請輸入步驟說明`,
                    type: 'state_match',
                    conditions: [{ controlId: 'key_mode', value: 'on' }],
                    successMessage: `✅ [步驟 ${n} 正確] 請進行下一步。`,
                    wrongActionHint: `❌ [錯誤] 請先完成步驟 ${n}！`,
                    lightChanges: {}
                });
                this.render();
            });

            // 步驟標題、類型、訊息輸入
            this.editorEl.querySelectorAll('.step-title-input').forEach(inp => {
                inp.addEventListener('input', () => {
                    sc.steps[Number(inp.dataset.sidx)].title = inp.value;
                });
            });

            this.editorEl.querySelectorAll('.step-type-select').forEach(sel => {
                sel.addEventListener('change', () => {
                    const st = sc.steps[Number(sel.dataset.sidx)];
                    st.type = sel.value;
                    if (st.type === 'state_match') {
                        st.conditions = st.conditions && st.conditions.length ? st.conditions : [{ controlId: 'key_mode', value: 'on' }];
                    } else if (st.type === 'action') {
                        st.controlId = ACTION_CONTROLS.some(c => c.id === st.controlId) ? st.controlId : 'lamp_test';
                    } else if (st.type === 'hold') {
                        st.controlId = HOLD_CONTROLS.some(c => c.id === st.controlId) ? st.controlId : 'sd_bypass_btn';
                        st.durationSec = st.durationSec || 3;
                    }
                    this.renderEditor();
                });
            });

            this.editorEl.querySelectorAll('.cond-ctrl').forEach(sel => {
                sel.addEventListener('change', () => {
                    const st = sc.steps[Number(sel.dataset.sidx)];
                    st.conditions[Number(sel.dataset.cidx)].controlId = sel.value;
                    this.renderEditor();
                });
            });

            this.editorEl.querySelectorAll('.cond-val').forEach(sel => {
                sel.addEventListener('change', () => {
                    const st = sc.steps[Number(sel.dataset.sidx)];
                    st.conditions[Number(sel.dataset.cidx)].value = sel.value;
                });
            });

            this.editorEl.querySelectorAll('.step-ctrl').forEach(sel => {
                sel.addEventListener('change', () => {
                    sc.steps[Number(sel.dataset.sidx)].controlId = sel.value;
                });
            });

            this.editorEl.querySelectorAll('.step-dur').forEach(inp => {
                inp.addEventListener('input', () => {
                    sc.steps[Number(inp.dataset.sidx)].durationSec = Math.max(0.5, Number(inp.value) || 3);
                });
            });

            this.editorEl.querySelectorAll('.step-hold-msg').forEach(inp => {
                inp.addEventListener('input', () => {
                    sc.steps[Number(inp.dataset.sidx)].holdingMessage = inp.value;
                });
            });

            this.editorEl.querySelectorAll('.step-early-msg').forEach(inp => {
                inp.addEventListener('input', () => {
                    sc.steps[Number(inp.dataset.sidx)].releaseEarlyMessage = inp.value;
                });
            });

            this.editorEl.querySelectorAll('.step-ok-msg').forEach(inp => {
                inp.addEventListener('input', () => {
                    sc.steps[Number(inp.dataset.sidx)].successMessage = inp.value;
                });
            });

            this.editorEl.querySelectorAll('.step-err-msg').forEach(inp => {
                inp.addEventListener('input', () => {
                    sc.steps[Number(inp.dataset.sidx)].wrongActionHint = inp.value;
                });
            });

            // 燈號連動下拉
            this.editorEl.querySelectorAll('.lc-light').forEach(sel => {
                sel.addEventListener('change', () => {
                    const st = sc.steps[Number(sel.dataset.sidx)];
                    const oldId = sel.dataset.oldLid;
                    const newId = sel.value;
                    const val = st.lightChanges[oldId] || 'on';
                    delete st.lightChanges[oldId];
                    st.lightChanges[newId] = val;
                    this.renderEditor();
                });
            });

            this.editorEl.querySelectorAll('.lc-state').forEach(sel => {
                sel.addEventListener('change', () => {
                    const st = sc.steps[Number(sel.dataset.sidx)];
                    st.lightChanges[sel.dataset.lid] = sel.value;
                });
            });

            // 步驟操作按鈕
            this.editorEl.querySelectorAll('button[data-step-act]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const sIdx = Number(btn.dataset.sidx);
                    const act = btn.dataset.stepAct;
                    const st = sc.steps[sIdx];

                    if (act === 'up' && sIdx > 0) {
                        [sc.steps[sIdx - 1], sc.steps[sIdx]] = [sc.steps[sIdx], sc.steps[sIdx - 1]];
                        this.renderEditor();
                    } else if (act === 'down' && sIdx < sc.steps.length - 1) {
                        [sc.steps[sIdx + 1], sc.steps[sIdx]] = [sc.steps[sIdx], sc.steps[sIdx + 1]];
                        this.renderEditor();
                    } else if (act === 'del') {
                        sc.steps.splice(sIdx, 1);
                        this.render();
                    } else if (act === 'add-cond') {
                        st.conditions.push({ controlId: 'knob_cmd_1', value: 'on' });
                        this.renderEditor();
                    } else if (act === 'del-cond') {
                        st.conditions.splice(Number(btn.dataset.cidx), 1);
                        this.renderEditor();
                    } else if (act === 'add-light') {
                        if (!st.lightChanges) st.lightChanges = {};
                        const unused = LIGHTS.find(l => !(l.id in st.lightChanges));
                        st.lightChanges[unused ? unused.id : 'fully_open'] = 'on';
                        this.renderEditor();
                    } else if (act === 'del-light') {
                        delete st.lightChanges[btn.dataset.lid];
                        this.renderEditor();
                    } else if (act === 'preset-open') {
                        st.lightChanges = {
                            ...(st.lightChanges || {}),
                            door_1_close: 'off', door_2_close: 'off', door_3_close: 'off', door_4_close: 'off',
                            door_5_close: 'off', door_6_close: 'off', door_7_close: 'off', door_8_close: 'off',
                            all_asd_close: 'off', fully_open: 'on'
                        };
                        this.renderEditor();
                    } else if (act === 'preset-close') {
                        st.lightChanges = {
                            ...(st.lightChanges || {}),
                            door_1_close: 'on', door_2_close: 'on', door_3_close: 'on', door_4_close: 'on',
                            door_5_close: 'on', door_6_close: 'on', door_7_close: 'on', door_8_close: 'on',
                            all_asd_close: 'on', fully_open: 'off', open_indicator: 'off'
                        };
                        this.renderEditor();
                    }
                });
            });
        }

        commitSave() {
            this.saveScenarios(JSON.parse(JSON.stringify(this.draftScenarios)));
            this.showToast('✅ 劇本已儲存並套用至模擬器！');
        }

        exportJson() {
            this.commitSave();
            const json = JSON.stringify(this.draftScenarios, null, 2);
            const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'scenarios.json';
            a.click();
            URL.revokeObjectURL(url);
            this.showToast('📥 已下載 scenarios.json！覆蓋上傳至 web 資料夾即可全網更新。');
        }

        importJsonFile(file) {
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const parsed = JSON.parse(reader.result);
                    if (!Array.isArray(parsed)) {
                        throw new Error('JSON 格式須為劇本陣列');
                    }
                    this.draftScenarios = parsed;
                    this.selectedIndex = 0;
                    this.commitSave();
                    this.render();
                    this.showToast(`✅ 成功匯入 ${parsed.length} 個劇本！`);
                } catch (err) {
                    this.showToast(`❌ 匯入失敗：${err.message}`, true);
                }
            };
            reader.readAsText(file, 'utf-8');
        }

        async handleResetDefault() {
            if (!confirm('確定要還原為網站預設題庫嗎？您在本機後台尚未匯出的修改將會被清除。')) return;
            const restored = await this.resetToDefault();
            this.draftScenarios = JSON.parse(JSON.stringify(restored));
            this.selectedIndex = 0;
            this.render();
            this.showToast('🔄 已還原為網站預設題庫！');
        }
    }

    return AdminController;
})();

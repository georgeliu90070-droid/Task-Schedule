const 取元素 = (選擇器) => document.querySelector(選擇器);
const 全部元素 = (選擇器) => document.querySelectorAll(選擇器);
// 本機保留快取，雲端則依自動建立的訪客身分分開保存。
const 儲存鍵 = '日子生活管理資料';
let 本機儲存鍵 = 儲存鍵;
let 訪客識別碼 = null;
let 雲端服務 = null;
let 雲端就緒 = false;
let 啟動中 = false;
let 同步中 = false;
const 待同步 = { tasks: new Set(), transactions: new Set(), notes: new Set(), expenseCategories: new Set() };
let 上次本機資料 = { tasks: [], transactions: [], notes: [], expenseCategories: [] };
let 問卷處理中 = false;
let 待送問卷 = null;
// 只填入專案網址與可公開金鑰，絕對不可填入服務角色或秘密金鑰。
const 專案網址 = 'https://iynajzpflrmkcciebtam.supabase.co';
const 公開金鑰 = 'sb_publishable__16ssp4F-NNdqQKyxkfZ4g_PqTNANQk';
// 左邊沿用畫面既有欄位，右邊對應資料庫的繁體中文欄位。
const 雲端資料表 = {
  tasks: { 名稱: '待辦事項', 欄位: { id: '識別碼', title: '名稱', date: '日期', category: '分類', priority: '優先程度', done: '已完成' } },
  transactions: { 名稱: '收支紀錄', 欄位: { id: '識別碼', title: '名稱', date: '日期', type: '類型', amount: '金額', category: '分類' } },
  notes: { 名稱: '隨手筆記', 欄位: { id: '識別碼', title: '名稱', content: '內容', updated: '更新時間' } },
  expenseCategories: { 名稱: '支出分類' }
};
const 今天 = new Date();
const 日期字串 = (日期 = new Date()) => `${日期.getFullYear()}-${String(日期.getMonth() + 1).padStart(2, '0')}-${String(日期.getDate()).padStart(2, '0')}`;
const 金額文字 = (金額) => `${金額 < 0 ? '−' : ''}$${Math.abs(金額).toLocaleString('zh-TW', { maximumFractionDigits: 2 })}`;
// 使用文字節點處理使用者內容，避免筆記被當成網頁程式執行。
const 安全文字 = (文字) => { const 容器 = document.createElement('span'); 容器.textContent = 文字; return 容器.innerHTML; };
const 新識別碼 = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
let 資料 = { tasks: [], transactions: [], notes: [], expenseCategories: [] };
let 目前頁面 = '總覽';
let 待辦篩選 = 'pending';
let 選擇月份 = new Date(今天.getFullYear(), 今天.getMonth(), 1);
let 行事曆月份 = new Date(今天.getFullYear(), 今天.getMonth(), 1);
let 行事曆日期 = 日期字串();
let 行事曆分類 = '全部';
let 表單類型 = 'task';
let 編輯識別碼 = null;
let 提示計時;
const 分類資料 = {
  '餐飲': { color: '#15243c', icon: '♨' },
  '交通': { color: '#61718a', icon: '↔' },
  '購物': { color: '#ed703e', icon: '▱' },
  '生活': { color: '#f3ba9e', icon: '⌂' },
  '娛樂': { color: '#909aa9', icon: '♫' },
  '其他': { color: '#d9dde3', icon: '⋯' }
};

// 自訂分類只儲存名稱，圖表顏色統一由程式分配。
function 取得支出分類(自訂分類 = 資料.expenseCategories) {
  return [...new Set([...Object.keys(分類資料), ...自訂分類])];
}

function 取得分類樣式() {
  const 色票 = ['#ed703e', '#15243c', '#61718a', '#f3ba9e', '#909aa9', '#b64f27'];
  return { ...分類資料, ...Object.fromEntries(資料.expenseCategories.map((名稱, 位置) => [名稱, { color: 色票[位置 % 色票.length], icon: '◇' }])) };
}

function 新增支出分類(名稱) {
  名稱 = 名稱.trim();
  if (!名稱 || 名稱.length > 20 || /[\u0000-\u001f\u007f]/.test(名稱)) throw new Error('請輸入一至二十字的分類名稱。');
  if (取得支出分類().includes(名稱)) throw new Error('這個分類已經存在，請直接從分類選單選取。');
  if (資料.expenseCategories.length >= 100) throw new Error('自訂分類已達一百種，請使用現有分類。');
  資料.expenseCategories.push(名稱);
  儲存();
  return 名稱;
}

function 提示(訊息) {
  clearTimeout(提示計時);
  取元素('#toast').textContent = 訊息;
  取元素('#toast').classList.add('visible');
  提示計時 = setTimeout(() => 取元素('#toast').classList.remove('visible'), 3200);
}

function 設定同步狀態(文字, 可重試 = false) {
  取元素('#sync-message').textContent = 文字;
  取元素('#sync-retry').hidden = !可重試;
  全部元素('[data-sync-label]').forEach((元素) => { 元素.textContent = 文字; });
}

function 保存本機快取() {
  try {
    const 佇列 = Object.fromEntries(Object.entries(待同步).map(([鍵, 清單]) => [鍵, [...清單]]));
    localStorage.setItem(本機儲存鍵, JSON.stringify({ ...資料, 待同步: 佇列 }));
  } catch { 提示('瀏覽器無法儲存備份，請先匯出以保留紀錄。'); }
  上次本機資料 = JSON.parse(JSON.stringify(資料));
}

function 儲存() {
  // 只標記新增或修改的紀錄，避免把未修改的舊資料覆蓋到雲端。
  Object.keys(待同步).forEach((鍵) => {
    const 舊紀錄 = new Map(上次本機資料[鍵].map((項目) => [鍵 === 'expenseCategories' ? 項目 : 項目.id, JSON.stringify(項目)]));
    資料[鍵].forEach((項目) => {
      const 識別碼 = 鍵 === 'expenseCategories' ? 項目 : 項目.id;
      if (舊紀錄.get(識別碼) !== JSON.stringify(項目)) 待同步[鍵].add(識別碼);
    });
  });
  保存本機快取();
  更新畫面();
  if (雲端就緒) 同步生活資料();
  else 設定同步狀態('已保存在本機，等待雲端連線', true);
}

function 轉換雲端紀錄(鍵, 紀錄) {
  if (鍵 === 'expenseCategories') return { 使用者識別碼: 訪客識別碼, 名稱: 紀錄 };
  return { 使用者識別碼: 訪客識別碼, ...Object.fromEntries(Object.entries(雲端資料表[鍵].欄位).map(([本機欄位, 雲端欄位]) => [雲端欄位, 本機欄位 === 'date' && !紀錄[本機欄位] ? null : 紀錄[本機欄位]])) };
}

async function 讀取雲端清單(鍵) {
  const 結果 = [];
  // 分頁讀取，避免超過伺服器單次筆數上限後漏掉舊紀錄。
  for (let 起點 = 0; ; 起點 += 500) {
    const 排序欄位 = 鍵 === 'expenseCategories' ? '名稱' : '識別碼';
    const { data, error } = await 雲端服務.from(雲端資料表[鍵].名稱).select('*').eq('使用者識別碼', 訪客識別碼).order(排序欄位).range(起點, 起點 + 499);
    if (error) throw error;
    結果.push(...data);
    if (data.length < 500) break;
  }
  return 結果.map((紀錄) => 鍵 === 'expenseCategories' ? 紀錄.名稱 : Object.fromEntries(Object.entries(雲端資料表[鍵].欄位).map(([本機欄位, 雲端欄位]) => [本機欄位, 紀錄[雲端欄位] ?? ''])));
}

function 雲端錯誤文字(錯誤) {
  if (錯誤?.code === 'anonymous_provider_disabled') return '已保存在本機；專案尚未啟用訪客雲端功能';
  if (錯誤?.code === '42501') return '已保存在本機；雲端權限不足，請聯絡網站管理者';
  return '已保存在本機，雲端同步未完成，請檢查網路後重試';
}

async function 同步生活資料() {
  if (!雲端就緒 || 同步中) return;
  同步中 = true;
  設定同步狀態('正在同步至雲端…');
  try {
    while (Object.values(待同步).some((清單) => 清單.size)) {
      for (const 鍵 of Object.keys(待同步)) {
        const 批次 = 資料[鍵].filter((項目) => 待同步[鍵].has(鍵 === 'expenseCategories' ? 項目 : 項目.id)).map((項目) => JSON.parse(JSON.stringify(項目)));
        if (!批次.length) continue;
        // 分批送出；識別碼相同就更新，斷線重試不會重複新增。
        for (let 起點 = 0; 起點 < 批次.length; 起點 += 200) {
          const 本批 = 批次.slice(起點, 起點 + 200);
          const 衝突欄位 = 鍵 === 'expenseCategories' ? '使用者識別碼,名稱' : '使用者識別碼,識別碼';
          const { error } = await 雲端服務.from(雲端資料表[鍵].名稱).upsert(本批.map((項目) => 轉換雲端紀錄(鍵, 項目)), { onConflict: 衝突欄位 });
          if (error) throw error;
          本批.forEach((項目) => {
            const 識別碼 = 鍵 === 'expenseCategories' ? 項目 : 項目.id;
            const 最新紀錄 = 資料[鍵].find((目前) => (鍵 === 'expenseCategories' ? 目前 : 目前.id) === 識別碼);
            // 等待期間若又被修改，保留在佇列中，下一輪再送出最新內容。
            if (JSON.stringify(最新紀錄) === JSON.stringify(項目)) 待同步[鍵].delete(識別碼);
          });
          保存本機快取();
        }
      }
    }
    設定同步狀態('已同步至雲端');
  } catch (錯誤) { 設定同步狀態(雲端錯誤文字(錯誤), true); }
  finally { 同步中 = false; }
}

// 所有雲端請求設有十五秒上限，斷線時仍能繼續使用本機紀錄。
async function 有逾時的請求(網址, 設定 = {}) {
  const 控制器 = new AbortController();
  const 中止 = () => 控制器.abort();
  const 計時器 = setTimeout(中止, 15000);
  if (設定.signal?.aborted) 中止();
  設定.signal?.addEventListener('abort', 中止);
  try { return await fetch(網址, { ...設定, signal: 控制器.signal }); }
  finally { clearTimeout(計時器); 設定.signal?.removeEventListener('abort', 中止); }
}

async function 啟動雲端() {
  if (啟動中 || 同步中) return;
  if (雲端就緒) { await 同步生活資料(); return; }
  啟動中 = true;
  設定同步狀態('正在連接個人雲端空間…');
  try {
    if (!window.supabase) throw new Error('雲端程式尚未載入');
    if (!雲端服務) 雲端服務 = window.supabase.createClient(專案網址, 公開金鑰, {
      auth: { storageKey: '日常訪客身分', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      global: { fetch: 有逾時的請求 }
    });
    const { data: 身分資料, error: 身分錯誤 } = await 雲端服務.auth.getSession();
    if (身分錯誤) throw 身分錯誤;
    let 身分 = 身分資料.session;
    if (!身分) {
      const { data, error } = await 雲端服務.auth.signInAnonymously();
      if (error) throw error;
      身分 = data.session;
    }
    if (!身分?.user?.is_anonymous) throw new Error('無法取得訪客身分');
    const 上次訪客 = localStorage.getItem('日常上次訪客');
    訪客識別碼 = 身分.user.id;
    本機儲存鍵 = `${儲存鍵}-${訪客識別碼}`;
    // 新訪客不會自動取得上一個訪客的快取；初次使用才轉入原本本機資料。
    if (上次訪客 && 上次訪客 !== 訪客識別碼) 讀取本機資料(本機儲存鍵);
    保存本機快取();
    localStorage.setItem('日常上次訪客', 訪客識別碼);
    const 鍵清單 = Object.keys(雲端資料表);
    const 雲端清單 = await Promise.all(鍵清單.map(讀取雲端清單));
    const 合併資料 = {};
    鍵清單.forEach((鍵, 位置) => {
      const 雲端紀錄 = new Map(雲端清單[位置].map((項目) => [鍵 === 'expenseCategories' ? 項目 : 項目.id, 項目]));
      資料[鍵].forEach((項目) => {
        const 識別碼 = 鍵 === 'expenseCategories' ? 項目 : 項目.id;
        if (待同步[鍵].has(識別碼)) 雲端紀錄.set(識別碼, 項目);
      });
      合併資料[鍵] = [...雲端紀錄.values()];
    });
    if (!檢查資料(合併資料)) throw new Error('雲端資料格式不符');
    資料 = 合併資料;
    保存本機快取();
    更新畫面();
    雲端就緒 = true;
    await 同步生活資料();
  } catch (錯誤) { 設定同步狀態(雲端錯誤文字(錯誤), true); }
  finally { 啟動中 = false; }
}

function 空白提示(圖示, 文字, 類型, 按鈕) {
  return `<div class="empty-state"><span class="empty-symbol">${圖示}</span>${文字}${類型 ? `<button data-open="${類型}">＋ ${按鈕}</button>` : ''}</div>`;
}

function 更新待辦() {
  const 未完成 = 資料.tasks.filter((事項) => !事項.done);
  const 已完成 = 資料.tasks.length - 未完成.length;
  取元素('#stat-tasks').innerHTML = `${未完成.length} <small>件</small>`;
  取元素('#nav-count').textContent = 未完成.length;
  取元素('#task-count').textContent = 未完成.length;
  const 今日待辦 = 未完成.filter((事項) => 事項.date === 日期字串()).length;
  取元素('#task-summary').textContent = 今日待辦 ? `其中 ${今日待辦} 件安排在今天` : '今天也給自己一點餘裕';
  const 清單 = 資料.tasks.filter((事項) => 待辦篩選 === 'done' ? 事項.done : !事項.done && (待辦篩選 !== 'today' || 事項.date === 日期字串()));
  清單.sort((甲, 乙) => (甲.date || '9999').localeCompare(乙.date || '9999'));
  取元素('#task-list-summary').textContent = `共 ${清單.length} 件`;
  取元素('#task-list').innerHTML = 清單.length ? 清單.map((事項) => {
    const 日期文字 = !事項.date ? '未設定日期' : 事項.date === 日期字串() ? '今天' : 事項.date.slice(5).replace('-', ' / ');
    return `<div class="task-row ${事項.done ? 'done' : ''}"><input class="task-check" type="checkbox" data-check="${事項.id}" ${事項.done ? 'checked' : ''} aria-label="${安全文字(事項.title)}，標記為${事項.done ? '未完成' : '已完成'}"><div class="task-copy"><div class="task-title">${安全文字(事項.title)}</div><div class="task-meta"><span class="task-tag ${事項.category === '工作' ? 'work' : ''}">${安全文字(事項.category)}</span><span class="task-date ${事項.date && 事項.date < 日期字串() && !事項.done ? 'overdue' : ''}">${日期文字}</span>${事項.priority === '優先' ? '<span class="priority-dot"></span><span>優先處理</span>' : ''}</div></div>${事項.date ? `<button class="calendar-button" data-calendar="${事項.id}" aria-label="將${安全文字(事項.title)}匯出為全天行程">加入行事曆</button>` : ''}<button class="edit-button" data-edit="task" data-id="${事項.id}" aria-label="編輯待辦">⋯</button></div>`;
  }).join('') : 空白提示('☑', 待辦篩選 === 'done' ? '完成的小事，都會收藏在這裡。' : 待辦篩選 === 'today' ? '今天還沒有安排，留點時間給自己。' : '把腦中的大小事，先輕輕放在這裡。', 待辦篩選 === 'done' ? '' : 'task', '新增第一件待辦');
  取元素('#completion-count').textContent = `${已完成} / ${資料.tasks.length}`;
  取元素('#completion-label').textContent = 已完成 ? `已完成 ${已完成} 件小事，做得很好！` : '給今天的自己一點鼓勵';
  取元素('#completion-bar').style.width = `${資料.tasks.length ? 已完成 / 資料.tasks.length * 100 : 0}%`;
}

function 月份紀錄(月份) {
  return 資料.transactions.filter((紀錄) => 紀錄.date.slice(0, 7) === 日期字串(月份).slice(0, 7));
}

function 更新記帳() {
  const 本月紀錄 = 月份紀錄(今天);
  const 收入 = 本月紀錄.filter((紀錄) => 紀錄.type === 'income').reduce((合計, 紀錄) => 合計 + 紀錄.amount, 0);
  const 支出 = 本月紀錄.filter((紀錄) => 紀錄.type === 'expense').reduce((合計, 紀錄) => 合計 + 紀錄.amount, 0);
  取元素('#stat-expense').textContent = 金額文字(支出);
  取元素('#stat-income').textContent = 金額文字(收入);
  取元素('#stat-balance').textContent = 金額文字(收入 - 支出);
  取元素('#balance-summary').textContent = 收入 - 支出 < 0 ? '本月支出較多，花點時間整理一下' : '收入減去支出，心中更有數';
  取元素('#finance-month').textContent = `${選擇月份.getFullYear()} 年 ${選擇月份.getMonth() + 1} 月`;
  const 紀錄清單 = 月份紀錄(選擇月份).sort((甲, 乙) => 乙.date.localeCompare(甲.date) || 乙.id.localeCompare(甲.id));
  const 各類支出 = Object.entries(取得分類樣式()).map(([分類, 樣式]) => ({ 分類, ...樣式, 金額: 紀錄清單.filter((紀錄) => 紀錄.type === 'expense' && 紀錄.category === 分類).reduce((合計, 紀錄) => 合計 + 紀錄.amount, 0) }));
  const 總支出 = 各類支出.reduce((合計, 分類) => 合計 + 分類.金額, 0);
  取元素('#donut-total').textContent = 金額文字(總支出);
  let 累積角度 = 0;
  const 色段 = 各類支出.filter((分類) => 分類.金額 > 0).map((分類) => {
    const 起點 = 累積角度;
    累積角度 += 分類.金額 / 總支出 * 360;
    return `${分類.color} ${起點}deg ${累積角度}deg`;
  });
  取元素('#donut').style.background = 色段.length ? `conic-gradient(${色段.join(',')})` : '#eceef1';
  取元素('#category-legend').innerHTML = 各類支出.filter((分類) => 分類.金額 > 0).map((分類) => `<div class="legend-row"><i style="background:${分類.color}"></i><span>${安全文字(分類.分類)}</span><strong>${金額文字(分類.金額)}</strong></div>`).join('') || '<span class="muted">還沒有支出紀錄<br><br>從今天開始記一筆吧</span>';
  const 顯示清單 = 目前頁面 === '記帳' ? 紀錄清單 : 紀錄清單.slice(0, 3);
  取元素('#transaction-list').innerHTML = 顯示清單.length ? 顯示清單.map((紀錄) => `<div class="transaction-row"><span class="transaction-icon">${紀錄.type === 'income' ? '↙' : 取得分類樣式()[紀錄.category]?.icon || '⋯'}</span><div class="transaction-copy"><div class="transaction-title">${安全文字(紀錄.title)}</div><div class="transaction-meta">${安全文字(紀錄.category)} · ${紀錄.date.slice(5).replace('-', ' / ')}</div></div><span class="transaction-amount ${紀錄.type === 'income' ? 'income' : ''}">${紀錄.type === 'income' ? '＋' : '−'}${金額文字(紀錄.amount)}</span><button class="edit-button" data-edit="transaction" data-id="${紀錄.id}" aria-label="編輯收支紀錄">⋯</button></div>`).join('') : 空白提示('▤', '小小一筆，讓收支更清楚。', 'transaction', '記下第一筆收支');
}

function 更新筆記() {
  取元素('#notes-list').innerHTML = 資料.notes.length ? [...資料.notes].sort((甲, 乙) => 乙.updated.localeCompare(甲.updated)).map((筆記) => `<button class="note-card" data-edit="note" data-id="${筆記.id}"><strong>${安全文字(筆記.title)}</strong><p>${安全文字(筆記.content)}</p><small>${筆記.updated.slice(0, 10).replaceAll('-', ' / ')} · 點選編輯 ↗</small></button>`).join('') : 空白提示('✧', '突然想到的靈感、想去的地方，或今天的小小心情。', 'note', '寫下第一則筆記');
}

// 依每月第一天的星期，補齊前後月份，讓整週始終維持七欄。
function 取得月曆日期(月份) {
  const 第一天 = new Date(月份.getFullYear(), 月份.getMonth(), 1);
  const 天數 = new Date(月份.getFullYear(), 月份.getMonth() + 1, 0).getDate();
  const 格數 = Math.ceil((第一天.getDay() + 天數) / 7) * 7;
  return Array.from({ length: 格數 }, (_, 位置) => new Date(月份.getFullYear(), 月份.getMonth(), 1 - 第一天.getDay() + 位置));
}

function 更新行事曆() {
  const 月份文字 = 日期字串(行事曆月份).slice(0, 7);
  取元素('#calendar-month-label').textContent = `${行事曆月份.getFullYear()} 年 ${行事曆月份.getMonth() + 1} 月`;
  取元素('#calendar-month-picker').value = 月份文字;
  取元素('#calendar-previous').disabled = 月份文字 <= '1900-01';
  取元素('#calendar-next').disabled = 月份文字 >= '9998-12';
  const 顯示待辦 = 資料.tasks.filter((事項) => 事項.date && (行事曆分類 === '全部' || 事項.category === 行事曆分類));
  // 先依日期分組，避免每畫一格都重新搜尋所有待辦。
  const 日期分組 = new Map();
  顯示待辦.forEach((事項) => { if (!日期分組.has(事項.date)) 日期分組.set(事項.date, []); 日期分組.get(事項.date).push(事項); });
  const 行程按鈕 = (事項) => `<button class="calendar-event ${事項.done ? 'complete' : ''}" data-edit="task" data-id="${事項.id}" title="${安全文字(事項.title)}" aria-label="編輯${事項.done ? '已完成' : '未完成'}待辦：${安全文字(事項.title)}">${事項.done ? '✓ ' : ''}${安全文字(事項.title)}</button>`;
  取元素('#calendar-days').innerHTML = 取得月曆日期(行事曆月份).map((日期) => {
    const 日期文字 = 日期字串(日期);
    const 當天事項 = 日期分組.get(日期文字) || [];
    const 非本月 = 日期.getMonth() !== 行事曆月份.getMonth();
    const 是今天 = 日期文字 === 日期字串();
    const 超出範圍 = 日期.getFullYear() < 1900 || 日期.getFullYear() > 9998;
    return `<div class="calendar-cell ${非本月 ? 'outside-month' : ''} ${日期文字 === 行事曆日期 ? 'selected-date' : ''} ${是今天 ? 'is-today' : ''}"><button class="calendar-day-number weekday-${日期.getDay()}" data-calendar-date="${日期文字}" aria-label="${日期.getFullYear()}年${日期.getMonth() + 1}月${日期.getDate()}日${是今天 ? '，今天' : ''}，${當天事項.length}件待辦" aria-pressed="${日期文字 === 行事曆日期}" ${超出範圍 ? 'disabled' : ''}>${日期.getDate()}</button><div class="calendar-cell-events">${當天事項.slice(0, 3).map(行程按鈕).join('')}${當天事項.length > 3 ? `<button class="calendar-more" data-calendar-date="${日期文字}">另 ${當天事項.length - 3} 件</button>` : ''}</div></div>`;
  }).join('');
  const 本月待辦 = 顯示待辦.filter((事項) => 事項.date.startsWith(月份文字));
  取元素('#calendar-month-summary').textContent = `本月 ${本月待辦.length} 件 · ${本月待辦.filter((事項) => !事項.done).length} 件待完成`;
  const 選取日期 = new Date(`${行事曆日期}T12:00:00`);
  取元素('#calendar-selected-label').textContent = 選取日期.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' });
  const 當天事項 = 日期分組.get(行事曆日期) || [];
  取元素('#calendar-agenda-list').innerHTML = 當天事項.length ? 當天事項.map((事項) => `<div class="calendar-agenda-row">${行程按鈕(事項)}<span class="calendar-agenda-category">${安全文字(事項.category)} · ${事項.done ? '已完成' : '待完成'}</span><button class="calendar-button" data-calendar="${事項.id}">加入行事曆</button></div>`).join('') : '<p class="calendar-no-events">這天還沒有安排，留點時間給自己，也可以新增一件待辦。</p>';
}

function 選取行事曆日期(日期) {
  const 選取日期 = new Date(`${日期}T12:00:00`);
  if (Number.isNaN(選取日期.getTime()) || 選取日期.getFullYear() < 1900 || 選取日期.getFullYear() > 9998) return;
  行事曆日期 = 日期;
  行事曆月份 = new Date(選取日期.getFullYear(), 選取日期.getMonth(), 1);
  更新行事曆();
}

function 移動行事曆月份(方向) {
  const 新月份 = new Date(行事曆月份.getFullYear(), 行事曆月份.getMonth() + 方向, 1);
  if (新月份.getFullYear() < 1900 || 新月份.getFullYear() > 9998) return;
  選取行事曆日期(日期字串(新月份));
}

取元素('#calendar-previous').addEventListener('click', () => 移動行事曆月份(-1));
取元素('#calendar-next').addEventListener('click', () => 移動行事曆月份(1));
取元素('#calendar-today').addEventListener('click', () => 選取行事曆日期(日期字串()));
取元素('#calendar-month-picker').addEventListener('change', (事件) => { if (/^\d{4}-\d{2}$/.test(事件.target.value)) 選取行事曆日期(`${事件.target.value}-01`); });
取元素('#calendar-category').addEventListener('change', (事件) => { 行事曆分類 = 事件.target.value; 更新行事曆(); });
取元素('#calendar-add').addEventListener('click', () => 開啟表單('task', null, 行事曆日期));
取元素('#calendar-day-add').addEventListener('click', () => 開啟表單('task', null, 行事曆日期));

function 更新畫面() { 更新待辦(); 更新記帳(); 更新筆記(); 更新行事曆(); }

function 顯示頁面(頁面) {
  目前頁面 = ['總覽', '待辦', '行事曆', '記帳', '筆記', '問卷'].includes(頁面) ? 頁面 : '總覽';
  const 頁面資料 = { 問卷: ['回饋問卷', '你的想法，讓日常更好', '簡單兩題，分享你對日常的使用感受。'], 行事曆: ['行事曆', '每一天，都有自己的節奏', '用月曆整理日常安排，替重要的事留好位置。'], 總覽: ['生活總覽', '把今天，過成喜歡的樣子', '整理待辦、記下收支，也留一點空間給自己。'], 待辦: ['待辦事項', '一步一步，把小事完成', '把重要的事記下來，讓腦袋輕鬆一點。'], 記帳: ['收支記帳', '每一筆，都是生活的足跡', '金額以新臺幣記錄，慢慢養成記帳的小習慣。'], 筆記: ['隨手筆記', '把靈感，留在這裡', '想法、心情與生活中的小發現，都值得被記下。'] }[目前頁面];
  取元素('#breadcrumb').textContent = 頁面資料[0];
  取元素('#page-title').innerHTML = `${頁面資料[1]} <span>${目前頁面 === '筆記' ? '✧' : '☀'}</span>`;
  取元素('#page-description').textContent = 頁面資料[2];
  全部元素('[data-page]').forEach((按鈕) => { 按鈕.classList.toggle('active', 按鈕.dataset.page === 目前頁面); if (按鈕.dataset.page === 目前頁面) 按鈕.setAttribute('aria-current', 'page'); else 按鈕.removeAttribute('aria-current'); });
  取元素('#dashboard').hidden = 目前頁面 !== '總覽';
  取元素('#survey-panel').hidden = 目前頁面 !== '問卷';
  取元素('#main-grid').hidden = 目前頁面 === '問卷';
  取元素('#quick-add').hidden = 目前頁面 === '問卷';
  取元素('#tasks-panel').hidden = !['總覽', '待辦'].includes(目前頁面);
  取元素('#calendar-panel').hidden = !['總覽', '待辦', '行事曆'].includes(目前頁面);
  取元素('#finance-panel').hidden = !['總覽', '記帳'].includes(目前頁面);
  取元素('#notes-panel').hidden = !['總覽', '筆記'].includes(目前頁面);
  取元素('#main-grid').classList.toggle('single-page', 目前頁面 !== '總覽');
  取元素('#view-finance').hidden = 目前頁面 === '記帳';
  history.replaceState(null, '', `#${目前頁面}`);
  更新畫面();
}

function 開啟表單(類型, 識別碼 = null, 預設日期 = 日期字串()) {
  表單類型 = 類型;
  編輯識別碼 = 識別碼;
  const 集合 = 類型 === 'task' ? 資料.tasks : 類型 === 'transaction' ? 資料.transactions : 資料.notes;
  const 原資料 = 集合.find((紀錄) => 紀錄.id === 識別碼);
  取元素('#dialog-title').textContent = `${原資料 ? '編輯' : '新增'}${類型 === 'task' ? '待辦' : 類型 === 'transaction' ? '收支紀錄' : '筆記'}`;
  const 欄位 = (標籤, 內容) => `<label class="form-field">${標籤}${內容}</label>`;
  const 選單 = (名稱, 選項) => `<select name="${名稱}">${選項.map(([值, 文字]) => `<option value="${安全文字(值)}">${安全文字(文字)}</option>`).join('')}</select>`;
  let 欄位內容 = 欄位('名稱', '<input name="title" required maxlength="100" placeholder="寫下想記錄的事…">');
  if (類型 === 'task') {
    欄位內容 += 欄位('預定日期（可留白）', '<input type="date" name="date" min="1900-01-01" max="9999-12-31">') + '<div class="form-row">' + 欄位('分類', 選單('category', ['生活', '工作', '個人', '學習'].map((名稱) => [名稱, 名稱]))) + 欄位('優先程度', 選單('priority', [['一般', '一般'], ['優先', '優先處理']])) + '</div>';
  } else if (類型 === 'transaction') {
    欄位內容 += '<div class="form-row">' + 欄位('收支類型', 選單('type', [['expense', '支出'], ['income', '收入']])) + 欄位('金額（新臺幣）', '<input name="amount" type="number" min="0.01" max="999999999" step="0.01" required placeholder="0">') + '</div>' + 欄位('日期', '<input type="date" name="date" required min="1900-01-01" max="9999-12-31">') + 欄位('分類', 選單('category', 取得支出分類().map((名稱) => [名稱, 名稱])));
    欄位內容 += '<div id="custom-category-fields" class="custom-category-fields"><label for="custom-category-name">新增支出分類</label><div class="custom-category-row"><input id="custom-category-name" maxlength="20" placeholder="例如：醫療、寵物、旅遊"><button type="button" id="add-expense-category">＋ 新增</button></div><small>新增後會自動選取，之後記帳也能使用。</small></div>';
  } else {
    欄位內容 += 欄位('想記下的內容', '<textarea name="content" required maxlength="5000" placeholder="今天有什麼小小的發現呢？"></textarea>');
  }
  取元素('#form-fields').innerHTML = 欄位內容;
  取元素('#form-error').textContent = '';
  const 表單 = 取元素('#entry-form');
  if (類型 === 'transaction') {
    const 更新分類選單 = () => {
      const 原分類 = 表單.elements.category.value;
      const 選項 = 表單.elements.type.value === 'income' ? ['薪資', '獎金', '其他'] : 取得支出分類();
      表單.elements.category.innerHTML = 選項.map((名稱) => `<option value="${安全文字(名稱)}">${安全文字(名稱)}</option>`).join('');
      if (選項.includes(原分類)) 表單.elements.category.value = 原分類;
      取元素('#custom-category-fields').hidden = 表單.elements.type.value === 'income';
    };
    取元素('#add-expense-category').addEventListener('click', () => {
      try {
        const 名稱 = 新增支出分類(取元素('#custom-category-name').value);
        更新分類選單();
        表單.elements.category.value = 名稱;
        取元素('#custom-category-name').value = '';
        取元素('#form-error').textContent = '';
        提示(`已新增「${名稱}」分類。`);
      } catch (錯誤) { 取元素('#form-error').textContent = 錯誤.message; }
    });
    取元素('#custom-category-name').addEventListener('keydown', (事件) => {
      if (事件.key === 'Enter' && !事件.isComposing) { 事件.preventDefault(); 取元素('#add-expense-category').click(); }
    });
    表單.elements.type.addEventListener('change', 更新分類選單);
    if (原資料) 表單.elements.type.value = 原資料.type;
    更新分類選單();
  }
  if (原資料) Object.entries(原資料).forEach(([鍵, 值]) => { if (表單.elements.namedItem(鍵)) 表單.elements.namedItem(鍵).value = 值; });
  else if (表單.elements.namedItem('date')) 表單.elements.date.value = 預設日期;
  取元素('#entry-dialog').showModal();
}

取元素('#entry-form').addEventListener('submit', (事件) => {
  事件.preventDefault();
  const 輸入 = Object.fromEntries(new FormData(事件.currentTarget));
  輸入.title = 輸入.title.trim();
  if (!輸入.title || (表單類型 === 'note' && !輸入.content.trim())) { 取元素('#form-error').textContent = '請填入名稱與內容，不能只有空白。'; return; }
  if (表單類型 === 'transaction') {
    輸入.amount = Number(輸入.amount);
    if (!Number.isFinite(輸入.amount) || 輸入.amount <= 0) { 取元素('#form-error').textContent = '請填入大於零的金額。'; return; }
  }
  const 集合 = 表單類型 === 'task' ? 資料.tasks : 表單類型 === 'transaction' ? 資料.transactions : 資料.notes;
  const 原資料 = 集合.find((紀錄) => 紀錄.id === 編輯識別碼);
  if (原資料) Object.assign(原資料, 輸入, 表單類型 === 'note' ? { updated: new Date().toISOString() } : {});
  else 集合.push({ id: 新識別碼(), ...輸入, ...(表單類型 === 'task' ? { done: false } : 表單類型 === 'note' ? { updated: new Date().toISOString() } : {}) });
  儲存();
  取元素('#entry-dialog').close();
  提示(原資料 ? '已更新，生活又整理好了一點。' : '已記下，讓日常輕鬆一點。');
});

document.addEventListener('click', (事件) => {
  const 按鈕 = 事件.target.closest('button');
  if (!按鈕) return;
  if (按鈕.dataset.calendarDate) 選取行事曆日期(按鈕.dataset.calendarDate);
  if (按鈕.dataset.calendar) 匯出待辦行事曆(按鈕.dataset.calendar);
  if (按鈕.dataset.backup) 取元素(`#${按鈕.dataset.backup}`).click();
  if (按鈕.dataset.page) 切換頁面(按鈕.dataset.page);
  if (按鈕.dataset.open) 開啟表單(按鈕.dataset.open);
  if (按鈕.dataset.edit) 開啟表單(按鈕.dataset.edit, 按鈕.dataset.id);
  if (按鈕.classList.contains('close-dialog')) 取元素('#entry-dialog').close();
  if (按鈕.dataset.filter) {
    待辦篩選 = 按鈕.dataset.filter;
    全部元素('[data-filter]').forEach((項目) => { 項目.classList.toggle('active', 項目 === 按鈕); 項目.setAttribute('aria-pressed', 項目 === 按鈕 ? 'true' : 'false'); });
    更新待辦();
  }
});

取元素('#task-list').addEventListener('change', (事件) => {
  if (!事件.target.dataset.check) return;
  const 事項 = 資料.tasks.find((項目) => 項目.id === 事件.target.dataset.check);
  事項.done = 事件.target.checked;
  儲存();
  if (事項.done) 提示('又完成一件小事，給自己一點掌聲！');
});
取元素('#quick-add').addEventListener('click', () => 開啟表單(目前頁面 === '記帳' ? 'transaction' : 目前頁面 === '筆記' ? 'note' : 'task', null, 目前頁面 === '行事曆' ? 行事曆日期 : 日期字串()));
取元素('#start-task').addEventListener('click', () => 切換頁面('待辦'));
取元素('#view-finance').addEventListener('click', () => 切換頁面('記帳'));
取元素('#previous-month').addEventListener('click', () => { 選擇月份.setMonth(選擇月份.getMonth() - 1); 更新記帳(); });
取元素('#next-month').addEventListener('click', () => { 選擇月份.setMonth(選擇月份.getMonth() + 1); 更新記帳(); });
window.addEventListener('hashchange', () => 切換頁面(讀取頁面()));

// 行事曆文字需跳脫特殊符號，避免換行或逗號破壞檔案內容。
function 行事曆文字(文字) {
  return String(文字).replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

// 每行不超過七十五個位元組，中文字也依完整字元切行。
function 行事曆折行(文字) {
  const 編碼器 = new TextEncoder();
  let 一行 = '';
  const 行列 = [];
  for (const 字元 of 文字) {
    if (編碼器.encode(一行 + 字元).length > 75) {
      行列.push(一行);
      一行 = ' ';
    }
    一行 += 字元;
  }
  行列.push(一行);
  return 行列.join('\r\n');
}

function 建立行事曆內容(事項) {
  const 開始日期 = new Date(`${事項.date}T12:00:00`);
  if (!事項.date || Number.isNaN(開始日期.getTime()) || 日期字串(開始日期) !== 事項.date) throw new Error('請先設定有效的待辦日期。');
  // 全天行程的結束日期不含當天，因此使用隔天日期。
  const 結束日期 = new Date(開始日期);
  結束日期.setDate(結束日期.getDate() + 1);
  const 時間戳記 = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//日常//生活管理//ZH-TW', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${事項.id}@richang.local`, `DTSTAMP:${時間戳記}`,
    `DTSTART;VALUE=DATE:${事項.date.replaceAll('-', '')}`,
    `DTEND;VALUE=DATE:${日期字串(結束日期).replaceAll('-', '')}`,
    `SUMMARY:${行事曆文字(事項.title)}`,
    `DESCRIPTION:${行事曆文字(`來自「日常」的待辦事項\n分類：${事項.category}\n優先程度：${事項.priority}\n此為單次匯入，後續修改不會自動同步。`)}`,
    'TRANSP:TRANSPARENT', 'END:VEVENT', 'END:VCALENDAR'
  ].map(行事曆折行).join('\r\n') + '\r\n';
}

function 匯出待辦行事曆(識別碼) {
  const 事項 = 資料.tasks.find((紀錄) => 紀錄.id === 識別碼);
  if (!事項) return;
  try {
    const 下載位址 = URL.createObjectURL(new Blob([建立行事曆內容(事項)], { type: 'text/calendar;charset=utf-8' }));
    const 連結 = document.createElement('a');
    連結.href = 下載位址;
    連結.download = `日常待辦-${事項.date}.ics`;
    連結.click();
    setTimeout(() => URL.revokeObjectURL(下載位址), 1000);
    提示('已匯出全天行程，請開啟下載檔案並確認加入行事曆。');
  } catch { 提示('無法匯出，請先設定有效的待辦日期。'); }
}

取元素('#export').addEventListener('click', () => {
  const 下載位址 = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, ...資料 }, null, 2)], { type: 'application/json' }));
  const 連結 = document.createElement('a');
  連結.href = 下載位址;
  連結.download = `日常備份-${日期字串()}.json`;
  連結.click();
  setTimeout(() => URL.revokeObjectURL(下載位址), 1000);
  提示('備份已匯出，記得好好收著。');
});

// 備份必須逐欄檢查；匯入採合併方式，保留目前紀錄。
function 檢查資料(輸入) {
  const 是文字 = (值, 上限) => typeof 值 === 'string' && 值.length <= 上限;
  const 是日期 = (值) => 是文字(值, 10) && /^\d{4}-\d{2}-\d{2}$/.test(值) && !Number.isNaN(Date.parse(值));
  if (!輸入 || !['tasks', 'transactions', 'notes'].every((鍵) => Array.isArray(輸入[鍵]) && 輸入[鍵].length <= 10000)) return false;
  // 舊備份沒有自訂分類欄位時，以空清單相容讀取。
  const 自訂分類 = 輸入.expenseCategories === undefined ? [] : 輸入.expenseCategories;
  if (!Array.isArray(自訂分類) || 自訂分類.length > 100 || !自訂分類.every((名稱) => 是文字(名稱, 20) && 名稱.trim() === 名稱 && 名稱.length > 0 && !/[\u0000-\u001f\u007f]/.test(名稱)) || new Set(自訂分類).size !== 自訂分類.length) return false;
  const 基本檢查 = (紀錄) => 紀錄 && 是文字(紀錄.id, 100) && /^[a-zA-Z0-9-]+$/.test(紀錄.id) && 是文字(紀錄.title, 100) && 紀錄.title.trim();
  return 輸入.tasks.every((紀錄) => 基本檢查(紀錄) && typeof 紀錄.done === 'boolean' && (紀錄.date === '' || 是日期(紀錄.date)) && ['生活', '工作', '個人', '學習'].includes(紀錄.category) && ['一般', '優先'].includes(紀錄.priority)) && 輸入.transactions.every((紀錄) => 基本檢查(紀錄) && 是日期(紀錄.date) && ['income', 'expense'].includes(紀錄.type) && typeof 紀錄.amount === 'number' && Number.isFinite(紀錄.amount) && 紀錄.amount > 0 && 紀錄.amount <= 999999999 && (紀錄.type === 'income' ? ['薪資', '獎金', '其他'] : 取得支出分類(自訂分類)).includes(紀錄.category)) && 輸入.notes.every((紀錄) => 基本檢查(紀錄) && 是文字(紀錄.content, 5000) && 是文字(紀錄.updated, 40) && !Number.isNaN(Date.parse(紀錄.updated)));
}

取元素('#import').addEventListener('click', () => 取元素('#import-file').click());
取元素('#import-file').addEventListener('change', async (事件) => {
  const 檔案 = 事件.target.files[0];
  if (!檔案) return;
  try {
    if (檔案.size > 5 * 1024 * 1024) throw new Error('備份過大');
    const 輸入 = JSON.parse(await 檔案.text());
    if (!檢查資料(輸入)) throw new Error('備份格式不符');
    const 合併分類 = [...new Set([...資料.expenseCategories, ...(輸入.expenseCategories || [])])];
    if (合併分類.length > 100) throw new Error('自訂分類超過上限');
    資料.expenseCategories = 合併分類;
    let 新增數量 = 0;
    ['tasks', 'transactions', 'notes'].forEach((鍵) => {
      const 已有識別碼 = new Set(資料[鍵].map((紀錄) => 紀錄.id));
      輸入[鍵].forEach((紀錄) => { if (!已有識別碼.has(紀錄.id)) { 資料[鍵].push(紀錄); 已有識別碼.add(紀錄.id); 新增數量++; } });
    });
    儲存();
    提示(`已合併 ${新增數量} 筆紀錄，原有內容已保留。`);
  } catch { 提示('無法匯入，請選擇有效的日常備份（上限五百萬位元組）。'); }
  事件.target.value = '';
});

// 使用較普遍支援的亂數功能，讓直接開啟本機網頁也能產生識別碼。
function 建立問卷識別碼() {
  const 位元組 = crypto.getRandomValues(new Uint8Array(16));
  // 依通用識別碼格式設定版本，再將十六個位元組組合成文字。
  位元組[6] = (位元組[6] & 15) | 64;
  位元組[8] = (位元組[8] & 63) | 128;
  const 文字 = Array.from(位元組, (值) => 值.toString(16).padStart(2, '0')).join('');
  return `${文字.slice(0, 8)}-${文字.slice(8, 12)}-${文字.slice(12, 16)}-${文字.slice(16, 20)}-${文字.slice(20)}`;
}

// 公開問卷只送出答案，不建立帳號，也不讀取雲端回覆。
async function 儲存問卷回覆(功能, 感受) {
  if (!['待辦事項', '行事曆', '收支記帳', '隨手筆記'].includes(功能) || !['很滿意', '還不錯', '可以更好'].includes(感受)) throw new Error('請完成兩題後再送出。');
  // 重試沿用同一份答案與識別碼，避免連線中斷後重複新增。
  if (!待送問卷) 待送問卷 = { 識別碼: 建立問卷識別碼(), 功能, 感受 };
  // 使用計時器處理逾時，避免依賴部分瀏覽器尚未支援的逾時方法。
  const 控制器 = new AbortController();
  const 逾時計時器 = setTimeout(() => 控制器.abort(), 15000);
  try {
    let 回應;
    try {
      回應 = await fetch(`${專案網址}/rest/v1/${encodeURIComponent('問卷回覆')}`, {
        method: 'POST',
        headers: { apikey: 公開金鑰, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(待送問卷),
        signal: 控制器.signal
      });
    } catch (錯誤) {
      throw new Error(控制器.signal.aborted ? '連線超過十五秒，尚未確認儲存，請稍後重試。' : '無法連上問卷服務，請確認網路連線，或檢查瀏覽器是否阻擋此網站的連線。');
    }
    if (!回應.ok) {
      const 錯誤 = await 回應.json().catch(() => ({}));
      // 同一識別碼已存在，代表上次送出已成功；回傳當時送出的答案。
      if (回應.status === 409 && 錯誤.code === '23505') return 待送問卷;
      if ([401, 403].includes(回應.status)) throw new Error('問卷服務拒絕存取，請告知網站管理者檢查公開金鑰與問卷寫入權限。');
      if (回應.status === 400) throw new Error('問卷資料格式不符合要求，請重新整理網頁後再填寫。');
      throw new Error(`問卷服務暫時無法儲存（狀態碼：${回應.status}），請稍後重試。`);
    }
    return 待送問卷;
  } finally {
    clearTimeout(逾時計時器);
  }
}

取元素('#survey-form').addEventListener('submit', async (事件) => {
  事件.preventDefault();
  if (問卷處理中) return;
  問卷處理中 = true;
  const 送出按鈕 = 取元素('#survey-form button[type="submit"]');
  送出按鈕.disabled = true;
  送出按鈕.textContent = '正在儲存…';
  取元素('#survey-error').textContent = '';
  try {
    const 輸入 = new FormData(事件.currentTarget);
    const 回覆 = await 儲存問卷回覆(輸入.get('feature'), 輸入.get('feeling'));
    取元素('#survey-answer-summary').textContent = `最想使用：${回覆.功能} · 整體感受：${回覆.感受}`;
    取元素('#survey-form').hidden = true;
    取元素('#survey-success').hidden = false;
    取元素('#survey-success').focus();
  } catch (錯誤) {
    取元素('#survey-error').textContent = /[\u3400-\u9fff]/.test(錯誤.message) ? 錯誤.message : '瀏覽器無法執行送出功能，請更新瀏覽器或改用其他瀏覽器，再重新開啟網頁。';
  } finally {
    問卷處理中 = false;
    送出按鈕.disabled = false;
    送出按鈕.textContent = '送出回覆 ↗';
  }
});

取元素('#survey-retry').addEventListener('click', () => {
  待送問卷 = null;
  取元素('#survey-form').reset();
  取元素('#survey-form').hidden = false;
  取元素('#survey-success').hidden = true;
  取元素('#survey-error').textContent = '';
  取元素('#survey-form input').focus();
});

// 使用網址片段切換頁面，直接開啟根目錄的網頁檔案也能使用。
function 讀取頁面() {
  try { return decodeURIComponent(location.hash.slice(1)) || '總覽'; }
  catch { return '總覽'; }
}

// 各訪客的快取也分開保存，未送出的修改會在重新連線後繼續送出。
function 讀取本機資料(指定鍵) {
  資料 = { tasks: [], transactions: [], notes: [], expenseCategories: [] };
  Object.values(待同步).forEach((清單) => 清單.clear());
  try {
    const 上次訪客 = localStorage.getItem('日常上次訪客');
    本機儲存鍵 = 指定鍵 || (上次訪客 ? `${儲存鍵}-${上次訪客}` : 儲存鍵);
    const 原資料 = localStorage.getItem(本機儲存鍵);
    if (原資料) {
      const 讀取資料 = JSON.parse(原資料);
      if (!檢查資料(讀取資料)) throw new Error('資料格式不符');
      Object.keys(資料).forEach((鍵) => {
        資料[鍵] = 讀取資料[鍵] || [];
        const 佇列 = 讀取資料.待同步?.[鍵];
        // 舊版本尚未上雲的紀錄，第一次連線時全部轉入。
        const 識別碼清單 = 資料[鍵].map((項目) => 鍵 === 'expenseCategories' ? 項目 : 項目.id);
        識別碼清單.forEach((識別碼) => { if (!Array.isArray(佇列) || 佇列.includes(識別碼)) 待同步[鍵].add(識別碼); });
      });
    }
  } catch { 提示('無法讀取本機資料，請使用備份匯入。'); }
  上次本機資料 = JSON.parse(JSON.stringify(資料));
}

function 切換頁面(頁面) {
  顯示頁面(['總覽', '待辦', '行事曆', '記帳', '筆記', '問卷'].includes(頁面) ? 頁面 : '總覽');
}

取元素('#top-date').textContent = 今天.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' });
讀取本機資料();
切換頁面(讀取頁面());
取元素('#sync-retry').addEventListener('click', 啟動雲端);
window.addEventListener('online', 啟動雲端);
啟動雲端();

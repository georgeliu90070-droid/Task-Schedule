const 取元素 = (選擇器) => document.querySelector(選擇器);
const 全部元素 = (選擇器) => document.querySelectorAll(選擇器);
// 沿用原本的儲存鍵，改名後仍可讀取既有紀錄。
const 儲存鍵 = '日子生活管理資料';
const 今天 = new Date();
const 日期字串 = (日期 = new Date()) => `${日期.getFullYear()}-${String(日期.getMonth() + 1).padStart(2, '0')}-${String(日期.getDate()).padStart(2, '0')}`;
const 金額文字 = (金額) => `${金額 < 0 ? '−' : ''}$${Math.abs(金額).toLocaleString('zh-TW', { maximumFractionDigits: 2 })}`;
// 使用文字節點處理使用者內容，避免筆記被當成網頁程式執行。
const 安全文字 = (文字) => { const 容器 = document.createElement('span'); 容器.textContent = 文字; return 容器.innerHTML; };
const 新識別碼 = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
let 資料 = { tasks: [], transactions: [], notes: [] };
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

function 提示(訊息) {
  clearTimeout(提示計時);
  取元素('#toast').textContent = 訊息;
  取元素('#toast').classList.add('visible');
  提示計時 = setTimeout(() => 取元素('#toast').classList.remove('visible'), 3200);
}

function 儲存() {
  try { localStorage.setItem(儲存鍵, JSON.stringify(資料)); }
  catch { 提示('瀏覽器無法儲存，請先匯出備份以保留紀錄。'); }
  更新畫面();
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
  const 各類支出 = Object.entries(分類資料).map(([分類, 樣式]) => ({ 分類, ...樣式, 金額: 紀錄清單.filter((紀錄) => 紀錄.type === 'expense' && 紀錄.category === 分類).reduce((合計, 紀錄) => 合計 + 紀錄.amount, 0) }));
  const 總支出 = 各類支出.reduce((合計, 分類) => 合計 + 分類.金額, 0);
  取元素('#donut-total').textContent = 金額文字(總支出);
  let 累積角度 = 0;
  const 色段 = 各類支出.filter((分類) => 分類.金額 > 0).map((分類) => {
    const 起點 = 累積角度;
    累積角度 += 分類.金額 / 總支出 * 360;
    return `${分類.color} ${起點}deg ${累積角度}deg`;
  });
  取元素('#donut').style.background = 色段.length ? `conic-gradient(${色段.join(',')})` : '#eceef1';
  取元素('#category-legend').innerHTML = 各類支出.filter((分類) => 分類.金額 > 0).map((分類) => `<div class="legend-row"><i style="background:${分類.color}"></i><span>${分類.分類}</span><strong>${金額文字(分類.金額)}</strong></div>`).join('') || '<span class="muted">還沒有支出紀錄<br><br>從今天開始記一筆吧</span>';
  const 顯示清單 = 目前頁面 === '記帳' ? 紀錄清單 : 紀錄清單.slice(0, 3);
  取元素('#transaction-list').innerHTML = 顯示清單.length ? 顯示清單.map((紀錄) => `<div class="transaction-row"><span class="transaction-icon">${紀錄.type === 'income' ? '↙' : 分類資料[紀錄.category]?.icon || '⋯'}</span><div class="transaction-copy"><div class="transaction-title">${安全文字(紀錄.title)}</div><div class="transaction-meta">${安全文字(紀錄.category)} · ${紀錄.date.slice(5).replace('-', ' / ')}</div></div><span class="transaction-amount ${紀錄.type === 'income' ? 'income' : ''}">${紀錄.type === 'income' ? '＋' : '−'}${金額文字(紀錄.amount)}</span><button class="edit-button" data-edit="transaction" data-id="${紀錄.id}" aria-label="編輯收支紀錄">⋯</button></div>`).join('') : 空白提示('▤', '小小一筆，讓收支更清楚。', 'transaction', '記下第一筆收支');
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

function 切換頁面(頁面) {
  目前頁面 = ['總覽', '待辦', '行事曆', '記帳', '筆記'].includes(頁面) ? 頁面 : '總覽';
  const 頁面資料 = { 行事曆: ['行事曆', '每一天，都有自己的節奏', '用月曆整理日常安排，替重要的事留好位置。'], 總覽: ['生活總覽', '把今天，過成喜歡的樣子', '整理待辦、記下收支，也留一點空間給自己。'], 待辦: ['待辦事項', '一步一步，把小事完成', '把重要的事記下來，讓腦袋輕鬆一點。'], 記帳: ['收支記帳', '每一筆，都是生活的足跡', '金額以新臺幣記錄，慢慢養成記帳的小習慣。'], 筆記: ['隨手筆記', '把靈感，留在這裡', '想法、心情與生活中的小發現，都值得被記下。'] }[目前頁面];
  取元素('#breadcrumb').textContent = 頁面資料[0];
  取元素('#page-title').innerHTML = `${頁面資料[1]} <span>${目前頁面 === '筆記' ? '✧' : '☀'}</span>`;
  取元素('#page-description').textContent = 頁面資料[2];
  全部元素('[data-page]').forEach((按鈕) => { 按鈕.classList.toggle('active', 按鈕.dataset.page === 目前頁面); if (按鈕.dataset.page === 目前頁面) 按鈕.setAttribute('aria-current', 'page'); else 按鈕.removeAttribute('aria-current'); });
  取元素('#dashboard').hidden = 目前頁面 !== '總覽';
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
  const 選單 = (名稱, 選項) => `<select name="${名稱}">${選項.map(([值, 文字]) => `<option value="${值}">${文字}</option>`).join('')}</select>`;
  let 欄位內容 = 欄位('名稱', '<input name="title" required maxlength="100" placeholder="寫下想記錄的事…">');
  if (類型 === 'task') {
    欄位內容 += 欄位('預定日期（可留白）', '<input type="date" name="date" min="1900-01-01" max="9999-12-31">') + '<div class="form-row">' + 欄位('分類', 選單('category', ['生活', '工作', '個人', '學習'].map((名稱) => [名稱, 名稱]))) + 欄位('優先程度', 選單('priority', [['一般', '一般'], ['優先', '優先處理']])) + '</div>';
  } else if (類型 === 'transaction') {
    欄位內容 += '<div class="form-row">' + 欄位('收支類型', 選單('type', [['expense', '支出'], ['income', '收入']])) + 欄位('金額（新臺幣）', '<input name="amount" type="number" min="0.01" max="999999999" step="0.01" required placeholder="0">') + '</div>' + 欄位('日期', '<input type="date" name="date" required min="1900-01-01" max="9999-12-31">') + 欄位('分類', 選單('category', Object.keys(分類資料).map((名稱) => [名稱, 名稱])));
  } else {
    欄位內容 += 欄位('想記下的內容', '<textarea name="content" required maxlength="5000" placeholder="今天有什麼小小的發現呢？"></textarea>');
  }
  取元素('#form-fields').innerHTML = 欄位內容;
  取元素('#form-error').textContent = '';
  const 表單 = 取元素('#entry-form');
  if (類型 === 'transaction') {
    const 更新分類選單 = () => {
      表單.elements.category.innerHTML = (表單.elements.type.value === 'income' ? ['薪資', '獎金', '其他'] : Object.keys(分類資料)).map((名稱) => `<option value="${名稱}">${名稱}</option>`).join('');
    };
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
window.addEventListener('hashchange', () => 切換頁面(decodeURIComponent(location.hash.slice(1))));

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
  const 基本檢查 = (紀錄) => 紀錄 && 是文字(紀錄.id, 100) && /^[a-zA-Z0-9-]+$/.test(紀錄.id) && 是文字(紀錄.title, 100) && 紀錄.title.trim();
  return 輸入.tasks.every((紀錄) => 基本檢查(紀錄) && typeof 紀錄.done === 'boolean' && (紀錄.date === '' || 是日期(紀錄.date)) && ['生活', '工作', '個人', '學習'].includes(紀錄.category) && ['一般', '優先'].includes(紀錄.priority)) && 輸入.transactions.every((紀錄) => 基本檢查(紀錄) && 是日期(紀錄.date) && ['income', 'expense'].includes(紀錄.type) && typeof 紀錄.amount === 'number' && Number.isFinite(紀錄.amount) && 紀錄.amount > 0 && 紀錄.amount <= 999999999 && (紀錄.type === 'income' ? ['薪資', '獎金', '其他'] : Object.keys(分類資料)).includes(紀錄.category)) && 輸入.notes.every((紀錄) => 基本檢查(紀錄) && 是文字(紀錄.content, 5000) && 是文字(紀錄.updated, 40) && !Number.isNaN(Date.parse(紀錄.updated)));
}

取元素('#import').addEventListener('click', () => 取元素('#import-file').click());
取元素('#import-file').addEventListener('change', async (事件) => {
  const 檔案 = 事件.target.files[0];
  if (!檔案) return;
  try {
    if (檔案.size > 5 * 1024 * 1024) throw new Error('備份過大');
    const 輸入 = JSON.parse(await 檔案.text());
    if (!檢查資料(輸入)) throw new Error('備份格式不符');
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

try {
  const 已儲存資料 = localStorage.getItem(儲存鍵);
  if (已儲存資料) {
    const 讀取資料 = JSON.parse(已儲存資料);
    if (檢查資料(讀取資料)) 資料 = 讀取資料;
    else 提示('儲存資料格式不符，請使用備份匯入。');
  }
} catch { 提示('目前無法讀取本機資料，可使用匯出備份保留紀錄。'); }
取元素('#top-date').textContent = 今天.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' });
切換頁面(decodeURIComponent(location.hash.slice(1)) || '總覽');

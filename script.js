// 页面加载完成后执行所有脚本
// —— 完整替换：确保从文件顶部开始就只有这一个 EnhancedVoiceSystem 类 —— 
// ———— 完整替换：EnhancedVoiceSystem 开始 ————
class EnhancedVoiceSystem {
  constructor() {
    this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    this.configureEngine();
    this.bindEvents();

    this.confidenceThreshold = 0.72;
    this.labels = ['料', '砂量', '砂比', '当前液量'];
    this.permissionGranted = false;
    this.isPressed = false;
    this.initPermission();
  }

  async initPermission() {
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const status = await navigator.permissions.query({ name: 'microphone' });
        if (status.state === 'granted') this.permissionGranted = true;
        status.onchange = () => {
          if (status.state === 'granted') this.permissionGranted = true;
        };
      } catch (e) {
        console.warn('Permissions API 不支持或查询失败', e);
      }
    }
  }

  async requestMicPermissionOnce() {
    if (!this.permissionGranted && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        this.permissionGranted = true;
      } catch (e) {
        console.error('获取麦克风权限失败', e);
      }
    }
  }

  configureEngine() {
    this.recognition.lang = 'zh-CN';
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 5;
  }

  bindEvents() {
    const btn = document.getElementById('micButton');
    // 桌面
    btn.addEventListener('mousedown', async e => {
      e.preventDefault();
      await this.requestMicPermissionOnce();
      this.startRecording();
    });
    btn.addEventListener('mouseup', () => this.stopRecording());
    // 移动端
    btn.addEventListener('touchstart', async e => {
      e.preventDefault();
      await this.requestMicPermissionOnce();
      this.startRecording();
    });
    btn.addEventListener('touchend', e => {
      e.preventDefault();
      this.stopRecording();
    });

    this.recognition.onresult = e => this.processResult(e);
    this.recognition.onerror = e => {
      console.error(e.error);
      document.getElementById('status').textContent = `错误：${e.error}`;
    };
    this.recognition.onend = () => {
      if (this.isPressed) this.recognition.start();
    };
  }

  startRecording() {
    if (!this.permissionGranted) return;
    this.isPressed = true;
    this.recognition.start();
    document.getElementById('status').textContent = '识别中...';
    document.getElementById('micButton').style.backgroundColor = '#1565C0';
  }

  stopRecording() {
    this.isPressed = false;
    this.recognition.stop();
    document.getElementById('status').textContent = '就绪';
    document.getElementById('micButton').style.backgroundColor = '#2196F3';
  }

  processResult(event) {
    // 收集所有最终识别片段
    const segs = [];
    Array.from(event.results).forEach(res => {
      if (res.isFinal) segs.push(res[0].transcript.trim());
    });
    const fullText = segs.join(' ');
    // 选 confidence 最优的备选
    const allAlts = [];
    Array.from(event.results).forEach(res => allAlts.push(...res));
    let best = allAlts.reduce((b, alt) => {
      if (alt.confidence < this.confidenceThreshold) return b;
      const nums = (alt.transcript.match(/\d+(?:\.\d+)?/g) || []).length;
      const hasP = /压力/.test(alt.transcript) ? 1 : 0;
      const score = nums + hasP * 2;
      return (!b || score > b.score) ? { alt, score } : b;
    }, null);
    if (!best) {
      const alt = allAlts.reduce((a, b) => a.confidence > b.confidence ? a : b);
      best = { alt, score: 0 };
    }

    document.getElementById('confidence').textContent =
      `置信度：${(best.alt.confidence * 100).toFixed(1)}%`;

    // 格式化输出
    const out = this.buildDisplay(fullText);
    document.getElementById('resultDisplay').textContent = out || '未识别到有效内容';

    // —— 关键：调用自动填表 —— 
     if (out) {
      this.fillTable(out);
    }
  }

  buildDisplay(text) {
    text = text.replace(/[和及时，、]/g, ' ');
    const raw = text.match(/\d+(?:\.\d+)?|[零一二三四五六七八九十百千万点]+/g) || [];
    const parsed = [];
    raw.forEach(tk => {
      if (/^[零一二三四五六七八九十百千万点]+$/.test(tk)) {
        if (!/[十百千万点]/.test(tk) && tk.length > 1) {
          tk.split('').forEach(c => parsed.push(this._chn2num(c)));
        } else {
          parsed.push(this.parseChineseNumber(tk));
        }
      } else parsed.push(tk);
    });
    let pressure = null;
    const pIdx = parsed.findIndex(v => v === '压力');
    if (pIdx !== -1 && parsed[pIdx+1]) {
      pressure = parsed[pIdx+1];
      parsed.splice(pIdx, 2);
    }
    const parts = [];
    parsed.forEach((val, i) => {
      if (this.labels[i] !== undefined) parts.push(`${this.labels[i]}${val}`);
    });
    if (pressure !== null) parts.push(`压力${pressure}`);
    return parts.join(' ');
  }

  fillTable(text) {
    // 1. 解析各项数据
    const dataMap = {};
    text.split(/\s+/).forEach(token => {
      const m = token.match(/(料|砂量|砂比|当前液量)(.+)/);
      if (m) dataMap[m[1]] = m[2];
    });

    // 2. 找到表格第一个料列为空的行
    const tbody = document.getElementById('dataTable').querySelector('tbody');
    for (let row of tbody.rows) {
      if (row.cells[0].textContent.trim() === '') {
        // 3. 填入对应列
        row.cells[0].textContent = dataMap['料'] || '';
        row.cells[1].textContent = dataMap['砂量'] || '';
        row.cells[2].textContent = dataMap['砂比'] || '';
        row.cells[3].textContent = dataMap['当前液量'] || '';
        // 4. 更新后续计算和高亮
                // —— 新改动：手动触发 input 事件，让表格走原有的更新逻辑 —— 
        const currentCell = row.cells[3]; // “当前液量”那列
        currentCell.dispatchEvent(new Event('input', { bubbles: true }));

        break;
      }
    }
  }

  parseChineseNumber(text) {
    const map = { '零':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9 };
    if (text.includes('点')) {
      const [i, d] = text.split('点');
      return this._parseIntChn(i) + '.' + d.split('').map(c => map[c]||'').join('');
    }
    return this._parseIntChn(text).toString();
  }

  _parseIntChn(chn) {
    const map = { '零':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9 };
    const unit = { '万':10000,'千':1000,'百':100,'十':10 };
    let sec = 0, num = 0;
    for (let c of chn) {
      if (map[c] !== undefined) num = map[c];
      else if (unit[c]) { sec += (num||1)*unit[c]; num = 0; }
    }
    return sec + num;
  }

  _chn2num(c) {
    const map = { '零':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9 };
    return map[c] != null ? map[c].toString() : '';
  }
}
// ———— 完整替换：EnhancedVoiceSystem 结束 ————


window.onload = function() {
  // —— 新增：把语音结果里的“文字+数字”写入到表格中


  /********************** 分割条拖拽及切换功能 **********************/
// 获取容器、左侧面板和右侧面板

const divider = document.querySelector('.divider');
const leftPanel = document.querySelector('.left-panel');
const rightPanel = document.querySelector('.right-panel');
let leftPanelVisible = true;
let isDragging = false;
// 用于水平拖拽
let startX = 0;
let startLeftWidth = 0;
// 用于垂直拖拽
let startY = 0;
let startLeftHeight = 0;

// 开始拖拽：记录初始位置和左侧容器的尺寸，依据布局方式分别记录
divider.addEventListener('mousedown', function(e) {
  isDragging = true;
  const container = document.querySelector(".container");
  if (container.classList.contains("vertical-layout")) {
    // 上下排列时，左侧面板即为上部面板
    startY = e.clientY;
    startLeftHeight = leftPanel.offsetHeight;
    document.body.style.cursor = 'row-resize';
  } else {
    // 左右排列时
    startX = e.clientX;
    startLeftWidth = leftPanel.offsetWidth;
    document.body.style.cursor = 'col-resize';
  }
  e.preventDefault();
});
// 为分割条添加触摸开始事件
divider.addEventListener('touchstart', function(e) {
  isDragging = true;
  const container = document.querySelector(".container");
  if (container.classList.contains("vertical-layout")) {
    startY = e.touches[0].clientY;
    startLeftHeight = leftPanel.offsetHeight;
    document.body.style.cursor = 'row-resize';
  } else {
    startX = e.touches[0].clientX;
    startLeftWidth = leftPanel.offsetWidth;
    document.body.style.cursor = 'col-resize';
  }
  // 阻止默认事件，防止滚动
  e.preventDefault();
});


// 拖拽过程中，根据鼠标移动调整左侧容器的尺寸
document.addEventListener('mousemove', function(e) {
  if (!isDragging) return;
  const container = document.querySelector(".container");
  if (container.classList.contains("vertical-layout")) {
    // 上下排列时，根据竖直方向调整高度
    let dy = e.clientY - startY;
    let newHeight = startLeftHeight + dy;
    // 限制最小高度，例如设为100px
    newHeight = Math.max(newHeight, 100);
    leftPanel.style.height = newHeight + 'px';
  } else {
    // 左右排列时，根据水平方向调整宽度
    let dx = e.clientX - startX;
    let newWidth = startLeftWidth + dx;
    // 限制最小宽度，例如设为100px
    newWidth = Math.max(newWidth, 100);
    leftPanel.style.width = newWidth + 'px';
  }
});
  
// 为文档添加触摸移动事件
document.addEventListener('touchmove', function(e) {
  if (!isDragging) return;
  const container = document.querySelector(".container");
  if (container.classList.contains("vertical-layout")) {
    let dy = e.touches[0].clientY - startY;
    let newHeight = startLeftHeight + dy;
    // 限制最小高度为 100px
    newHeight = Math.max(newHeight, 100);
    leftPanel.style.height = newHeight + 'px';
  } else {
    let dx = e.touches[0].clientX - startX;
    let newWidth = startLeftWidth + dx;
    // 限制最小宽度为 100px
    newWidth = Math.max(newWidth, 100);
    leftPanel.style.width = newWidth + 'px';
  }
  // 阻止默认事件，防止页面滚动
  e.preventDefault();
});


// 拖拽结束时，清除拖拽状态并恢复默认光标
document.addEventListener('mouseup', function(e) {
  if (isDragging) {
    isDragging = false;
    document.body.style.cursor = 'default';
  }
});

  // 为文档添加触摸结束事件
document.addEventListener('touchend', function(e) {
  if (isDragging) {
    isDragging = false;
    document.body.style.cursor = 'default';
  }
});



  // 点击分割条中间较深区域，切换左侧容器的显示/隐藏
divider.addEventListener('click', function(e) {
  // 如果当前处于拖拽状态，则不触发点击事件
  if (isDragging) return;
  
  const container = document.querySelector(".container");
  // 判断当前排列方式
  if (container.classList.contains("vertical-layout")) {
    // 当容器为上下排列时，分割条为水平条，检测点击的水平方向位置
    const dividerWidth = divider.offsetWidth;
    const bandWidth = 38; // 中心区域宽度，约1cm
    const bandLeft = dividerWidth / 2 - bandWidth / 2;
    const bandRight = dividerWidth / 2 + bandWidth / 2;
    const clickX = e.offsetX;
    
    if (clickX >= bandLeft && clickX <= bandRight) {
      if (leftPanelVisible) {
        leftPanel.style.display = 'none';
        leftPanelVisible = false;
      } else {
        leftPanel.style.display = 'block';
        // 恢复默认高度，假设默认高度为300px（可根据实际情况调整）
        leftPanel.style.height = '300px';
        leftPanelVisible = true;
      }
    }
  } else {
    // 当容器为左右排列时，依然按原来的逻辑检测垂直方向点击位置
    const dividerHeight = divider.offsetHeight;
    const bandHeight = 38; // 中心区域高度，约1cm
    const bandTop = dividerHeight / 2 - bandHeight / 2;
    const bandBottom = dividerHeight / 2 + bandHeight / 2;
    const clickY = e.offsetY;
    
    if (clickY >= bandTop && clickY <= bandBottom) {
      if (leftPanelVisible) {
        leftPanel.style.display = 'none';
        leftPanelVisible = false;
      } else {
        leftPanel.style.display = 'block';
        leftPanel.style.width = '300px'; // 恢复默认宽度
        leftPanelVisible = true;
      }
    }
  }
});

// “排列”按钮功能：点击切换容器的排列方式（左右排列 ↔ 上下排列）
document.getElementById("toggleLayoutBtn").addEventListener("click", function() {
  const container = document.querySelector(".container");

  // 切换前重置左右/上下容器的内联尺寸
  leftPanel.style.width = "";
  leftPanel.style.height = "";
  rightPanel.style.width = "";
  rightPanel.style.height = "";

  // 切换布局方式：如果当前为垂直布局，则移除 vertical-layout 类；否则添加该类
  container.classList.toggle("vertical-layout");
});



// 为井筒容积输入框添加 change 事件监听，确保手动修改时刷新数据
document.getElementById('wellboreVolume').addEventListener('change', updateTotalVolume);
document.getElementById('groundVolume').addEventListener('change', updateTotalVolume);



  /********************** 原有功能代码 **********************/
  // 定义撤销操作栈
  let undoStack = [];
  const MAX_UNDO = 20;
  let selectedRow = null;
  let longPressTimer = null;

  // ---------------- 数据持久化 ----------------
  function saveData() {
    const volumeData = {
      groundVolume: document.getElementById('groundVolume').value,
      wellboreVolume: document.getElementById('wellboreVolume').value,
      totalVolume: document.getElementById('totalVolume').value,
      tableHTML: document.getElementById('dataTable').querySelector('tbody').innerHTML,
      wellName: document.getElementById('wellName').innerHTML
    };
    localStorage.setItem('appData', JSON.stringify(volumeData));
  }

  function loadData() {
    const data = localStorage.getItem('appData');
    if (data) {
      const volumeData = JSON.parse(data);
      document.getElementById('groundVolume').value = volumeData.groundVolume;
      document.getElementById('wellboreVolume').value = volumeData.wellboreVolume;
      document.getElementById('totalVolume').value = volumeData.totalVolume;
      document.getElementById('dataTable').querySelector('tbody').innerHTML = volumeData.tableHTML;
      document.getElementById('wellName').innerHTML = volumeData.wellName;
      attachLongPressEventsToAllRows();
    }
  }

  // ---------------- 导出功能 ----------------
  function exportExcel() {
    let csvContent = "";
    const table = document.getElementById('dataTable');
    for (let row of table.rows) {
      let rowData = [];
      for (let cell of row.cells) {
        let cellText = cell.textContent.replace(/(\r\n|\n|\r)/gm, " ").replace(/,/g, " ");
        rowData.push('"' + cellText + '"');
      }
      csvContent += rowData.join(",") + "\n";
    }
    csvContent = "\uFEFF" + csvContent;
    const tableTitle = document.getElementById('wellName').innerText.trim() || "导出数据";
    const dateStr = new Date().toISOString().split("T")[0];
    const fileName = `${tableTitle}_${dateStr}.csv`
      .replace(/[^a-zA-Z0-9\u4e00-\u9fa5-_]/g, '-')
      .replace(/\s+/g, '_');

    if (window.plus) {
      plus.io.requestFileSystem(plus.io.PUBLIC_DOWNLOADS, (fs) => {
        fs.root.getFile(fileName, { create: true }, (fileEntry) => {
          fileEntry.createWriter((writer) => {
            writer.onwriteend = () => plus.nativeUI.toast(`文件已保存至下载目录：${fileName}`);
            writer.onerror = (e) => plus.nativeUI.alert(`写入失败：${e.message}`);
            writer.write(new Blob([csvContent], { type: 'text/csv;charset=utf-8' }));
          }, (e) => plus.nativeUI.alert(`创建Writer失败：${e.message}`));
        }, (e) => plus.nativeUI.alert(`创建文件失败：${e.message}`));
      }, (e) => plus.nativeUI.alert(`访问文件系统失败：${e.message}`));
    } else {
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  // ---------------- 全局更新与计算 ----------------
  function updateAllRows() {
    const totalVolume = parseFloat(document.getElementById('totalVolume').value) || 0;
    const groundVolumeVal = parseFloat(document.getElementById('groundVolume').value) || 0;
    const tableBody = document.getElementById('dataTable').querySelector('tbody');
    const rows = tableBody.rows;
    if (rows.length === 0) return;

    let benchmark = 0;
    // 遍历所有行计算“当前液量”的最大值作为基准
    for (let i = 0; i < rows.length; i++) {
      const cellText = rows[i].cells[3].textContent.trim();
      if (cellText !== "") {
        const currentLiquid = parseFloat(cellText);
        if (currentLiquid > benchmark) {
          benchmark = currentLiquid;
        }
      }
    }
    // 更新各行的到达液量、阶段液量以及背景色
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const currentText = row.cells[3].textContent.trim();
      if (currentText === "") {
        row.cells[4].textContent = "";
        row.cells[5].textContent = "";
        row.style.backgroundColor = 'white';
        continue;
      }
      const currentLiquid = parseFloat(currentText);
      const arrivalLiquid = totalVolume + currentLiquid;
      row.cells[4].textContent = arrivalLiquid.toFixed(1);
      if (i < rows.length - 1) {
        let nextRowCurrentText = rows[i + 1].cells[3].textContent.trim();
        if (nextRowCurrentText === "") {
          row.cells[5].textContent = "0.0";
        } else {
          let nextCurrentLiquid = parseFloat(nextRowCurrentText);
          let phaseLiquid = nextCurrentLiquid - currentLiquid;
          row.cells[5].textContent = phaseLiquid.toFixed(1);
        }
      } else {
        row.cells[5].textContent = "0.0";
      }
      row.style.backgroundColor = 'white';
      if ((currentLiquid + groundVolumeVal) <= benchmark) {
        row.style.backgroundColor = 'yellow';
      }
    }
    let eligibleIndexes = [];
    for (let i = 0; i < rows.length; i++) {
      const cellText = rows[i].cells[3].textContent.trim();
      if (cellText === "") continue;
      const arrivalLiquid = parseFloat(rows[i].cells[4].textContent);
      if (arrivalLiquid <= benchmark) {
        eligibleIndexes.push(i);
      }
    }
    if (eligibleIndexes.length > 0) {
      const latestEligibleIndex = eligibleIndexes[eligibleIndexes.length - 1];
      rows[latestEligibleIndex].style.backgroundColor = 'red';
    }
    for (let i = 0; i < rows.length - 1; i++) {
  const arrivalLiquid = parseFloat(rows[i].cells[4].textContent) || 0;
  const phaseLiquid = parseFloat(rows[i].cells[5].textContent) || 0;
  if ((arrivalLiquid + phaseLiquid) <= benchmark) {
    rows[i].style.backgroundColor = 'white';
  }
}
    for (let i = 0; i < rows.length; i++) {
      for (let j = 0; j < rows[i].cells.length; j++) {
        rows[i].cells[j].setAttribute("contenteditable", "true");
      }
    }
    saveData();
    updateWellboreAnimation();
  }

  // 根据管汇和井筒数据计算总容积
  function updateTotalVolume() {
    const guanhui = parseFloat(document.getElementById('groundVolume').value) || 0;
    const jingtong = parseFloat(document.getElementById('wellboreVolume').value) || 0;
    const totalVolume = guanhui + jingtong;
    document.getElementById('totalVolume').value = totalVolume.toFixed(1);
    updateAllRows();
  }

  // ---------------- 井筒动画更新函数 ----------------
  function updateWellboreAnimation() {
    const wellboreVolumeInput = document.getElementById('wellboreVolume').value;
    const wellboreVolume = parseFloat(wellboreVolumeInput);
    const container = document.getElementById('wellboreAnimation');
    container.innerHTML = '';
    if (!wellboreVolume || wellboreVolume <= 0) {
      return;
    }
    const containerHeight = container.clientHeight;
    const groundVolume = parseFloat(document.getElementById('groundVolume').value) || 0;
    const allRows = document.getElementById('dataTable').querySelectorAll('tbody tr');
    let maxCurrent = 0;
    allRows.forEach(row => {
      let currentText = row.cells[3].textContent.trim();
      if (currentText) {
        let currentLiquid = parseFloat(currentText);
        if (currentLiquid > maxCurrent) {
          maxCurrent = currentLiquid;
        }
      }
    });
    let segments = [];
    allRows.forEach(row => {
      const bg = row.style.backgroundColor;
      if (bg === 'yellow' || bg === 'red') {
        let stageText = row.cells[5].textContent.trim();
        if (!stageText) return;
        let stageLiquid = parseFloat(stageText);
        if (isNaN(stageLiquid)) return;
        let arrivalText = row.cells[4].textContent.trim();
        let arrivalLiquid = arrivalText ? parseFloat(arrivalText) : 0;
        let ratio = 0;
        if (bg === 'red') {
          ratio = (stageLiquid - (maxCurrent - arrivalLiquid)) / wellboreVolume;
          if (ratio < 0) ratio = 0;
        } else if (bg === 'yellow') {
          let currentLiquid = parseFloat(row.cells[3].textContent.trim());
          let diff = maxCurrent - currentLiquid - groundVolume;
          if (diff < stageLiquid) {
            ratio = diff / wellboreVolume;
          } else {
            ratio = stageLiquid / wellboreVolume;
          }
        }
        let segHeight = ratio * containerHeight;
        let percent = (ratio * 100).toFixed(1) + '%';
        let annotation = row.cells[0].textContent.trim() + "/" + row.cells[2].textContent.trim() + "_" + percent;
        segments.push({
          height: segHeight,
          color: bg,
          annotation: annotation
        });
      }
    });
    segments.reverse();
    segments.forEach(seg => {
      let segDiv = document.createElement('div');
      segDiv.className = 'wellbore-segment';
      segDiv.style.height = seg.height + 'px';
      segDiv.style.backgroundColor = seg.color;
      segDiv.style.position = 'relative';
      // 如果当前动画段颜色为红色，则添加额外的类 red-segment
  		 if (seg.color === 'red') {
    	segDiv.classList.add('red-segment');
  		 }
      let annSpan = document.createElement('span');
      annSpan.className = 'segment-annotation';
      annSpan.innerText = seg.annotation;
      segDiv.appendChild(annSpan);
      container.appendChild(segDiv);
    });
  }

  // ---------------- “井筒”数据对话框相关函数 ----------------
  window.openWellboreDialog = function() {
    document.getElementById('wellboreDialog').style.display = 'block';
  };

  function closeWellboreDialog() {
    document.getElementById('wellboreDialog').style.display = 'none';
  }
  window.closeWellboreDialog = closeWellboreDialog;

  // 绑定“计算”按钮事件，计算公式为 π×段深×((直径-壁厚×2)/2000)²，结果保留1位小数
  document.getElementById('calcWellboreBtn').addEventListener('click', function() {
    const depth = parseFloat(document.getElementById('sectionDepth').value) || 0;
    const diameter = parseFloat(document.getElementById('diameter').value) || 0;
    const wallThickness = parseFloat(document.getElementById('wallThickness').value) || 0;
    let result = 3.1415926 * depth * Math.pow((diameter - wallThickness * 2) / 2000, 2);
    result = result.toFixed(1);
    document.getElementById('wellboreVolume').value = result;
    // 移除只读属性，允许用户进一步编辑
    document.getElementById('wellboreVolume').removeAttribute("readonly");
    updateTotalVolume();
    closeWellboreDialog();
  });

  // ---------------- 表格事件及按钮绑定 ----------------
  document.getElementById('dataTable').addEventListener('input', function(e) {
    const target = e.target;
    if (target.tagName.toLowerCase() === 'td' && target.cellIndex === 3) {
      updateAllRows();
    }
  });

  document.getElementById('exportBtn').addEventListener('click', exportExcel);

  document.getElementById('resetBtn').addEventListener('click', function() {
    if (confirm("是否重置数据？")) {
      localStorage.removeItem('appData');
      document.getElementById('groundVolume').value = "";
      document.getElementById('wellboreVolume').value = "";
      document.getElementById('totalVolume').value = "";
      document.getElementById('dataTable').querySelector('tbody').innerHTML =
        '<tr><td contenteditable="true"></td>' +
        '<td contenteditable="true"></td>' +
        '<td contenteditable="true"></td>' +
        '<td contenteditable="true"></td>' +
        '<td contenteditable="true"></td>' +
        '<td contenteditable="true"></td>' +
        '<td contenteditable="true"></td></tr>';
      document.getElementById('wellName').innerHTML = "____ 井____段压裂施工";
      updateAllRows();
    }
  });

  document.getElementById('addRowBtn').addEventListener('click', function() {
    pushUndoState();
    const tableBody = document.getElementById('dataTable').querySelector('tbody');
    const newRow = tableBody.insertRow();
    for (let i = 0; i < 7; i++) {
      const newCell = newRow.insertCell(i);
      newCell.contentEditable = true;
      newCell.innerHTML = '';
    }
    attachLongPressEvent(newRow);
    updateAllRows();
  });

  document.getElementById('deleteRowBtn').addEventListener('click', function() {
    if (selectedRow) {
      pushUndoState();
      selectedRow.parentNode.removeChild(selectedRow);
      selectedRow = null;
      updateAllRows();
    } else {
      alert("请长按选中一行以删除。");
    }
  });

  document.getElementById('undoBtn').addEventListener('click', function() {
    restoreUndoState();
  });

  // ---------------- 撤销操作函数 ----------------
  function pushUndoState() {
    const tableBody = document.getElementById('dataTable').querySelector('tbody');
    undoStack.push(tableBody.innerHTML);
    if (undoStack.length > MAX_UNDO) {
      undoStack.shift();
    }
  }

  function restoreUndoState() {
    if (undoStack.length > 0) {
      const tableBody = document.getElementById('dataTable').querySelector('tbody');
      tableBody.innerHTML = undoStack.pop();
      attachLongPressEventsToAllRows();
      updateAllRows();
    }
  }

  // ---------------- 长按选中行功能 ----------------
  function attachLongPressEventsToAllRows() {
    const tableBody = document.getElementById('dataTable').querySelector('tbody');
    Array.from(tableBody.rows).forEach(row => {
      attachLongPressEvent(row);
    });
  }

  function attachLongPressEvent(row) {
    row.addEventListener('touchstart', startLongPress);
    row.addEventListener('touchend', cancelLongPress);
    row.addEventListener('mousedown', startLongPress);
    row.addEventListener('mouseup', cancelLongPress);
  }

  function startLongPress(e) {
    const row = e.currentTarget;
    longPressTimer = setTimeout(function() {
      const tableBody = document.getElementById('dataTable').querySelector('tbody');
      Array.from(tableBody.rows).forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
      selectedRow = row;
    }, 800);
  }

  function cancelLongPress(e) {
    clearTimeout(longPressTimer);
  }

  // 初始化数据、事件绑定及计算更新
  loadData();
  attachLongPressEventsToAllRows();
  updateTotalVolume();
    // 新增：启动按住录入功能
  new EnhancedVoiceSystem();

};

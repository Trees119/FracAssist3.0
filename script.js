let systemTimeTimer = null;

function updateSystemTime() {
  const now = new Date();
  document.getElementById('systemTime').value =
    now.toLocaleDateString() + ' ' +
    now.toLocaleTimeString('zh-CN', { hour12: false });
}
// ======= 总液量动态更新定时器 =======
let totalLiquidTimer = null;
// 每秒更新一次总液量并写入表格当前液量
function updateDynamicTotalLiquid() {
  // 1. 取排量（单位 L/min）和现有总液量（L）
  const disp = parseFloat(document.getElementById('displacement').value) || 0;
  const totalInput = document.getElementById('totalLiquid');
  let total = parseFloat(totalInput.value) || 0;

  // 2. 增量=排量/60 （L/sec）
  total += disp / 60;
  total = parseFloat(total.toFixed(3));      // 保留三位小数，提高精度
  totalInput.value = total;                   // 更新输入框

  // 3. 找到第一行：料、砂量、砂比 都 为空
  const rows = document.querySelectorAll('#dataTable tbody tr');
  for (let row of rows) {
    const c0 = row.cells[0].textContent.trim();
    const c1 = row.cells[1].textContent.trim();
    const c2 = row.cells[2].textContent.trim();
    if (c0 === '' && c1 === '' && c2 === '') {
      // 把计算好的总液量写入“当前液量”列（第4列，索引3）
      row.cells[3].textContent = total.toFixed(1);
      // 触发 input 事件，保证后续逻辑（updateAllRows）执行
      row.cells[3].dispatchEvent(new Event('input', { bubbles: true }));
      break;
    }
  }
}


// ======= 系统时间更新控制结束 =======
/* ==================== EnhancedVoiceSystem with Press-Release Continuous Recognition ==================== */
// ✅ 离线语音识别系统（替换原来的 EnhancedVoiceSystem）
import { recognizeOffline } from './offlineVoice.js';

class EnhancedVoiceSystem {
  constructor() {
    this.btn = document.getElementById('micButton');
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;

    this.bindEvents();
  }

  bindEvents() {
    this.btn.addEventListener('mousedown', () => this.startRecording());
    this.btn.addEventListener('mouseup', () => this.stopRecording());
    this.btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.startRecording();
    });
    this.btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.stopRecording();
    });
  }

  async startRecording() {
    if (this.isRecording) return;
    this.isRecording = true;

    document.getElementById('status').textContent = '正在录音...';
    this.btn.style.backgroundColor = '#1565C0';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        this.audioChunks.push(e.data);
      };

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        const text = await recognizeOffline(audioBlob);
        this.handleResult(text);
      };

      this.mediaRecorder.start();
    } catch (err) {
      console.error('麦克风权限失败', err);
      document.getElementById('status').textContent = '麦克风权限失败';
      this.btn.style.backgroundColor = '#2196F3';
      this.isRecording = false;
    }
  }

  stopRecording() {
    if (!this.isRecording) return;
    this.isRecording = false;
    document.getElementById('status').textContent = '识别中...';
    this.btn.style.backgroundColor = '#2196F3';
    this.mediaRecorder.stop();
  }

  handleResult(text) {
    document.getElementById('status').textContent = '就绪';
    document.getElementById('resultDisplay').textContent = text;
    if (text) this.fillTable(text);
  }

  fillTable(text) {
    const dataMap = {};
    text.split(/\s+/).forEach(token => {
      const m = token.match(/(料|砂量|砂比|当前液量)(.+)/);
      if (m) dataMap[m[1]] = m[2];
    });

    const tbody = document.querySelector('#dataTable tbody');
    for (let row of tbody.rows) {
      if (!row.cells[0].textContent.trim()) {
        ['料', '砂量', '砂比', '当前液量'].forEach((lbl, i) => {
          row.cells[i].textContent = dataMap[lbl] || '';
        });
        row.cells[3].dispatchEvent(new Event('input', { bubbles: true }));
        break;
      }
    }
  }
}


// 页面初始化
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
      document.getElementById('displacement').value = "";
      document.getElementById('totalLiquid').value = "";
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
    if (totalLiquidTimer) {
  clearInterval(totalLiquidTimer);
  totalLiquidTimer = null;
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
  // 系统时间更新
function updateSystemTime() {
  const now = new Date();
  document.getElementById('systemTime').value = 
    now.toLocaleDateString() + ' ' + 
    now.toLocaleTimeString('chinese', { hour12: false });
}


// 排量输入处理
document.getElementById('displacement').addEventListener('change', function() {
  this.value = Math.max(0, parseFloat(this.value) || 0).toFixed(1);
});

// 总液量输入处理
document.getElementById('totalLiquid').addEventListener('change', function() {
  this.value = Math.max(0, parseInt(this.value) || 0);
});

// 开始按钮事件
document.getElementById('startBtn').addEventListener('click', function() {
  // 如果已有定时器，先清掉，防止重复启动
  if (totalLiquidTimer) {
    clearInterval(totalLiquidTimer);
  }
  // 立即执行一次，然后每秒执行
  updateDynamicTotalLiquid();
  totalLiquidTimer = setInterval(updateDynamicTotalLiquid, 1000);
});

// ======= 新增：水平井功能 =======
 window.closeHorizontalDialog = function() {
    document.getElementById('horizontalWellDialog').style.display = 'none';
  };

  // 新增：绑定“关闭”按钮
  document.getElementById('closeHorizontalBtn').addEventListener('click', closeHorizontalDialog);

// 打开水平井对话框
document.getElementById('horizontalWellBtn').addEventListener('click', () => {
  document.getElementById('horizontalWellDialog').style.display = 'block';
});

// 关闭对话框函数
function closeHorizontalDialog() {
  document.getElementById('horizontalWellDialog').style.display = 'none';
}
window.closeHorizontalDialog = function() {
  document.getElementById('horizontalWellDialog').style.display = 'none';
};
// 点击“完成”后，计算比例并定位“A靶”
document.getElementById('completeHorizontalBtn').addEventListener('click', () => {
  const segDepth = parseFloat(document.getElementById('segmentDepthHW').value) || 0;
  const tgtDepth = parseFloat(document.getElementById('targetDepthHW').value) || 0;
  if (segDepth <= 0 || tgtDepth < 0) {
    alert('请填写有效的段深（>0）和 A 靶深（≥0）');
    return;
  }

// ====== “完成”按钮逻辑（替换原有插入段落） ======
document.getElementById('completeHorizontalBtn').addEventListener('click', () => {
  const segDepth = parseFloat(document.getElementById('segmentDepthHW').value) || 0;
  const tgtDepth = parseFloat(document.getElementById('targetDepthHW').value) || 0;
  if (segDepth <= 0 || tgtDepth < 0) {
    alert('请填写有效的段深（>0）和 A 靶深（≥0）');
    return;
  }
  const ratio = tgtDepth / segDepth;

  // 获取动画容器 & 左侧面板
  const container = document.getElementById('wellboreAnimation');
  const panel = container.closest('.left-panel');

  // 动画容器在面板中的相对位置
  const contRect = container.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const offsetTop = contRect.top - panelRect.top;    // 容器顶端到面板顶端的距离

  // 计算标记位置：从动画顶端开始，向下 ratio * 高度
  const y = offsetTop + ratio * container.clientHeight;

  // 移除旧标记
  panel.querySelectorAll('.horizontal-marker').forEach(el => el.remove());

  // 创建新标记并插入到 panel
  const marker = document.createElement('div');
  marker.className = 'horizontal-marker';
  marker.style.top = `${y}px`;                       // 相对于 panel
  marker.style.left = `${contRect.left - panelRect.left - 30}px`; // 紧贴容器左侧，留 20px 间距
  marker.innerText = 'A靶';
  panel.appendChild(marker);

  closeHorizontalDialog();
});
});

// ====== “重置”按钮逻辑中，也要清除标记 ======
document.getElementById('resetBtn').addEventListener('click', () => {
  setTimeout(() => {
    document.querySelectorAll('.horizontal-marker').forEach(el => el.remove());
  }, 0);
});
  

  // 初始化数据、事件绑定及计算更新
  loadData();
  attachLongPressEventsToAllRows();
  updateTotalVolume();
    // 新增：启动按住录入功能
  new EnhancedVoiceSystem();
  setInterval(updateSystemTime, 1000);
};


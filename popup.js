document.addEventListener('DOMContentLoaded', function() {
  // 密钥显示/隐藏功能
  document.getElementById('toggle-api-key').addEventListener('click', function() {
    const input = document.getElementById('quick-api-key');
    const eyeIcon = document.getElementById('eye-icon');
    const eyeOffIcon = document.getElementById('eye-off-icon');
    
    if (input.type === 'password') {
      input.type = 'text';
      eyeIcon.style.display = 'none';
      eyeOffIcon.style.display = 'block';
    } else {
      input.type = 'password';
      eyeIcon.style.display = 'block';
      eyeOffIcon.style.display = 'none';
    }
  });

  // 获取当前标签页的URL并显示
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    document.getElementById('url-display').textContent = currentTab.url;
  });

  // 检查DeepSeek API配置
  checkApiConfiguration();
  
  // 加载已保存的API密钥
  chrome.storage.sync.get(['apiKey'], function(result) {
    if (result.apiKey) {
      document.getElementById('quick-api-key').value = result.apiKey;
    }
  });
  
  // 保存API密钥按钮
  document.getElementById('save-api-key').addEventListener('click', function() {
    const apiKey = document.getElementById('quick-api-key').value.trim();
    if (!apiKey) {
      const statusMessage = document.getElementById('status-message');
      statusMessage.textContent = '请输入API密钥！';
      statusMessage.style.color = '#f44336';
      setTimeout(function() {
        statusMessage.textContent = '';
      }, 2000);
      return;
    }
    
    chrome.storage.sync.set({apiKey: apiKey}, function() {
      const statusMessage = document.getElementById('status-message');
      statusMessage.textContent = 'API密钥已保存！';
      statusMessage.style.color = '#4caf50';
      setTimeout(function() {
        statusMessage.textContent = '';
      }, 2000);
      
      // 更新API状态显示
      checkApiConfiguration();
    });
  });
  
  // 打开设置页面按钮
  document.getElementById('open-options-btn').addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
});

// 检查DeepSeek API配置
function checkApiConfiguration() {
  const apiStatusElement = document.getElementById('api-status');
  
  chrome.storage.sync.get(['apiKey', 'elementSelector'], function(result) {
    if (result.apiKey) {
      apiStatusElement.textContent = 'API密钥已配置';
      apiStatusElement.classList.add('configured');
      
      // 显示元素选择器信息
      if (result.elementSelector) {
        apiStatusElement.textContent += ` | 选择器: ${result.elementSelector.substring(0, 15)}...`;
      }
    } else {
      apiStatusElement.textContent = '未配置 API 密钥';
      apiStatusElement.classList.remove('configured');
    }
  });
}

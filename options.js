// 保存选项到 Chrome 存储
function saveOptions() {
  const apiKey = document.getElementById('api-key').value;
  const apiModel = document.getElementById('api-model').value || 'deepseek-chat';
  const apiPrompt = document.getElementById('api-prompt').value || '请为以下内容生成一个吸引人的标题：';
  const elementSelector = document.getElementById('element-selector').value;
  const buttonPosition = document.getElementById('button-position').value;
  
  chrome.storage.sync.set(
    {
      apiKey: apiKey,
      apiModel: apiModel,
      apiPrompt: apiPrompt,
      elementSelector: elementSelector,
      buttonPosition: buttonPosition
    },
    function() {
      // 更新状态显示
      const status = document.getElementById('status');
      status.textContent = '设置已保存！';
      status.className = 'success';
      status.style.display = 'block';
      
      // 3秒后隐藏状态信息
      setTimeout(function() {
        status.style.display = 'none';
      }, 3000);
    }
  );
}

// 从 Chrome 存储中恢复选项
function restoreOptions() {
  chrome.storage.sync.get(
    {
      // 默认值
      apiKey: '',
      apiModel: 'deepseek-chat',
      apiPrompt: '请为以下内容生成一个吸引人的标题：',
      elementSelector: 'input.flex.h-10.w-full.rounded-md.border.border-input',
      buttonPosition: 'right'
    },
    function(items) {
      document.getElementById('api-key').value = items.apiKey;
      document.getElementById('api-model').value = items.apiModel;
      document.getElementById('api-prompt').value = items.apiPrompt;
      document.getElementById('element-selector').value = items.elementSelector;
      document.getElementById('button-position').value = items.buttonPosition;
    }
  );
}

// 验证API密钥格式
function validateApiKey(apiKey) {
  // 这里可以添加更具体的验证逻辑
  return apiKey && apiKey.length > 5;
}

// 当页面加载完成时，恢复选项
document.addEventListener('DOMContentLoaded', restoreOptions);

// 当保存按钮被点击时，保存选项
document.getElementById('save').addEventListener('click', function() {
  const apiKey = document.getElementById('api-key').value;
  
  if (!validateApiKey(apiKey)) {
    const status = document.getElementById('status');
    status.textContent = 'API密钥格式不正确！';
    status.className = 'error';
    status.style.display = 'block';
    return;
  }
  
  saveOptions();
});

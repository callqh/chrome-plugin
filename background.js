// 监听插件安装事件
chrome.runtime.onInstalled.addListener(function() {
  console.log('简易助手插件已安装');
  
  // 初始化存储
  chrome.storage.sync.get(['notes', 'apiKey', 'apiModel', 'apiPrompt', 'elementSelector', 'buttonPosition'], function(result) {
    const defaults = {
      notes: '',
      apiKey: '',
      apiModel: 'deepseek-chat',
      apiPrompt: '请为以下内容生成一个吸引人的标题：',
      elementSelector: 'input.flex.h-10.w-full.rounded-md.border.border-input',
      buttonPosition: 'right'
    };
    
    // 设置默认值
    for (const key in defaults) {
      if (result[key] === undefined) {
        const update = {};
        update[key] = defaults[key];
        chrome.storage.sync.set(update);
      }
    }
  });
});

// 注释：已删除 generateTitleWithDeepSeek 函数，因为已由 callDeepSeekAPI 功能替代

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'notification') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon128.png',
      title: '简易助手',
      message: request.message
    });
    sendResponse({success: true});
  } else if (request.action === 'generateTitle') {
    // 将消息转发给当前活动标签页
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'generateTitle'}, function(response) {
          sendResponse(response);
        });
        return true; // 保持消息通道打开以便异步响应
      } else {
        sendResponse({success: false, message: '未找到活动标签页'});
      }
    });
    return true; // 保持消息通道打开以便异步响应
  } else if (request.action === 'callDeepSeekAPI') {
    // 直接调用DeepSeek API
    console.log('收到callDeepSeekAPI请求:', request);
    
    // 验证请求参数
    if (!request.apiKey) {
      sendResponse({error: '缺少API密钥'});
      return true;
    }
    
    // 准备API请求
    const apiUrl = 'https://api.deepseek.com/v1/chat/completions';
    const model = request.model || 'deepseek-chat';
    const prompt = request.prompt || '请为以下内容生成一个简洁、准确的标题，完全基于内容本身，不要添加任何不在内容中的信息。标题必须在10个字以内。';
    
    console.log('发送DeepSeek API请求，模型:', model);
    
    // 发送API请求
    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${request.apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { 
            role: 'system', 
            content: '你是一个专业的标题生成助手，擅长生成简洁、准确的标题。你生成的标题必须完全基于用户提供的内容，不要添加任何不在内容中的信息。标题必须简洁，不超过10个汉字。直接返回标题，不要添加其他解释或引号。' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,  // 降低温度以获得更精确的结果
        max_tokens: 50     // 限制输出长度
      })
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(errorData => {
          console.error('DeepSeek API错误:', errorData);
          throw new Error(`API错误: ${errorData.error?.message || response.statusText}`);
        });
      }
      return response.json();
    })
    .then(data => {
      console.log('DeepSeek API响应:', data);
      let generatedTitle = data.choices[0].message.content.trim();
      
      // 处理生成的标题，去除可能的引号和多余文本
      generatedTitle = generatedTitle.replace(/["''“”《》]/g, '');
      
      // 如果标题中包含“标题”或“标题：”，则去除
      generatedTitle = generatedTitle.replace(/(标题：?|标题是：?)/g, '');
      
      sendResponse({title: generatedTitle});
    })
    .catch(error => {
      console.error('DeepSeek API调用错误:', error);
      sendResponse({error: error.message || '调用DeepSeek API时发生错误'});
    });
    
    return true; // 保持消息通道打开以便异步响应
  }
  return true;
});

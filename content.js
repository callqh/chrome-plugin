// 获取用户配置
async function getUserConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      {
        apiKey: '',
        allowedDomains: 'https://youmind.ai',
        elementSelector: 'input.flex.h-10.w-full.rounded-md.border.border-input',
        buttonPosition: 'right'
      },
      function(result) {
        resolve(result);
      }
    );
  });
}

// 检查当前网址是否在允许列表中
function isAllowedDomain(allowedDomainsStr) {
  // 如果没有设置允许的域名，默认只允许 youmind.ai
  if (!allowedDomainsStr) {
    allowedDomainsStr = 'https://youmind.ai';
  }
  
  // 将允许的域名字符串分割为数组
  const allowedDomains = allowedDomainsStr.split('\n').map(domain => domain.trim()).filter(domain => domain);
  
  // 获取当前页面的 URL
  const currentUrl = window.location.href;
  
  // 检查当前 URL 是否匹配任何允许的域名
  return allowedDomains.some(domain => {
    // 如果域名包含通配符 *，则使用正则表达式匹配
    if (domain.includes('*')) {
      const regexPattern = domain.replace(/\./g, '\\.').replace(/\*/g, '.*');
      const regex = new RegExp('^' + regexPattern + '$');
      return regex.test(currentUrl);
    }
    // 否则检查当前 URL 是否以允许的域名开头
    return currentUrl.startsWith(domain);
  });
}

// 显示通知消息
function showNotification(message, type = 'info') {
  // 删除现有通知
  const existingNotification = document.getElementById('title-generator-notification');
  if (existingNotification) {
    document.body.removeChild(existingNotification);
  }
  
  // 创建新通知
  const notification = document.createElement('div');
  notification.id = 'title-generator-notification';
  notification.textContent = message;
  notification.style.position = 'fixed';
  notification.style.bottom = '20px';
  notification.style.right = '20px';
  notification.style.padding = '10px 15px';
  notification.style.borderRadius = '4px';
  notification.style.color = 'white';
  notification.style.fontSize = '14px';
  notification.style.zIndex = '10000';
  notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  
  // 根据类型设置样式
  if (type === 'success') {
    notification.style.backgroundColor = youmindTheme.notificationSuccess;
  } else if (type === 'error') {
    notification.style.backgroundColor = youmindTheme.notificationError;
  } else if (type === 'warning') {
    notification.style.backgroundColor = youmindTheme.notificationWarning;
  } else {
    notification.style.backgroundColor = youmindTheme.notificationInfo;
  }
  
  // 添加到页面
  document.body.appendChild(notification);
  
  // 自动隐藏
  setTimeout(() => {
    if (document.body.contains(notification)) {
      document.body.removeChild(notification);
    }
  }, 3000);
}

// 监听来自弹出窗口的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
   if (request.action === 'generateTitle') {
    // 生成标题功能
    getUserConfig().then(async config => {
      // 先尝试查找现有输入框
      let inputElement = document.querySelector(config.elementSelector);
      
      // 如果找不到，尝试使用更智能的方法查找
      if (!inputElement) {
        const found = await findAndProcessInputElement();
        if (found) {
          // 重新查询输入框，因为可能已经找到了
          inputElement = document.querySelector(config.elementSelector);
          if (!inputElement) {
            // 如果仍然找不到，尝试使用常见选择器
            const commonSelectors = [
              'input[type="text"]', 
              'input:not([type])', 
              'textarea',
              'input.ant-input',
              '.ant-input',
              'input.form-control',
              '.form-control'
            ];
            
            for (const selector of commonSelectors) {
              const elements = document.querySelectorAll(selector);
              for (const el of elements) {
                if (el.offsetParent !== null && el.offsetWidth > 50 && el.offsetHeight > 20) {
                  inputElement = el;
                  break;
                }
              }
              if (inputElement) break;
            }
          }
        }
      }
      
      // 如果还是找不到输入框，尝试找到contenteditable元素
      let originalText = '';
        // 专门针对YouMind编辑器的内容区域元素
        // 尝试多种选择器
        const youmindSelectors = [
          'div[contenteditable="true"][role="textbox"][translate="no"].tiptap.ProseMirror',
          'div.tiptap.ProseMirror[contenteditable="true"]',
          '.tiptap.ProseMirror',
          'div[role="textbox"].tiptap'
        ];
        
        let youmindContentElement = null;
        
        // 尝试每个选择器
        for (const selector of youmindSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            youmindContentElement = element;
            break;
          }
        }
        
        // 存储原始的inputElement引用
        const originalInputElement = inputElement;
        
        // 如果找到了YouMind编辑器的内容区域元素
        if (youmindContentElement) {
          // 从内容区域元素提取文本内容
          let content = '';
          const paragraphs = youmindContentElement.querySelectorAll('p');
          
          // 遍历所有段落，并用换行符连接
          paragraphs.forEach((p, index) => {
            // 跳过空段落
            if (p.textContent.trim() === '' && p.querySelector('br.ProseMirror-trailingBreak')) {
              return;
            }
            
            // 添加段落内容
            if (p.textContent.trim() !== '') {
              content += p.textContent.trim();
              // 如果不是最后一个段落，添加换行符
              if (index < paragraphs.length - 1) {
                content += '\n';
              }
            }
          });
          
          originalText = content;
          console.log('从YouMind编辑器提取内容:', originalText);
        } else {
          // 如果找不到精确的选择器，尝试更宽松的选择器
          const fallbackSelectors = [
            'div[contenteditable="true"][role="textbox"].tiptap.ProseMirror',
            '.tiptap.ProseMirror',
            'div.tiptap[contenteditable="true"]',
            '[contenteditable="true"][role="textbox"]'
          ];
          
          for (const selector of fallbackSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
              if (el.offsetParent !== null && el.offsetWidth > 50 && el.offsetHeight > 20) {
                // 使用内容区域元素提取文本，但不替换inputElement
                originalText = el.textContent || el.innerText;
                console.log('找到替代编辑器元素:', selector, el);
                break;
              }
            }
            if (originalText) break;
          }
        }
      // 如果还没有提取到内容且没有输入元素
      if (!originalText && !inputElement) {
        console.error('未找到任何输入元素或内容');
        sendResponse({success: false, message: '未找到输入元素或内容'});
        return true;
      }
      
      // 如果还没有提取到内容，则从原始输入元素中提取
      if (!originalText && originalInputElement) {
        const isContentEditable = originalInputElement.hasAttribute('contenteditable') && originalInputElement.getAttribute('contenteditable') === 'true';
        
        if (isContentEditable) {
          originalText = originalInputElement.textContent || originalInputElement.innerText;
        } else {
          originalText = originalInputElement.value;
        }
        
        console.log('从原始输入元素提取内容:', originalText);
      }
      
      // 检查是否有内容
      console.log('检查内容:', originalText);
      
      // 如果原始文本为空，再次尝试从 YouMind 编辑器获取内容
      if (!originalText || originalText.trim() === '') {
        console.log('尝试再次获取 YouMind 编辑器内容');
        
        // 直接使用选择器获取 YouMind 编辑器元素
        const youmindSelectors = [
          'div[contenteditable="true"][role="textbox"][translate="no"].tiptap.ProseMirror',
          'div.tiptap.ProseMirror[contenteditable="true"]',
          '.tiptap.ProseMirror',
          'div[role="textbox"].tiptap'
        ];
        
        let youmindElement = null;
        
        // 尝试每个选择器
        for (const selector of youmindSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            youmindElement = element;
            console.log('再次找到YouMind编辑器元素，使用选择器:', selector);
            break;
          }
        }
        
        if (youmindElement) {
          console.log('再次找到 YouMind 编辑器元素:', youmindElement);
          
          // 直接获取所有文本内容
          originalText = youmindElement.innerText || youmindElement.textContent;
          console.log('直接获取的内容:', originalText);
          
          // 如果还是为空，尝试获取所有段落的内容
          if (!originalText || originalText.trim() === '') {
            let content = '';
            const paragraphs = youmindElement.querySelectorAll('p');
            
            console.log('找到段落数量:', paragraphs.length);
            
            // 遍历所有段落，并用换行符连接
            paragraphs.forEach((p, index) => {
              console.log('段落内容:', p.textContent);
              if (p.textContent.trim() !== '') {
                content += p.textContent.trim();
                if (index < paragraphs.length - 1) {
                  content += '\n';
                }
              }
            });
            
            originalText = content;
          }
          
          // 如果还是为空，尝试获取HTML内容
          if (!originalText || originalText.trim() === '') {
            const htmlContent = youmindElement.innerHTML;
            
            // 创建一个临时元素来提取纯文本
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;
            originalText = tempDiv.textContent || tempDiv.innerText;
          }
        }
      }
      
      // 如果还是没有内容，尝试从页面中获取所有可见文本
      if (!originalText || originalText.trim() === '') {
        // 获取当前浏览器窗口中的可见文本
        const getVisibleText = () => {
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
              acceptNode: function(node) {
                // 只接受可见的文本节点
                if (node.parentElement && 
                    node.textContent.trim() !== '' && 
                    window.getComputedStyle(node.parentElement).display !== 'none' &&
                    window.getComputedStyle(node.parentElement).visibility !== 'hidden') {
                  return NodeFilter.FILTER_ACCEPT;
                }
                return NodeFilter.FILTER_REJECT;
              }
            }
          );
          
          let visibleText = '';
          let node;
          
          // 收集前500个字符的可见文本
          while ((node = walker.nextNode()) && visibleText.length < 500) {
            if (node.textContent.trim() !== '') {
              visibleText += node.textContent.trim() + ' ';
            }
          }
          
          return visibleText.trim();
        };
        
        // 尝试获取可见文本
        try {
          originalText = getVisibleText();
          console.log('从页面获取的可见文本:', originalText);
        } catch (e) {
          console.error('获取可见文本时出错:', e);
        }
      }
      
      // 再次检查是否有内容
      if (!originalText || originalText.trim() === '') {
        console.error('未能获取到内容');
        alert('请先输入内容再生成标题');
        sendResponse({success: false, message: '输入框为空，请先输入内容'});
        return true;
      }
      
      // 已经找到输入元素并有内容，开始生成标题
      console.log('开始生成标题，原文内容长度:', originalText.length);
      
      // 显示加载状态
      
      // 创建一个浮动的加载指示器
      const loadingIndicator = document.createElement('div');
      loadingIndicator.id = 'title-loading-indicator';
      loadingIndicator.textContent = '正在生成标题...';
      loadingIndicator.style.position = 'fixed';
      loadingIndicator.style.top = '10px';
      loadingIndicator.style.right = '10px';
      loadingIndicator.style.backgroundColor = 'rgba(66, 133, 244, 0.9)';
      loadingIndicator.style.color = 'white';
      loadingIndicator.style.padding = '8px 12px';
      loadingIndicator.style.borderRadius = '4px';
      loadingIndicator.style.zIndex = '10000';
      loadingIndicator.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
      document.body.appendChild(loadingIndicator);
      
      // 使用自定义提示词，生成短标题
      const customPrompt = `请为以下内容生成一个简洁、准确的标题，完全基于内容本身，不要添加任何不在内容中的信息。标题必须在10个字以内：\n${originalText}`;
      
      // 使用DeepSeek API生成标题
      chrome.runtime.sendMessage({
        action: 'callDeepSeekAPI',
        apiKey: config.apiKey,
        model: config.model || 'deepseek-chat',
        prompt: customPrompt
      }, function(response) {
        // 移除加载指示器
        if (document.getElementById('title-loading-indicator')) {
          document.body.removeChild(loadingIndicator);
        }
        
        if (response && response.title) {
          const generatedTitle = response.title;
          console.log('标题已生成:', generatedTitle);
          
          // 处理生成的标题
          // 检查是否找到了YouMind编辑器的内容区域
          const youmindSelectors = [
            'div[contenteditable="true"][role="textbox"][translate="no"].tiptap.ProseMirror',
            'div.tiptap.ProseMirror[contenteditable="true"]',
            '.tiptap.ProseMirror',
            'div[role="textbox"].tiptap'
          ];
          
          let youmindContentElement = null;
          
          // 尝试每个选择器
          for (const selector of youmindSelectors) {
            const element = document.querySelector(selector);
            if (element) {
              youmindContentElement = element;
              console.log('找到YouMind编辑器元素用于插入标题，使用选择器:', selector);
              break;
            }
          }
          
          if (youmindContentElement) {
            // 对于YouMind编辑器，需要特殊处理
            // 首先清空编辑器内容
            while (youmindContentElement.firstChild) {
              youmindContentElement.removeChild(youmindContentElement.firstChild);
            }
            
            // 创建新的段落元素并插入标题
            const newParagraph = document.createElement('p');
            newParagraph.textContent = generatedTitle;
            youmindContentElement.appendChild(newParagraph);
            
            // 触发输入事件
            youmindContentElement.dispatchEvent(new Event('input', { bubbles: true }));
            // 触发变化事件
            youmindContentElement.dispatchEvent(new Event('change', { bubbles: true }));
            
            // 尝试聚焦编辑器
            try {
              youmindContentElement.focus();
              // 将光标移动到文本末尾
              const selection = window.getSelection();
              const range = document.createRange();
              range.selectNodeContents(newParagraph);
              range.collapse(false); // 将范围折叠到结尾
              selection.removeAllRanges();
              selection.addRange(range);
            } catch (e) {
              console.error('设置光标位置失败:', e);
            }
            
            // 显示成功消息
            showNotification('标题已生成并插入到YouMind编辑器中', 'success');
          } else if (inputElement) {
            // 对于其他输入元素，检查是否是contenteditable
            const isContentEditable = inputElement.hasAttribute('contenteditable') && inputElement.getAttribute('contenteditable') === 'true';
            
            if (isContentEditable) {
              // 对于contenteditable元素
              inputElement.textContent = generatedTitle;
              inputElement.dispatchEvent(new Event('input', { bubbles: true }));
              showNotification('标题已生成并插入到编辑器中', 'success');
            } else {
              // 对于普通输入框
              inputElement.value = generatedTitle;
              inputElement.dispatchEvent(new Event('input', { bubbles: true }));
              showNotification('标题已生成', 'success');
            }
          } else {
            // 没有可用的输入元素，只显示标题
            showNotification('标题已生成: ' + generatedTitle, 'success');
          }
          
          sendResponse({success: true, title: generatedTitle});
        } else {
          console.error('生成标题失败:', response ? response.error : '未知错误');
          
          // 如果出错，使用简单的本地生成方式
          const fallbackTitle = originalText.substring(0, 10);
          
          // 检查是否找到了YouMind编辑器的内容区域
          const youmindSelectors = [
            'div[contenteditable="true"][role="textbox"][translate="no"].tiptap.ProseMirror',
            'div.tiptap.ProseMirror[contenteditable="true"]',
            '.tiptap.ProseMirror',
            'div[role="textbox"].tiptap'
          ];
          
          let youmindContentElement = null;
          
          // 尝试每个选择器
          for (const selector of youmindSelectors) {
            const element = document.querySelector(selector);
            if (element) {
              youmindContentElement = element;
              console.log('找到YouMind编辑器元素用于插入备用标题，使用选择器:', selector);
              break;
            }
          }
          
          if (youmindContentElement) {
            // 对于YouMind编辑器，需要特殊处理
            // 首先清空编辑器内容
            while (youmindContentElement.firstChild) {
              youmindContentElement.removeChild(youmindContentElement.firstChild);
            }
            
            // 创建新的段落元素并插入标题
            const newParagraph = document.createElement('p');
            newParagraph.textContent = fallbackTitle;
            youmindContentElement.appendChild(newParagraph);
            
            // 触发输入事件
            youmindContentElement.dispatchEvent(new Event('input', { bubbles: true }));
            youmindContentElement.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (inputElement) {
            // 对于其他输入元素，检查是否是contenteditable
            const isContentEditable = inputElement.hasAttribute('contenteditable') && inputElement.getAttribute('contenteditable') === 'true';
            
            if (isContentEditable) {
              // 对于contenteditable元素
              inputElement.textContent = fallbackTitle;
              inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
              // 普通输入框
              inputElement.value = fallbackTitle;
              inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }
          
          // 显示错误消息
          showNotification('生成标题失败，已使用本地模式', 'error');
          
          sendResponse({success: false, message: response ? response.error : '未知错误', fallbackTitle: fallbackTitle});
        }
      });
      
      return true; // 保持消息通道打开以便异步响应
    }).catch(error => {
      console.error('处理生成标题请求错误:', error);
      sendResponse({success: false, message: error.message || '处理请求时发生错误'});
    });
    
    return true; // 保持消息通道打开以便异步响应
  }
  return true;
});

// 创建并添加工具按钮的函数
async function createTitleButton(inputElement) {
  // 检查是否已经添加了按钮
  const existingButton = document.getElementById('title-generator-button');
  if (existingButton) return;
  
  // 获取用户配置
  const config = await getUserConfig();
  
  // 创建按钮元素
  const button = document.createElement('button');
  button.id = 'title-generator-button';
  
  // 创建 YouMind SVG 图标
  const svg = createYouMindLogoSvg(16, 16, 'currentColor');
  svg.style.marginRight = '4px';
  svg.style.verticalAlign = 'middle';
  
  // 添加文本和 SVG 到按钮
  const textSpan = document.createElement('span');
  textSpan.textContent = '生成标题';
  textSpan.style.verticalAlign = 'middle';
  
  button.appendChild(svg);
  button.appendChild(textSpan);
  button.title = '点击生成标题';
  
  // 设置按钮样式 - 使用YouMind的主题色，尺寸更小更精致
  button.style.position = 'absolute';
  button.style.zIndex = '1000';
  button.style.padding = '5px 10px';
  button.style.backgroundColor = youmindTheme.buttonPrimary; // YouMind深灰色主题
  button.style.color = youmindTheme.background;
  button.style.border = 'none';
  button.style.borderRadius = '5px';
  button.style.cursor = 'pointer';
  button.style.fontSize = '12px';
  button.style.top = '50%';
  button.style.transform = 'translateY(-50%)';
  button.style.display = 'flex';
  button.style.alignItems = 'center';
  button.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
  button.style.minWidth = '32px';
  button.style.height = '28px';
  
  // 根据用户配置设置按钮位置
  const buttonPosition = config.buttonPosition || 'right';
  if (buttonPosition === 'right') {
    button.style.right = '10px';
  } else if (buttonPosition === 'left') {
    button.style.left = '10px';
  } else if (buttonPosition === 'top') {
    button.style.top = '-25px';
    button.style.right = '10px';
    button.style.transform = 'none';
  } else if (buttonPosition === 'bottom') {
    button.style.bottom = '-25px';
    button.style.top = 'auto';
    button.style.right = '10px';
    button.style.transform = 'none';
  }
  
  // 添加悬停效果 - 使用YouMind的主题色
  button.style.transition = 'all 0.2s ease';
  button.addEventListener('mouseover', function() {
    this.style.backgroundColor = youmindTheme.buttonPrimaryHover; // 更深的灰色
    this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
    this.style.transform = 'translateY(-52%)';
  });
  button.addEventListener('mouseout', function() {
    this.style.backgroundColor = youmindTheme.buttonPrimary; // 恢复到原始的深灰色
    this.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    this.style.transform = 'translateY(-50%)';
  });
  
  // 添加点击事件
  button.addEventListener('click', function() {
    // 检查元素类型并获取内容
    let content = '';
    
    // 首先尝试查找YouMind编辑器的特定div元素
    const youmindSelector = 'div[contenteditable="true"][role="textbox"][translate="no"].tiptap.ProseMirror';
    const youmindElement = document.querySelector(youmindSelector);
    
    if (youmindElement) {
      console.log('找到YouMind编辑器元素:', youmindElement);
      
      // 从YouMind编辑器元素提取文本内容
      let editorContent = '';
      const paragraphs = youmindElement.querySelectorAll('p');
      
      // 遍历所有段落，并用换行符连接
      paragraphs.forEach((p, index) => {
        // 跳过空段落
        if (p.textContent.trim() === '' && p.querySelector('br.ProseMirror-trailingBreak')) {
          return;
        }
        
        // 添加段落内容
        if (p.textContent.trim() !== '') {
          editorContent += p.textContent.trim();
          // 如果不是最后一个段落，添加换行符
          if (index < paragraphs.length - 1) {
            editorContent += '\n';
          }
        }
      });
      
      content = editorContent;
      console.log('从YouMind编辑器提取内容:', content);
    } else {
      const isContentEditable = inputElement.hasAttribute('contenteditable') && inputElement.getAttribute('contenteditable') === 'true';
      
      if (isContentEditable) {
        // 如果是contenteditable元素，获取文本内容
        content = inputElement.textContent || inputElement.innerText;
      } else {
        // 如果是普通输入框，获取value
        content = inputElement.value;
      }
    }
    
    if (!content) {
      alert('请先输入内容再生成标题');
      return;
    }
    
    
    // 使用自定义提示词，生成短标题
    const customPrompt = `请为以下内容生成一个简洁、准确的标题，完全基于内容本身，不要添加任何不在内容中的信息，更不能分散发挥。标题最好在10个汉字以内：\n${content}`;
    
    // 显示加载状态 - 只使用SVG波浪动画，不显示文字
    button.innerHTML = '';
    // 禁用按钮点击
    button.disabled = true;
    button.style.pointerEvents = 'none';
    button.style.opacity = '0.9';
    
    // 创建波浪动画的SVG - 尺寸更小
    const svgNamespace = 'http://www.w3.org/2000/svg';
    const loadingSvg = document.createElementNS(svgNamespace, 'svg');
    loadingSvg.setAttribute('width', '20');
    loadingSvg.setAttribute('height', '20');
    loadingSvg.setAttribute('viewBox', '0 0 34 20');
    loadingSvg.style.margin = 'auto';
    
    // 创建完整的SVG路径来实现线条内部波动
    // 将原始路径分成四个部分，确保每个部分都有动画
    const wavePath1 = document.createElementNS(svgNamespace, 'path');
    wavePath1.setAttribute('d', 'M5.33333 4.06667C5.33333 1.82071 3.51262 0 1.26667 0H0V13.8333C0 17.2391 2.7609 20 6.16667 20C9.57243 20 12.3333 17.2391 12.3333 13.8333L12.3333 12.0333L12.3333 8.01667L12.3333 6.73334');
    wavePath1.setAttribute('fill', 'none');
    wavePath1.setAttribute('stroke', 'white');
    wavePath1.setAttribute('stroke-width', '2');
    wavePath1.id = 'wave-path-1';
    
    const wavePath2 = document.createElementNS(svgNamespace, 'path');
    wavePath2.setAttribute('d', 'M12.3333 6.73334C12.3333 4.85557 13.8556 3.33334 15.7333 3.33334C17.6111 3.33334 19.1333 4.85557 19.1333 6.73334V17.3333C19.1333 18.8061 20.3272 20 21.8 20H24.7333V7.03334');
    wavePath2.setAttribute('fill', 'none');
    wavePath2.setAttribute('stroke', 'white');
    wavePath2.setAttribute('stroke-width', '2');
    wavePath2.id = 'wave-path-2';
    
    const wavePath3 = document.createElementNS(svgNamespace, 'path');
    wavePath3.setAttribute('d', 'M24.7333 7.03334C24.7333 3.14893 21.5844 7.80279e-06 17.7 7.80279e-06C13.8156 7.80279e-06 10.6667 3.14893 10.6667 7.03334L10.6667 8.01667L10.6667 12.0333L10.6667 14C10.6667 15.4728 9.47275 16.6667 8 16.6667C6.52725 16.6667 5.33333 15.4728 5.33333 14V4.06667');
    wavePath3.setAttribute('fill', 'none');
    wavePath3.setAttribute('stroke', 'white');
    wavePath3.setAttribute('stroke-width', '2');
    wavePath3.id = 'wave-path-3';
    
    const wavePath4 = document.createElementNS(svgNamespace, 'path');
    wavePath4.setAttribute('d', 'M25.5866 3.49163C27.2184 4.77318 28.3 6.76418 28.3 9V17.3333C28.3 18.8061 29.4939 20 30.9666 20H33.3333V9.66667C33.3333 9.44151 33.3216 9.21909 33.2986 9C32.9655 5.81556 30.2726 3.33334 26.9999 3.33334C26.5432 3.33334 26.0978 3.38169 25.6684 3.47355C25.6411 3.4794 25.6138 3.48543 25.5866 3.49163Z');
    wavePath4.setAttribute('fill', 'none');
    wavePath4.setAttribute('stroke', 'white');
    wavePath4.setAttribute('stroke-width', '2');
    wavePath4.id = 'wave-path-4';
    
    // 创建一个组合路径来实现填充效果
    const combinedPath = document.createElementNS(svgNamespace, 'path');
    combinedPath.setAttribute('fill-rule', 'evenodd');
    combinedPath.setAttribute('clip-rule', 'evenodd');
    combinedPath.setAttribute('d', 'M5.33333 4.06667C5.33333 1.82071 3.51262 0 1.26667 0H0V13.8333C0 17.2391 2.7609 20 6.16667 20C9.57243 20 12.3333 17.2391 12.3333 13.8333L12.3333 12.0333L12.3333 8.01667L12.3333 6.73334C12.3333 4.85557 13.8556 3.33334 15.7333 3.33334C17.6111 3.33334 19.1333 4.85557 19.1333 6.73334V17.3333C19.1333 18.8061 20.3272 20 21.8 20H24.7333V7.03334C24.7333 3.14893 21.5844 7.80279e-06 17.7 7.80279e-06C13.8156 7.80279e-06 10.6667 3.14893 10.6667 7.03334L10.6667 8.01667L10.6667 12.0333L10.6667 14C10.6667 15.4728 9.47275 16.6667 8 16.6667C6.52725 16.6667 5.33333 15.4728 5.33333 14V4.06667ZM25.5866 3.49163C27.2184 4.77318 28.3 6.76418 28.3 9V17.3333C28.3 18.8061 29.4939 20 30.9666 20H33.3333V9.66667C33.3333 9.44151 33.3216 9.21909 33.2986 9C32.9655 5.81556 30.2726 3.33334 26.9999 3.33334C26.5432 3.33334 26.0978 3.38169 25.6684 3.47355C25.6411 3.4794 25.6138 3.48543 25.5866 3.49163Z');
    combinedPath.setAttribute('fill', 'white');
    combinedPath.setAttribute('opacity', '0.3');
    
    // 将所有路径添加到SVG中
    loadingSvg.appendChild(combinedPath);
    loadingSvg.appendChild(wavePath1);
    loadingSvg.appendChild(wavePath2);
    loadingSvg.appendChild(wavePath3);
    loadingSvg.appendChild(wavePath4);
    
    // 添加波浪动画样式 - 使用线条内部波动
    const style = document.createElement('style');
    style.textContent = `
      @keyframes dashOffset1 {
        0% { stroke-dashoffset: 0; }
        50% { stroke-dashoffset: 10; }
        100% { stroke-dashoffset: 0; }
      }
      
      @keyframes dashOffset2 {
        0% { stroke-dashoffset: 0; }
        50% { stroke-dashoffset: -15; }
        100% { stroke-dashoffset: 0; }
      }
      
      @keyframes dashOffset3 {
        0% { stroke-dashoffset: 0; }
        50% { stroke-dashoffset: 20; }
        100% { stroke-dashoffset: 0; }
      }
      
      @keyframes dashOffset4 {
        0% { stroke-dashoffset: 0; }
        50% { stroke-dashoffset: -12; }
        100% { stroke-dashoffset: 0; }
      }
      
      #wave-path-1 {
        stroke-dasharray: 5, 3;
        animation: dashOffset1 2s ease-in-out infinite;
      }
      
      #wave-path-2 {
        stroke-dasharray: 4, 2;
        animation: dashOffset2 1.5s ease-in-out infinite;
      }
      
      #wave-path-3 {
        stroke-dasharray: 6, 2;
        animation: dashOffset3 2.5s ease-in-out infinite;
      }
      
      #wave-path-4 {
        stroke-dasharray: 5, 2;
        animation: dashOffset4 2.2s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
    
    // 只添加SVG动画，不添加文字
    button.appendChild(loadingSvg);
    
    // 调用API生成标题
    chrome.runtime.sendMessage({
      action: 'callDeepSeekAPI',
      apiKey: config.apiKey,
      model: config.model || 'deepseek-chat',
      prompt: customPrompt
    }, function(response) {
      // 恢复按钮状态
      button.innerHTML = '';
      button.disabled = false;
      button.style.pointerEvents = 'auto';
      button.style.opacity = '1';
      const svgNamespace = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNamespace, 'svg');
      svg.setAttribute('width', '16');
      svg.setAttribute('height', '16');
      svg.setAttribute('viewBox', '0 0 34 20');
      svg.setAttribute('fill', 'currentColor');
      svg.style.marginRight = '4px';
      svg.style.verticalAlign = 'middle';
      
      const path = document.createElementNS(svgNamespace, 'path');
      path.setAttribute('fill-rule', 'evenodd');
      path.setAttribute('clip-rule', 'evenodd');
      path.setAttribute('d', 'M5.33333 4.06667C5.33333 1.82071 3.51262 0 1.26667 0H0V13.8333C0 17.2391 2.7609 20 6.16667 20C9.57243 20 12.3333 17.2391 12.3333 13.8333L12.3333 12.0333L12.3333 8.01667L12.3333 6.73334C12.3333 4.85557 13.8556 3.33334 15.7333 3.33334C17.6111 3.33334 19.1333 4.85557 19.1333 6.73334V17.3333C19.1333 18.8061 20.3272 20 21.8 20H24.7333V7.03334C24.7333 3.14893 21.5844 7.80279e-06 17.7 7.80279e-06C13.8156 7.80279e-06 10.6667 3.14893 10.6667 7.03334L10.6667 8.01667L10.6667 12.0333L10.6667 14C10.6667 15.4728 9.47275 16.6667 8 16.6667C6.52725 16.6667 5.33333 15.4728 5.33333 14V4.06667ZM25.5866 3.49163C27.2184 4.77318 28.3 6.76418 28.3 9V17.3333C28.3 18.8061 29.4939 20 30.9666 20H33.3333V9.66667C33.3333 9.44151 33.3216 9.21909 33.2986 9C32.9655 5.81556 30.2726 3.33334 26.9999 3.33334C26.5432 3.33334 26.0978 3.38169 25.6684 3.47355C25.6411 3.4794 25.6138 3.48543 25.5866 3.49163Z');
      svg.appendChild(path);
      
      // 添加文本和 SVG 到按钮
      const textSpan = document.createElement('span');
      textSpan.textContent = '生成标题';
      textSpan.style.verticalAlign = 'middle';
      
      button.appendChild(svg);
      button.appendChild(textSpan);
      button.disabled = false;
      
      if (response && response.title) {
        const generatedTitle = response.title;
        console.log('标题已生成:', generatedTitle);
        
        // 根据元素类型处理生成的标题
        if (isContentEditable) {
          // 对于contenteditable元素，复制到剪贴板
          navigator.clipboard.writeText(generatedTitle).then(() => {
            alert(`标题已生成并复制到剪贴板：\n${generatedTitle}`);
          }).catch(err => {
            alert(`标题已生成，但复制失败：\n${generatedTitle}`);
            console.error('复制到剪贴板失败:', err);
          });
        } else {
          // 对于普通输入框，直接设置值
          inputElement.value = generatedTitle;
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } else {
        console.error('生成标题失败:', response ? response.error : '未知错误');
        
        // 如果出错，使用简单的本地生成方式
        const fallbackTitle = content.substring(0, 10);
        
        if (isContentEditable) {
          navigator.clipboard.writeText(fallbackTitle).then(() => {
            alert(`生成标题失败，已使用本地模式并复制到剪贴板：\n${fallbackTitle}`);
          }).catch(err => {
            alert(`生成标题失败，已使用本地模式：\n${fallbackTitle}`);
          });
        } else {
          inputElement.value = fallbackTitle;
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
          alert(`生成标题失败\n已使用本地模式生成标题`);
        }
      }
    });
  });
  
  // 创建容器来放置输入框和按钮
  const container = document.createElement('div');
  container.style.position = 'relative';
  container.style.display = 'inline-block';
  container.style.width = '100%';
  
  // 判断元素类型
  const isContentEditable = inputElement.hasAttribute('contenteditable') && inputElement.getAttribute('contenteditable') === 'true';
  
  if (isContentEditable) {
    // 对于contenteditable元素，我们不移动元素，而是直接在其父元素上添加按钮
    const parent = inputElement.parentNode;
    parent.style.position = 'relative';
    parent.appendChild(button);
  } else {
    // 对于普通输入框，使用原来的方式
    const parent = inputElement.parentNode;
    parent.insertBefore(container, inputElement);
    container.appendChild(inputElement);
    container.appendChild(button);
  }
}

// 查找页面上所有输入框和contenteditable元素并返回其选择器
function findAllInputElements() {
  // 查找所有输入框和textarea
  const allInputs = document.querySelectorAll('input[type="text"], input:not([type]), textarea');
  // 查找所有contenteditable元素
  const allEditables = document.querySelectorAll('[contenteditable="true"]');
  
  const inputSelectors = [];
  
  // 处理所有输入框
  allInputs.forEach((input, index) => {
    // 尝试获取各种可能的选择器
    let selector = '';
    
    // 尝试使用id
    if (input.id) {
      selector = `#${input.id}`;
    } 
    // 尝试使用class
    else if (input.className) {
      const classes = input.className.split(' ').filter(c => c.trim() !== '');
      if (classes.length > 0) {
        selector = input.tagName.toLowerCase() + '.' + classes.join('.');
      }
    }
    // 如果没有id和class，使用标签名和索引
    if (!selector) {
      selector = `${input.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
    }
    
    // 添加到选择器列表
    inputSelectors.push({
      element: input,
      selector: selector,
      value: input.value,
      visible: input.offsetParent !== null, // 检查是否可见
      width: input.offsetWidth,
      height: input.offsetHeight,
      type: 'input'
    });
  });
  
  // 处理所有contenteditable元素
  allEditables.forEach((editable, index) => {
    let selector = '';
    
    // 尝试使用id
    if (editable.id) {
      selector = `#${editable.id}`;
    } 
    // 尝试使用class
    else if (editable.className) {
      const classes = editable.className.split(' ').filter(c => c.trim() !== '');
      if (classes.length > 0) {
        selector = editable.tagName.toLowerCase() + '.' + classes.join('.');
      }
    }
    // 尝试使用属性
    else if (editable.getAttribute('role')) {
      selector = `[contenteditable="true"][role="${editable.getAttribute('role')}"]`;
    }
    // 如果没有id和class，使用标签名和索引
    if (!selector) {
      selector = `${editable.tagName.toLowerCase()}[contenteditable="true"]:nth-of-type(${index + 1})`;
    }
    
    // 获取元素的文本内容
    const text = editable.textContent || editable.innerText;
    
    // 添加到选择器列表
    inputSelectors.push({
      element: editable,
      selector: selector,
      value: text,
      visible: editable.offsetParent !== null,
      width: editable.offsetWidth,
      height: editable.offsetHeight,
      type: 'contenteditable'
    });
  });
  
  return inputSelectors;
}

/**
 * 查找页面上的输入元素
 * @returns {Element|null} 找到的输入元素或null
 */
async function findInputElement() {
  // 获取用户配置的选择器
  const config = await getUserConfig();
  const inputSelector = config.elementSelector || 'input.flex.h-10.w-full.rounded-md.border.border-input';
  
  // 先尝试使用用户配置的选择器
  let inputElement = document.querySelector(inputSelector);
  
  // 如果找不到，尝试其他常见输入框选择器
  if (!inputElement) {
    // 先尝试特定的YouMind编辑器选择器
    const youmindSelector = 'div[contenteditable="true"][role="textbox"].tiptap.ProseMirror';
    const youmindElement = document.querySelector(youmindSelector);
    if (youmindElement) {
      inputElement = youmindElement;
    } else {
      // 常见输入框选择器
      const commonSelectors = [
        // contenteditable元素
        '[contenteditable="true"]',
        '[contenteditable="true"][role="textbox"]',
        '.tiptap.ProseMirror',
        'div.tiptap',
        // 普通输入框
        'input[type="text"]', 
        'input:not([type])', 
        'textarea',
        'input.ant-input',
        '.ant-input',
        'input.form-control',
        '.form-control',
        'input.input',
        '.input',
        'input.search-input',
        '.search-input',
        'input[placeholder]'
      ];
      
      for (const selector of commonSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          // 检查是否可见且大小合适
          if (isElementVisible(el) && isElementSizeValid(el)) {
            inputElement = el;
            break;
          }
        }
        if (inputElement) break;
      }
    }
  }
  
  return inputElement;
}

// 检测和处理目标输入框
async function findAndProcessInputElement() {
  try {
    const inputElement = await findInputElement();
    if (!inputElement) return false;
    
    if (inputElement) {
      await createTitleButton(inputElement);
      return true;
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
}

// 使用MutationObserver监听DOM变化，以便在动态加载的页面上也能找到输入框和分享对话框
function setupMutationObserver() {
  // 创建用于检测输入框的观察器
  const inputObserver = new MutationObserver(function(mutations) {
    // 使用节流函数减少频繁检查
    if (inputObserver.timeout) {
      clearTimeout(inputObserver.timeout);
    }
    
    inputObserver.timeout = setTimeout(async function() {
      try {
        await findAndProcessInputElement();
      } catch (error) {
        console.warn('处理输入框DOM变化错误:', error);
      }
    }, 500); // 500ms的节流时间
  });
  
  // 创建用于检测对话框的观察器
  const dialogObserver = new MutationObserver(function(mutations) {
    // 对每个变化进行检查
    for (const mutation of mutations) {
      // 检查添加的节点
      if (mutation.addedNodes && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          // 检查是否是元素节点
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 检查是否是对话框元素
            if (node.getAttribute && node.getAttribute('role') === 'dialog') {
              // 立即检测分享对话框
              setTimeout(async () => {
                try {
                  await detectShareDialog();
                } catch (error) {
                  console.warn('处理对话框错误:', error);
                }
              }, 100); // 给对话框一点时间完全渲染
            } else {
              // 检查子元素是否包含对话框
              const dialog = node.querySelector('div[role="dialog"]');
              if (dialog) {
                setTimeout(async () => {
                  try {
                    await detectShareDialog();
                  } catch (error) {
                    console.warn('处理对话框错误:', error);
                  }
                }, 100);
              }
            }
          }
        }
      }
      
      // 检查属性变化，如果对话框从隐藏变为显示
      if (mutation.type === 'attributes' && 
          mutation.attributeName === 'data-state' && 
          mutation.target.getAttribute('role') === 'dialog') {
        if (mutation.target.getAttribute('data-state') === 'open') {
          setTimeout(async () => {
            try {
              await detectShareDialog();
            } catch (error) {
              console.warn('处理对话框状态变化错误:', error);
            }
          }, 100);
        }
      }
    }
  });
  
  // 设置观察器配置
  const inputConfig = { childList: true, subtree: true };
  const dialogConfig = { 
    childList: true, 
    subtree: true,
    attributes: true,
    attributeFilter: ['data-state', 'style', 'class'] // 只监听这些属性的变化
  };
  
  // 开始观察文档体
  if (document.body) {
    inputObserver.observe(document.body, inputConfig);
    dialogObserver.observe(document.body, dialogConfig);
  } else {
    // 如果文档体还不存在，等待它加载
    document.addEventListener('DOMContentLoaded', function() {
      inputObserver.observe(document.body, inputConfig);
      dialogObserver.observe(document.body, dialogConfig);
    });
  }
}

// 检测分享对话框并添加生成分享图按钮
async function detectShareDialog() {
  console.log('检测分享对话框...');
  
  // 查找所有对话框
  const dialogs = document.querySelectorAll('div[role="dialog"][data-state="open"]');
  
  // 遍历所有弹出对话框
  for (const dialogElement of dialogs) {
    // 检查是否是分享对话框
    const titleElement = dialogElement.querySelector('h2.title, h2.text-lg.leading-none.tracking-tight');
    if (!titleElement || titleElement.textContent.trim() !== 'Share') {
      continue; // 不是分享对话框，继续检查下一个
    }
    
    console.log('找到分享对话框:', dialogElement);
    // 检查是否已经添加了按钮
    const existingButton = document.getElementById('generate-share-image-button');
    if (existingButton) return;
    
    // 我们已经有了dialogElement，不需要再次获取
    
    // 创建生成分享图按钮
    const shareImageButton = document.createElement('button');
    shareImageButton.id = 'generate-share-image-button';
    shareImageButton.className = 'flex w-full items-center justify-between rounded-xl bg-card-snips px-3 py-2 mt-2';
    shareImageButton.style.cursor = 'pointer';
    shareImageButton.style.border = 'none';
    shareImageButton.style.backgroundColor = youmindTheme.backgroundAlt;
    shareImageButton.style.marginTop = '8px';
    
    // 创建按钮内容
    const buttonContent = document.createElement('div');
    buttonContent.className = 'flex items-center justify-center text-white';
    buttonContent.textContent = '生成分享图';
    
    // 添加到按钮
    shareImageButton.appendChild(buttonContent);
    
    // 添加点击事件
    shareImageButton.addEventListener('click', function() {
      // 获取分享链接
      const linkElement = dialogElement.querySelector('div.flex.w-full.items-center.justify-between.rounded-xl.bg-card-snips.px-3.py-2');
      let shareLink = '';
      
      if (linkElement) {
        // 尝试获取分享链接
        const toggleButton = linkElement.querySelector('button[role="switch"]');
        if (toggleButton) {
          // 确保开关打开
          if (toggleButton.getAttribute('aria-checked') === 'false') {
            toggleButton.click();
            // 给一点时间让链接生成
            setTimeout(() => {
              generateShareImage(dialogElement);
            }, 500);
            return;
          }
        }
      }
      
      generateShareImage(dialogElement);
    });
    
    // 找到要插入按钮的位置 - 尝试多种选择器
    const insertPosition = dialogElement.querySelector('div.flex.flex-col.items-center.justify-center') || 
                          dialogElement.querySelector('div.flex.flex-col.space-y-1\.5, div.flex.flex-col').nextElementSibling;
    
    if (insertPosition) {
      console.log('找到插入位置:', insertPosition);
      
      // 尝试查找分享开关元素
      const shareToggle = insertPosition.querySelector('div.flex.w-full.items-center.justify-between') || 
                          insertPosition.querySelector('div.flex.w-full');
      
      if (shareToggle) {
        // 在分享开关元素后插入按钮
        insertPosition.appendChild(shareImageButton);
        console.log('分享图按钮已添加');
      } else {
        // 如果找不到开关元素，直接添加到插入位置
        insertPosition.appendChild(shareImageButton);
        console.log('分享图按钮已直接添加到对话框');
      }
    } else {
      // 如果找不到特定的插入位置，尝试直接添加到对话框
      console.log('找不到插入位置，尝试直接添加到对话框');
      dialogElement.appendChild(shareImageButton);
    }
    
    // 只处理第一个匹配的分享对话框
    return;
  }
  
  console.log('没有找到分享对话框');
}

// 创建图片预览对话框
function createImagePreviewDialog(imageUrl, title) {
  // 创建遮罩层
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  overlay.style.zIndex = '999';
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.flexDirection = 'column';
  
  // 点击遮罩层关闭预览弹框
  overlay.addEventListener('click', (event) => {
    // 如果点击的是遮罩层本身，而不是其子元素，则关闭对话框
    if (event.target === overlay) {
      closePreview();
    }
    // 阻止事件冒泡和穿透，防止关闭下面的分享弹框
    event.stopPropagation();
  });
  
  // 创建预览容器
  const previewContainer = document.createElement('div');
  previewContainer.style.backgroundColor = 'white';
  previewContainer.style.borderRadius = '0'; // 去除圆角
  previewContainer.style.padding = '20px';
  previewContainer.style.maxWidth = '90%';
  previewContainer.style.maxHeight = '90%';
  previewContainer.style.overflow = 'auto';
  previewContainer.style.display = 'flex';
  previewContainer.style.boxShadow = 'none'; // 去除阴影
  previewContainer.style.flexDirection = 'column';
  previewContainer.style.alignItems = 'center';
  previewContainer.style.position = 'absolute'; // 使用fixed定位方式
  previewContainer.style.zIndex = '10001'; // 设置层级比遮罩层高
  previewContainer.style.top = '50%';
  previewContainer.style.left = '50%';
  previewContainer.style.transform = 'translate(-50%, -50%)';
  
  
  
  // 添加图片预览
  const imagePreview = document.createElement('img');
  imagePreview.src = imageUrl;
  imagePreview.style.maxWidth = '100%';
  imagePreview.style.maxHeight = '70vh';
  imagePreview.style.borderRadius = '0'; // 去除圆角
  imagePreview.style.boxShadow = 'none'; // 去除阴影
  imagePreview.style.zIndex = '1'; // 在容器内的相对层级
  previewContainer.appendChild(imagePreview);
  
  // 防止点击图片关闭预览弹框
  imagePreview.addEventListener('click', (event) => {
    event.stopPropagation();
  });
  
  // 创建按钮容器
  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.justifyContent = 'center';
  buttonContainer.style.gap = '10px';
  buttonContainer.style.marginTop = '20px';
  buttonContainer.style.width = '100%';
  buttonContainer.style.zIndex = '1'; // 在容器内的相对层级
  
  // 创建下载按钮
  const downloadButton = document.createElement('button');
  downloadButton.textContent = '下载到本地';
  downloadButton.style.padding = '10px 20px';
  downloadButton.style.backgroundColor = youmindTheme.primary;
  downloadButton.style.color = youmindTheme.background;
  downloadButton.style.border = 'none';
  downloadButton.style.borderRadius = '4px';
  downloadButton.style.cursor = 'pointer';
  downloadButton.style.fontWeight = 'bold';
  downloadButton.style.transition = 'background-color 0.3s';
  
  downloadButton.addEventListener('mouseenter', () => {
    downloadButton.style.backgroundColor = '#333333';
    downloadButton.style.color = 'white';
  });
  
  downloadButton.addEventListener('mouseleave', () => {
    downloadButton.style.backgroundColor = youmindTheme.primary;
    downloadButton.style.color = youmindTheme.background;
  });
  
  downloadButton.addEventListener('click', (event) => {
    // 阻止事件冒泡，防止点击穿透
    event.stopPropagation();
    
    // 创建下载链接
    const downloadLink = document.createElement('a');
    downloadLink.href = imageUrl;
    downloadLink.download = `share-image-${new Date().getTime()}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    // 关闭预览对话框
    closePreview();
    showNotification('分享图已下载到本地', 'success');
  });
  
  // 创建复制到剪贴板按钮
  const copyButton = document.createElement('button');
  copyButton.textContent = '复制到剪贴板';
  copyButton.style.padding = '10px 20px';
  copyButton.style.backgroundColor = youmindTheme.primary;
  copyButton.style.color = youmindTheme.background;
  copyButton.style.border = 'none';
  copyButton.style.borderRadius = '4px';
  copyButton.style.cursor = 'pointer';
  copyButton.style.fontWeight = 'bold';
  copyButton.style.transition = 'background-color 0.3s';
  
  copyButton.addEventListener('mouseenter', () => {
    copyButton.style.backgroundColor = '#333333';
    copyButton.style.color = 'white';
  });
  
  copyButton.addEventListener('mouseleave', () => {
    copyButton.style.backgroundColor = youmindTheme.primary;
    copyButton.style.color = youmindTheme.background;
  });
  
  copyButton.addEventListener('click', async (event) => {
    // 阻止事件冒泡，防止点击穿透
    event.stopPropagation();
    
    try {
      // 检查是否支持剪贴板 API
      if (!navigator.clipboard || !window.ClipboardItem) {
        throw new Error('浏览器不支持剪贴板 API');
      }
      
      // 将图片复制到剪贴板
      const blob = await fetch(imageUrl).then(r => r.blob());
      const item = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      
      // 关闭预览对话框
      closePreview();
      showNotification('分享图已复制到剪贴板', 'success');
    } catch (error) {
      console.error('复制到剪贴板失败:', error);
      
      // 尝试使用临时元素复制图片
      try {
        // 创建一个临时的文本区域
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = '请使用下载到本地选项，您的浏览器不支持直接复制图片到剪贴板。';
        document.body.appendChild(tempTextArea);
        tempTextArea.select();
        document.execCommand('copy');
        document.body.removeChild(tempTextArea);
        
        showNotification('您的浏览器不支持直接复制图片，请使用下载选项', 'warning');
      } catch (fallbackError) {
        showNotification('复制到剪贴板失败，请尝试下载到本地', 'error');
      }
    }
  });
  
  // 定义关闭预览的函数
  function closePreview() {
    // 移除遮罩层
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay);
    }
    // 移除预览容器
    if (document.body.contains(previewContainer)) {
      document.body.removeChild(previewContainer);
    }
    // 移除键盘事件监听
    document.removeEventListener('keydown', handleKeyDown);
  }
  
  // 添加按钮到容器
  buttonContainer.appendChild(downloadButton);
  buttonContainer.appendChild(copyButton);
  previewContainer.appendChild(buttonContainer);
  
  // 防止按钮容器的点击事件冒泡
  buttonContainer.addEventListener('click', (event) => {
    event.stopPropagation();
  });
  
  // 将预览容器直接添加到body
  document.body.appendChild(previewContainer);
  
  // 防止点击预览容器关闭预览弹框
  previewContainer.addEventListener('click', (event) => {
    // 阻止事件冒泡和穿透
    event.stopPropagation();
  });
  
  // 监听 ESC 键关闭预览
  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      closePreview();
    }
  }
  
  document.addEventListener('keydown', handleKeyDown);
  
  // 添加到文档中
  document.body.appendChild(overlay);
}

/**
 * 从 YouMind 编辑器获取内容
 * @returns {string} 提取的内容文本，如果没有找到则返回空字符串
 */
function getContentFromYouMind() {
  let content = '';
  
  try {
    // 定义YouMind编辑器的选择器
    const youmindSelectors = [
      'div.tiptap.ProseMirror[contenteditable="true"]',
      '.tiptap.ProseMirror',
      'div[role="textbox"].tiptap'
    ];
    
    let youmindContentElement = null;
    
    // 尝试每个选择器
    for (const selector of youmindSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        youmindContentElement = element;
        break;
      }
    }
    
    // 如果找到了YouMind编辑器的内容区域元素
    if (youmindContentElement) {
      content = extractTextFromElement(youmindContentElement);
      if (content) {
        console.log('从 YouMind 编辑器提取内容:', content);
      }
    }
  } catch (error) {
    console.warn('从 YouMind 编辑器提取内容时出错:', error);
  }
  
  return content;
}

/**
 * 从元素中提取文本内容
 * @param {Element} element - 要提取文本的元素
 * @returns {string} 提取的文本内容
 */
function extractTextFromElement(element) {
  let content = '';
  const paragraphs = element.querySelectorAll('p');
  
  // 遍历所有段落，并用换行符连接
  paragraphs.forEach((p, index) => {
    // 跳过空段落
    if (p.textContent.trim() === '' && p.querySelector('br.ProseMirror-trailingBreak')) {
      return;
    }
    
    // 添加段落内容
    if (p.textContent.trim() !== '') {
      content += p.textContent.trim();
      // 如果不是最后一个段落，添加换行符
      if (index < paragraphs.length - 1) {
        content += '\n';
      }
    }
  });
  
  return content;
}

/**
 * 从页面元数据或内容中提取描述文本
 * @returns {string} 提取的描述文本，如果没有找到则返回空字符串
 */
function getDescriptionFromPage() {
  let description = '';
  
  try {
    // 尝试从 meta 标签中获取描述
    const metaDescription = document.querySelector('meta[name="description"]')?.content ||
                           document.querySelector('meta[property="og:description"]')?.content;
    
    // 尝试获取文章内容
    let articleContent = '';
    
    // 首先查找文章的主要内容区域
    const contentSelectors = [
      'article', '.article', '.post-content', '.entry-content',
      'main', '.main', '.content', '#content',
      '[role="main"]', '.story-body', '.story-content'
    ];
    
    let mainContent = null;
    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        mainContent = element;
        break;
      }
    }
    
    if (mainContent) {
      // 获取所有段落，并过滤掉空段落和过短的段落
      const paragraphs = Array.from(mainContent.querySelectorAll('p, h1, h2, h3, h4, h5, blockquote'))
        .map(p => p.textContent.trim())
        .filter(text => text.length > 10); // 只保留长度超过10个字符的段落
      
      if (paragraphs.length > 0) {
        // 返回前六个段落的内容
        articleContent = paragraphs.slice(0, 6).join('\n\n');
      }
    }
    
    // 如果没有找到文章内容，尝试获取页面上的所有文本
    if (!articleContent) {
      const bodyText = document.body.innerText;
      const sentences = bodyText.split(/[.!?\n]+/).filter(s => s.trim().length > 20);
      
      if (sentences.length > 0) {
        articleContent = sentences.slice(0, 6).join('. ') + '.';
      }
    }
    
    // 组合描述和文章内容
    if (metaDescription) {
      description = metaDescription;
    } else if (articleContent) {
      description = articleContent;
    }
  } catch (error) {
    console.warn('提取页面描述时出错:', error);
  }
  
  return description;
}

/**
 * 处理文本换行并限制行数
 * @param {string} text - 要处理的文本
 * @param {number} maxLines - 最大行数
 * @returns {string[]} 处理后的文本行数组
 */
function processTextLines(text, maxLines) {
  // 将文本按行分割
  const lines = text.split('\n');
  
  // 限制行数
  const truncatedLines = lines.slice(0, maxLines);
  
  // 如果文本被截断，添加省略号
  if (lines.length > maxLines) {
    truncatedLines[maxLines - 1] += '...';
  }
  
  return truncatedLines;
}

/**
 * 创建 YouMind Logo 的 SVG 元素
 * @param {number} width - SVG 宽度
 * @param {number} height - SVG 高度
 * @param {string} color - SVG 颜色
 * @returns {SVGElement} 创建的 SVG 元素
 */
function createYouMindLogoSvg(width = 34, height = 20, color = 'currentColor') {
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNamespace, 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', '0 0 34 20');
  svg.setAttribute('fill', color);
  
  const path = document.createElementNS(svgNamespace, 'path');
  path.setAttribute('fill-rule', 'evenodd');
  path.setAttribute('clip-rule', 'evenodd');
  path.setAttribute('d', 'M5.33333 4.06667C5.33333 1.82071 3.51262 0 1.26667 0H0V13.8333C0 17.2391 2.7609 20 6.16667 20C9.57243 20 12.3333 17.2391 12.3333 13.8333L12.3333 12.0333L12.3333 8.01667L12.3333 6.73334C12.3333 4.85557 13.8556 3.33334 15.7333 3.33334C17.6111 3.33334 19.1333 4.85557 19.1333 6.73334V17.3333C19.1333 18.8061 20.3272 20 21.8 20H24.7333V7.03334C24.7333 3.14893 21.5844 7.80279e-06 17.7 7.80279e-06C13.8156 7.80279e-06 10.6667 3.14893 10.6667 7.03334L10.6667 8.01667L10.6667 12.0333L10.6667 14C10.6667 15.4728 9.47275 16.6667 8 16.6667C6.52725 16.6667 5.33333 15.4728 5.33333 14V4.06667ZM25.5866 3.49163C27.2184 4.77318 28.3 6.76418 28.3 9V17.3333C28.3 18.8061 29.4939 20 30.9666 20H33.3333V9.66667C33.3333 9.44151 33.3216 9.21909 33.2986 9C32.9655 5.81556 30.2726 3.33334 26.9999 3.33334C26.5432 3.33334 26.0978 3.38169 25.6684 3.47355C25.6411 3.4794 25.6138 3.48543 25.5866 3.49163Z');
  svg.appendChild(path);
  
  return svg;
}

/**
 * 确保 Canvas 上下文支持 roundRect 方法
 * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
 */
function ensureRoundRectSupport(ctx) {
  if (!ctx.roundRect) {
    // 如果浏览器不支持 roundRect，添加一个兼容实现
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
      if (width < 2 * radius) radius = width / 2;
      if (height < 2 * radius) radius = height / 2;
      this.beginPath();
      this.moveTo(x + radius, y);
      this.arcTo(x + width, y, x + width, y + height, radius);
      this.arcTo(x + width, y + height, x, y + height, radius);
      this.arcTo(x, y + height, x, y, radius);
      this.arcTo(x, y, x + width, y, radius);
      this.closePath();
      return this;
    };
  }
}

/**
 * 将 SVG 元素绘制到 Canvas 上
 * @param {SVGElement} svgElement - 要绘制的 SVG 元素
 * @param {CanvasRenderingContext2D} ctx - 目标 Canvas 上下文
 * @param {number} x - 绘制位置的 X 坐标
 * @param {number} y - 绘制位置的 Y 坐标
 * @param {number} width - 绘制宽度
 * @param {number} height - 绘制高度
 * @returns {Promise<void>} 当绘制完成时解析的 Promise
 */
async function drawSvgToCanvas(svgElement, ctx, x, y, width, height) {
  // 创建一个新的 canvas 来绘制 SVG
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d');
  
  // 将 SVG 转换为数据 URL
  const svgData = new XMLSerializer().serializeToString(svgElement);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const DOMURL = window.URL || window.webkitURL || window;
  const svgUrl = DOMURL.createObjectURL(svgBlob);
  
  // 创建一个图像对象来加载 SVG
  const img = new Image();
  img.src = svgUrl;
  
  // 等待图像加载完成
  await new Promise((resolve) => {
    img.onload = function() {
      // 绘制到临时 canvas
      tempCtx.drawImage(img, 0, 0, width, height);
      // 将临时 canvas 绘制到目标 canvas
      ctx.drawImage(tempCanvas, x, y);
      // 释放 URL 对象
      DOMURL.revokeObjectURL(svgUrl);
      resolve();
    };
  });
}

/**
 * 在画布上绘制换行文本
 * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
 * @param {string[]} lines - 要绘制的文本行
 * @param {number} x - 起始 X 坐标
 * @param {number} y - 起始 Y 坐标
 * @param {number} maxWidth - 文本最大宽度
 * @param {number} lineHeight - 行高
 * @returns {number} 绘制完所有文本后的 Y 坐标
 */
function drawWrappedText(ctx, lines, x, y, maxWidth, lineHeight) {
  let currentY = y;
  
  for (let i = 0; i < lines.length; i++) {
    const chars = lines[i].split('');
    let line = '';
    let lineY = currentY;
    
    for (let j = 0; j < chars.length; j++) {
      const testLine = line + chars[j];
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > maxWidth) {
        ctx.fillText(line, x, lineY);
        line = chars[j];
        lineY += lineHeight;
      } else {
        line = testLine;
      }
    }
    
    if (line) {
      ctx.fillText(line, x, lineY);
      currentY = lineY;
    }
    
    currentY += lineHeight;
  }
  
  return currentY;
}

// YouMind 主题色变量
const youmindTheme = {
  // 基础颜色
  background: '#ffffff',       // 背景色（白色）
  primary: '#000000',         // 主要文字颜色（黑色）
  secondary: '#333333',       // 次要文字颜色（深灰色）
  border: '#000000',          // 边框颜色（黑色）
  backgroundAlt: '#000000',   // 次要背景色（黑色）
  radius: 0,                  // 圆角半径
  
  // 按钮颜色
  buttonPrimary: '#2D2D2D',    // 主要按钮颜色（深灰色）
  buttonPrimaryHover: '#1A1A1A', // 主要按钮悬停颜色
  buttonSuccess: '#4CAF50',    // 成功按钮颜色
  buttonSuccessHover: '#45a049', // 成功按钮悬停颜色
  buttonInfo: '#2196F3',       // 信息按钮颜色
  buttonInfoHover: '#0b7dda',  // 信息按钮悬停颜色
  buttonDanger: '#f44336',     // 危险按钮颜色
  buttonDangerHover: '#d32f2f', // 危险按钮悬停颜色
  
  // 通知颜色
  notificationSuccess: '#4caf50', // 成功通知颜色
  notificationError: '#f44336',   // 错误通知颜色
  notificationWarning: '#ff9800', // 警告通知颜色
  notificationInfo: '#2196f3'     // 信息通知颜色
};

// 生成分享图的函数
async function generateShareImage(dialogElement) {
  try {
    // 显示加载状态
    showNotification('正在生成分享图...', 'info');
    
    // 获取分享链接
    let shareLink = '';
    
    // 尝试不同的选择器来找到分享链接元素
    const linkElements = [
      dialogElement.querySelector('div.flex.w-full.items-center.justify-between.rounded-xl.bg-card-snips'),
      dialogElement.querySelector('div.flex.w-full.items-center.justify-between'),
      dialogElement.querySelector('input[type="text"][readonly]'),
      dialogElement.querySelector('div.flex.w-full input')
    ];
    
    // 遍历所有可能的元素
    for (const element of linkElements) {
      if (!element) continue;
      
      // 检查是否是输入框
      if (element.tagName === 'INPUT' && element.value) {
        shareLink = element.value;
        console.log('从输入框获取到分享链接:', shareLink);
        break;
      }
      
      // 检查是否是包含开关的元素
      const toggleButton = element.querySelector('button[role="switch"]');
      if (toggleButton) {
        // 确保开关已打开
        // if (toggleButton.getAttribute('aria-checked') !== 'true') {
        //   console.log('分享开关未打开，点击开关');
        //   toggleButton.click();
        //   // 等待一下开关生效
        //   await new Promise(resolve => setTimeout(resolve, 100));
        // }
        
        // 尝试找到相关的输入框
        const input = dialogElement.querySelector('input[type="text"][readonly]');
        if (input && input.value) {
          shareLink = input.value;
          console.log('从开关相关输入框获取到分享链接:', shareLink);
          break;
        }
      }
      
      // 如果是包含文本的元素，尝试获取文本内容
      const textContent = element.textContent.trim();
      if (textContent && textContent.startsWith('http')) {
        shareLink = textContent;
        console.log('从文本内容获取到分享链接:', shareLink);
        break;
      }
    }
    
    // 如果没有获取到链接，使用当前页面URL
    if (!shareLink) {
      shareLink = window.location.href;
    }
    
    // 获取页面标题
    let pageTitle = '';
    
    // 尝试从输入元素中获取标题
    const inputElement = await findInputElement();
    if (inputElement) {
      // 根据元素类型获取内容
      if (inputElement.value !== undefined) {
        pageTitle = inputElement.value.trim();
      } else if (inputElement.textContent) {
        pageTitle = inputElement.textContent.trim();
      } else if (inputElement.innerHTML) {
        // 如果是contentEditable元素，可能需要处理HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = inputElement.innerHTML;
        pageTitle = tempDiv.textContent.trim();
      }
    }
    
    // 如果从输入元素中没有获取到标题，尝试从对话框中获取
    if (!pageTitle) {
      const titleElements = [
        dialogElement.querySelector('input[placeholder="添加标题"]'),
        dialogElement.querySelector('input[placeholder*="标题"]'),
        dialogElement.querySelector('input.title-input'),
        dialogElement.querySelector('.title-input'),
        dialogElement.querySelector('input.w-full'),
        dialogElement.querySelector('textarea.w-full')
      ];
      
      // 遍历所有可能的标题元素
      for (const element of titleElements) {
        if (!element) continue;
        
        // 检查是否有值
        if (element.value && element.value.trim()) {
          pageTitle = element.value.trim();
          break;
        }
        
        // 如果没有value属性，尝试获取文本内容
        if (element.textContent && element.textContent.trim()) {
          pageTitle = element.textContent.trim();
          break;
        }
      }
    }
    
    // 如果没有获取到标题，使用页面标题
    if (!pageTitle) {
      pageTitle = document.title || 'Shared Content';
    }
    
    // 创建一个canvas元素来绘制分享图
    const canvas = document.createElement('canvas');
    canvas.width = 800; // 减小宽度
    canvas.height = 1000; // 减小高度
    const ctx = canvas.getContext('2d');
    
    // 确保 roundRect 方法可用
    ensureRoundRectSupport(ctx);
    
    // 绘制矩形背景，去除圆角和阴影
    
    // 绘制矩形
    ctx.fillStyle = youmindTheme.background; // 白色背景
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.fill();
    
    // 获取当前日期和时间
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const dateTimeStr = `${dateStr} ${timeStr}`;
    
    // 设置标题文本
    ctx.fillStyle = youmindTheme.primary; // 黑色文本
    ctx.font = 'bold 32px Arial, "Microsoft YaHei", "微软雅黑"'; // 减小字体大小
    ctx.textAlign = 'left'; // 文字左对齐
    
    // 文本换行处理
    const maxWidth = canvas.width - 100; // 调整左右边距
    const lineHeight = 50; // 增加行高，增加行间距
    
    // 获取内容描述
    let contentDescription = getContentFromYouMind();
    
    // 如果没有从 YouMind 编辑器获取到内容，尝试从页面中提取
    if (!contentDescription) {
      contentDescription = getDescriptionFromPage();
    }
    
    // 处理内容文本，限制行数
    const maxContentLines = 15; // 增加显示行数
    const contentLines = processTextLines(contentDescription, maxContentLines);
    
    // 开始绘制内容，从中间位置开始
    let y = canvas.height / 2 - 250; // 调整起始位置以适应更小的画布
    
    // 绘制内容
    ctx.font = '26px Arial, "Microsoft YaHei", "微软雅黑"'; // 减小字体大小
    
    // 将内容按照最大宽度分行
    const wrappedContentLines = [];
    
    for (const line of contentLines) {
      // 判断是否为中文文本
      const isChinese = /[\u4e00-\u9fa5]/.test(line);
      
      if (isChinese) {
        // 中文文本处理，按字符分割
        let currentLine = '';
        for (let i = 0; i < line.length; i++) {
          const char = line.charAt(i);
          const testLine = currentLine + char;
          const metrics = ctx.measureText(testLine);
          
          if (metrics.width > maxWidth && currentLine !== '') {
            wrappedContentLines.push(currentLine);
            currentLine = char;
          } else {
            currentLine = testLine;
          }
        }
        
        if (currentLine) {
          wrappedContentLines.push(currentLine);
        }
      } else {
        // 英文文本处理，按空格分割
        const words = line.split(' ');
        let currentLine = '';
        
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const metrics = ctx.measureText(testLine);
          
          if (metrics.width > maxWidth && currentLine !== '') {
            wrappedContentLines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        
        if (currentLine) {
          wrappedContentLines.push(currentLine);
        }
      }
    }
    
    // 限制内容行数
    const limitedContentLines = wrappedContentLines.slice(0, 15);
    
    // 使用左对齐绘制内容
    for (let i = 0; i < limitedContentLines.length; i++) {
      ctx.fillText(limitedContentLines[i], 100, y);
      y += lineHeight;
    }
    
    // 在内容后添加书名号和标题
    if (pageTitle && pageTitle.trim() !== '') {
      // 增加一些空间
      y += 40;
      
      // 绘制书名号开始符号
      ctx.font = '32px Arial, "Microsoft YaHei", "微软雅黑"';
      ctx.fillStyle = '#666666'; // 使破折号颜色更浅
      ctx.textAlign = 'left';
      ctx.fillText('——', 100, y - 20); // 破折号位置
      
      // 在作者后留出空间再绘制标题
      // 将标题按照最大宽度分行
      const titleLines = [];
      
      // 判断是否为中文文本
      const isChinese = /[\u4e00-\u9fa5]/.test(pageTitle);
      
      if (isChinese) {
        // 中文文本处理，按字符分割
        let currentLine = '';
        for (let i = 0; i < pageTitle.length; i++) {
          const char = pageTitle.charAt(i);
          const testLine = currentLine + char;
          const metrics = ctx.measureText(testLine);
          
          if (metrics.width > maxWidth - 350 && currentLine !== '') { // 留出更多空间给作者信息
            titleLines.push(currentLine);
            currentLine = char;
          } else {
            currentLine = testLine;
          }
        }
        
        if (currentLine) {
          titleLines.push(currentLine);
        }
      } else {
        // 英文文本处理，按空格分割
        const words = pageTitle.split(' ');
        let currentLine = '';
        
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const metrics = ctx.measureText(testLine);
          
          if (metrics.width > maxWidth - 350 && currentLine !== '') { // 留出更多空间给作者信息
            titleLines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        
        if (currentLine) {
          titleLines.push(currentLine);
        }
      }
      
      // 限制标题行数
      const limitedTitleLines = titleLines.slice(0, 2);
      
      // 在破折号后绘制标题，字体比内容小，并用《》包裹
      ctx.font = '24px Arial, "Microsoft YaHei", "微软雅黑"'; // 标题字体比内容小
      ctx.fillStyle = '#666666'; // 使标题颜色与破折号一致，更浅
      y += 10; // 增加一点空间，避免与书名号重叠
      
      // 将标题放在破折号后面，并用《》包裹
      if (limitedTitleLines.length > 0) {
        const formattedTitle = `《${limitedTitleLines[0]}》`;
        ctx.fillText(formattedTitle, 160, y - 30); // 调整位置使其与破折号对齐
        
        // 如果有第二行，单独显示
        if (limitedTitleLines.length > 1) {
          ctx.fillText(limitedTitleLines[1], 160, y + 10);
        }
      }
    } else {
      // 如果没有标题，只显示书名号
      y += 40;
      
      // 绘制书名号开始符号
      ctx.font = '32px Arial, "Microsoft YaHei", "微软雅黑"';
      ctx.fillStyle = '#666666'; // 使破折号颜色更浅
      ctx.textAlign = 'left';
      ctx.fillText('——', 100, y - 20); // 破折号位置
    }
    
    // 在中间位置绘制分割线和作者信息
    // 创建一个黑色的水平线
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 - 80, canvas.height - 100);
    ctx.lineTo(canvas.width / 2 + 80, canvas.height - 100);
    ctx.strokeStyle = youmindTheme.primary; // 黑色
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 在黑线下方绘制 YouMind logo 和文字作为作者
    const bottomLogoSvg = createYouMindLogoSvg(30, 22, youmindTheme.primary); // 黑色logo，缩小尺寸
    await drawSvgToCanvas(bottomLogoSvg, ctx, canvas.width / 2 - 45, canvas.height - 73, 30, 22);
    
    // 添加 YouMind 文字作为作者
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = youmindTheme.primary; // 黑色文字
    ctx.textAlign = 'left';
    ctx.fillText('YouMind', canvas.width / 2 - 10, canvas.height - 55); // 进一步调整文字位置，使其与logo基线对齐
    
    // 转换canvas为图片URL
    const imageUrl = canvas.toDataURL('image/png');
    
    // 创建预览对话框
    createImagePreviewDialog(imageUrl, pageTitle);
    
    showNotification('分享图已生成，请选择操作', 'success');
  } catch (error) {
    console.error('生成分享图失败:', error);
    showNotification('生成分享图失败', 'error');
  }
}

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', async function() {
  try {
    // 获取配置并检查当前域名是否在允许列表中
    const config = await getUserConfig();
    if (!isAllowedDomain(config.allowedDomains)) {
      return; // 如果不在允许的域名列表中，则不执行后续操作
    }
    
    // 尝试查找输入框
    await findAndProcessInputElement();
    
    // 检测分享对话框
    await detectShareDialog();
    
    // 设置MutationObserver以处理动态加载的内容
    setupMutationObserver();
  } catch (error) {
    console.error('初始化内容脚本错误:', error);
  }
});

// 确保在页面已经加载的情况下也能运行
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  getUserConfig().then(config => {
    if (!isAllowedDomain(config.allowedDomains)) {
      return; // 如果不在允许的域名列表中，则不执行后续操作
    }
    
    findAndProcessInputElement().catch(error => {
      console.error('页面已加载状态下初始化错误:', error);
    });
    
    // 检测分享对话框
    detectShareDialog().catch(error => {
      console.error('检测分享对话框错误:', error);
    });
    
    setupMutationObserver();
  });
}

// 示例：为页面添加快捷键
// document.addEventListener('keydown', function(event) {
//   // Alt+Shift+S 快捷键
//   if (event.altKey && event.shiftKey && event.code === 'KeyS') {
//     chrome.runtime.sendMessage({
//       action: 'notification',
//       message: '您触发了快捷键！当前页面: ' + window.location.href
//     });
//   }
  
//   // Alt+Shift+T 快捷键生成标题
//   if (event.altKey && event.shiftKey && event.code === 'KeyT') {
//     chrome.runtime.sendMessage({action: 'generateTitle'});
//   }
// });

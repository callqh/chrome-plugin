// 获取用户配置
async function getUserConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      {
        apiKey: '',
        elementSelector: 'input.flex.h-10.w-full.rounded-md.border.border-input',
        buttonPosition: 'right'
      },
      function(result) {
        resolve(result);
      }
    );
  });
}

// 注释：已删除未使用的 generateTitleWithAI 函数

// 显示加载中状态
// 注释：已删除未使用的 showLoadingState 函数

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
    notification.style.backgroundColor = '#4caf50';
  } else if (type === 'error') {
    notification.style.backgroundColor = '#f44336';
  } else {
    notification.style.backgroundColor = '#2196f3';
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
      console.log("👾👾👾 == getUserConfig == config:", config);
      
      // 先尝试查找现有输入框
      let inputElement = document.querySelector(config.elementSelector);
      
      // 如果找不到，尝试使用更智能的方法查找
      if (!inputElement) {
        console.log('尝试智能查找输入框');
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
      
        console.log('尝试查找YouMind编辑器内容区域元素');
        
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
            console.log('找到YouMind编辑器元素，使用选择器:', selector);
            break;
          }
        }
        
        // 存储原始的inputElement引用
        const originalInputElement = inputElement;
        
        // 如果找到了YouMind编辑器的内容区域元素
        if (youmindContentElement) {
          console.log('找到YouMind编辑器内容区域元素:', youmindContentElement);
          
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
            console.log('从段落中提取的内容:', originalText);
          }
          
          // 如果还是为空，尝试获取HTML内容
          if (!originalText || originalText.trim() === '') {
            console.log('尝试获取HTML内容');
            const htmlContent = youmindElement.innerHTML;
            console.log('HTML内容:', htmlContent);
            
            // 创建一个临时元素来提取纯文本
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;
            originalText = tempDiv.textContent || tempDiv.innerText;
            console.log('从HTML提取的纯文本:', originalText);
          }
        }
      }
      
      // 如果还是没有内容，尝试从页面中获取所有可见文本
      if (!originalText || originalText.trim() === '') {
        console.log('尝试从页面中获取所有可见文本');
        
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
  
  // 创建 SVG 图标 - 尺寸更小
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
  button.title = '点击生成标题';
  
  // 设置按钮样式 - 使用YouMind的主题色，尺寸更小更精致
  button.style.position = 'absolute';
  button.style.zIndex = '1000';
  button.style.padding = '5px 10px';
  button.style.backgroundColor = '#2D2D2D'; // YouMind深灰色主题
  button.style.color = 'white';
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
    this.style.backgroundColor = '#1A1A1A'; // 更深的灰色
    this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
    this.style.transform = 'translateY(-52%)';
  });
  button.addEventListener('mouseout', function() {
    this.style.backgroundColor = '#2D2D2D'; // 恢复到原始的深灰色
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

// 检测和处理目标输入框
async function findAndProcessInputElement() {
  try {
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
            if (el.offsetParent !== null && el.offsetWidth > 50 && el.offsetHeight > 20) {
              inputElement = el;
              break;
            }
          }
          if (inputElement) break;
        }
      }
      
      // 如果还是找不到，列出所有输入框供调试
      if (!inputElement) {
        const allInputs = findAllInputElements();
        console.log('页面上所有可能的输入框:', allInputs);
        
        // 尝试选择一个可见的输入框
        const visibleInputs = allInputs.filter(i => i.visible && i.width > 50 && i.height > 20);
        if (visibleInputs.length > 0) {
          inputElement = visibleInputs[0].element;
        }
      }
    }
    
    if (inputElement) {
      await createTitleButton(inputElement);
      return true;
    } else {
      console.error('未找到可用的输入框');
      return false;
    }
  } catch (error) {
    console.error('处理输入框错误:', error);
    return false;
  }
}

// 使用MutationObserver监听DOM变化，以便在动态加载的页面上也能找到输入框
function setupMutationObserver() {
  const observer = new MutationObserver(function(mutations) {
    // 使用节流函数减少频繁检查
    if (observer.timeout) {
      clearTimeout(observer.timeout);
    }
    
    observer.timeout = setTimeout(async function() {
      try {
        await findAndProcessInputElement();
      } catch (error) {
        console.error('处理DOM变化错误:', error);
      }
    }, 500); // 500ms的节流时间
  });
  
  // 开始观察文档体的变化
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  } else {
    // 如果文档体还不存在，等待它加载
    document.addEventListener('DOMContentLoaded', function() {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  }
}

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', async function() {
  try {
    // 尝试查找输入框
    await findAndProcessInputElement();
    
    // 设置MutationObserver以处理动态加载的内容
    setupMutationObserver();
  } catch (error) {
    console.error('初始化内容脚本错误:', error);
  }
});

// 确保在页面已经加载的情况下也能运行
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  findAndProcessInputElement().catch(error => {
    console.error('页面已加载状态下初始化错误:', error);
  });
  setupMutationObserver();
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

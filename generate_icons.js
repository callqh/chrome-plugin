// 这个脚本用于生成简单的占位图标
// 请在浏览器控制台中运行以下代码

function generateIcon(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // 绘制背景
  ctx.fillStyle = '#4285f4';
  ctx.fillRect(0, 0, size, size);
  
  // 绘制边框
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = size * 0.08;
  ctx.strokeRect(size * 0.15, size * 0.15, size * 0.7, size * 0.7);
  
  // 绘制文字
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size * 0.6}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('助', size / 2, size / 2);
  
  return canvas.toDataURL('image/png');
}

// 生成并下载图标
function downloadIcon(size) {
  const dataUrl = generateIcon(size);
  const link = document.createElement('a');
  link.download = `icon${size}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 生成三种尺寸的图标
console.log('请右键点击以下链接并选择"另存为..."，将图标保存到images文件夹中');
console.log('图标16x16:', generateIcon(16));
console.log('图标48x48:', generateIcon(48));
console.log('图标128x128:', generateIcon(128));

// 自动下载图标（如果浏览器允许）
try {
  downloadIcon(16);
  setTimeout(() => downloadIcon(48), 500);
  setTimeout(() => downloadIcon(128), 1000);
  console.log('图标已自动下载，请将它们移动到插件的images文件夹中');
} catch (e) {
  console.error('自动下载失败，请手动保存上面的图标:', e);
}

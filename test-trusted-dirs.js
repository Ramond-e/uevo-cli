const { getToolWorkspacePath } = require('./packages/core/dist/core/prompts.js');

// 简单测试函数
function testTrustedDirs() {
  try {
    console.log('当前 UEVO_TESTSPACE 环境变量:', process.env.UEVO_TESTSPACE);
    
    // 直接测试 getToolWorkspacePath 函数
    const testspacePath = getToolWorkspacePath();
    console.log('getToolWorkspacePath() 返回的路径:', testspacePath);
    
    // 模拟配置加载过程
    console.log('\n模拟配置加载过程...');
    
    // 检查环境变量情况
    const envTrustedDirs = process.env.UEVO_TRUSTED_DIRS;
    if (envTrustedDirs) {
      const directories = envTrustedDirs.split(require('path').delimiter).filter(dir => dir.trim());
      if (!directories.includes(testspacePath)) {
        directories.push(testspacePath);
      }
      console.log('从环境变量加载的受信目录 (包含testspace):', directories);
    } else {
      console.log('没有设置 UEVO_TRUSTED_DIRS 环境变量');
      console.log('将使用默认配置，包含testspace路径:', [testspacePath]);
    }
    
  } catch (error) {
    console.error('测试出错:', error);
  }
}

testTrustedDirs();
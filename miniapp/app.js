// 小兔头节拍器 - 微信小程序
// 移植自 https://jpq.weichao.studio/

// 友盟 SDK 接入 —— 提供基础 PV/UV + 自定义事件（bpm_change / sound_mode / ...）
// 文档：https://developer.umeng.com/docs/147615/detail/147618
// 注：WeChat 小程序的 npm 包必须在 WeChat DevTools 工具 → "构建 npm" 后才能用
import 'umtrack-wx';

App({
  onLaunch() {},
  /**
   * 友盟 umengConfig：友盟 SDK 读取此字段完成初始化
   * 字段名 / 拼写必须严格按官方文档，SDK 不会警告错误
   */
  umengConfig: {
    appKey: '6a2c26296f259537c7b86592',
    // 使用 Openid 统计更准；需要后台配置 appId+secret 才能开启
    useOpenid: false,
    autoGetOpenid: false,
    debug: false,
    // 上传用户画像用于后台用户分析（需要隐私协议）
    uploadUserInfo: false,
  },
});

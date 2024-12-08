# Voice Chat Application
这个项目目前还没有一个正式的名字，所以暂时叫它"Decentralized Voice Chat Application"
并且它还处于早期开发阶段，存在很多问题和不足

> 这是一个milestone版本，实现了tailscale的嵌入，并更改了一些业务逻辑

## 概述

这是一个使用electron，react和vite搭建的去中心化语言聊天软件。基于私有tailscale网络控制器和自建的derp服务，通过全拓扑webrtc连接实现无中心服务的多人语音聊天
<br/>
私有的tailscale控制器和derp服务部署在位于广州的腾讯云上，可以让国内设备无障碍连接
```
* DERP latency:
    - ts-gz: 24.6ms  (tencent GuangZhou)
    - tok: 112.4ms (Tokyo)
    - blr: 135.8ms (Bangalore)
    - hkg: 148.8ms (Hong Kong)
    - sea: 176.1ms (Seattle)
    - sin: 180.6ms (Singapore)
    - lax: 186.3ms (Los Angeles)
    - sfo: 187.9ms (San Francisco)          
```
私有tailscale服务来自 https://headscale.net/
<br/>derp服务来自 https://github.com/yangchuansheng/ip_derper
<br/>用户可以在设置中更改headscale控制器地址和对应的管理服务地址


这个基于tailscale的webrtc连接的模式优势就在于几乎不存在运营成本和监管问题，大多数情况下两个tailscale节点可以通过这个headscale控制器实现点对点直连
<br/>如果存在打洞失败的情况，流量也可以通过derp转发到对等点处，derp只负责流量转发，完全不具备解密数据的功能

在ui设计上很大程度地参考了Discord的布局

### 核心功能
- [x] 嵌入式 Tailscale 客户端
  - 无需单独安装 Tailscale
  - 支持私有 Headscale 控制器
- [x] WebRTC 语音通话
  - 点对点连接
  - 支持多人语音
- [x] 本地音频管理
  - 输入/输出音量调节
  - RNN 降噪处理
  - 实时频谱显示
- [x] Windows 进程音频捕获
  - 支持捕获指定进程音频
  - 可调节采样间隔
- [x] 屏幕共享

## 技术栈

- Electron
- React + Vite
- Tailwind CSS
- WebRTC
- shadcn/ui
- dnd-kit
- Go (Tailscale 集成)

## 实现细节

### Tailscale嵌入
由tailscale提供的go库搭建了一个独立的简易版tailscale客户端，编译为dll后在主进程中加载
在dll中提供了一个本地代理层用于转发来自前端的请求到tailscale网络中，并在此基础上建立webRTC连接

### 音频处理
- RNN 降噪：使用 RNNoise 实现实时降噪
- 进程音频捕获：通过原生 Node 模块实现 Windows 进程音频捕获
- 频谱显示：使用 Canvas 绘制实时音频频谱

### WebRTC 连接
基于 Tailscale 网络实现点对点连接：
- 通过 DataChannel 同步用户状态
- 支持音频流和视频流的动态切换
- 自动重连机制

### 用户拖动
使用dnd-kit实现用户拖动，但目前并未为拖动动作做任何响应处理

### 屏幕共享
得益于tailscale的点到点连接，屏幕共享所使用的最大资源只受客户端所能提供的资源限制
需要在使用derp转发流量时主动限制其网络带宽使用量
用户当然可以手动控制其资源使用量和视频流质量之间的平衡


https://github.com/user-attachments/assets/e7170fb6-0abc-489f-87c5-fc722efafcfb




## 打包
无

# Voice Chat Application
这个项目目前还没有一个正式的名字，所以暂时叫它"voicechat-electron-tailscale-react-shadcn-forge"
并且它还处于早期开发阶段，存在很多问题和不足

There is no sepcific name for this project, so i call it "voicechat-electron-tailscale-react-shadcn-forge", like the name in `package.json`

This is an Electron-based voice chat application using React, Tailwind CSS, and Tailscale integration.

## MVP功能
- [ ] 嵌入式tailscale客户端
- 频道机制
  - [ ] 对用户静音
  - [ ] 静音用户
- 本地音频管理
  - [x] webrtc语音聊天
  - [x] 输入音量调整
  - [x] 输出音量调整
  - [x] 频谱显示



## 非MVP功能
- [x] windows进程音频捕获
- [ ] 用户状态展示
- [x] 输入降噪
- [x] 漂亮的用户界面？
- [ ] 聊天支持动态emoji
- [ ] 文件传送
- [ ] 屏幕共享
- [ ] 观看同一视频bilibili，youtube
- [ ] 响应式的输入输出音量调整滑块

## 已知问题
- 进入channel后使用process audio capture可能会导致前端崩溃


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

**由于headscale在acl（访问控制规则）中还不支持使用autogroup，目前所有设备都有互相访问的能力**
<br/>

>由于没有中心服务，所有的配置文件，频道和聊天信息都保存在每个客户端本地，并在成功建立rtc连接时互换这些信息，再选取一份作为共识，这一点上还有很多需要改进的

这个基于tailscale的webrtc连接的模式优势就在于几乎不存在运营成本和监管问题，大多数情况下两个tailscale节点可以通过这个headscale控制器实现点对点直连
<br/>如果存在打洞失败的情况，流量也可以通过derp转发到对等点处，derp只负责流量转发，完全不具备解密数据的功能

在ui设计上很大程度地参考了Discord的布局


## 使用工具

- Electron
- React
- Vite
- Tailwind CSS
- Socket.IO
- Tailscale (not including)
- shadcn/ui
- koffi
- Electron forge

## 项目结构

- `/app`: electron主进程及preload文件
- `/src`: React前端内容
- `/go_module`: go编写的tailscale交互方法，通过dll被调用
- `/resources`: 配置文件及聊天和频道记录文件等
- `/dist`: 前端编译输出文件夹(in gitignore)
- `/out`: 应用打包输出文件夹(in gitignore)

## 一些技术细节

### 与Tailscale守护进程交互

与Tailscale守护进程交互是通过go编译的dll实现的，electron主进程通过koffi使用这个编译得到的dll
<br/>源代码及可用dll位于`/go_module`
<br/>使用go编译的主要原因是tailcale提供go语言的sdk，其可以与tailscale守护进程高效交互
<br/>由于我没有找到tailscale关于这个sdk的详细使用文档，大多数用法来自查找[go的tailscale包api文档](https://pkg.go.dev/tailscale.com/client/tailscale#Device.NodeKey)以及查看[cattail](https://github.com/nerdyslacker/cattail)的源码

### 后端(主进程)

- 启动时生成本机uuid，该uuid会被用于决定是否发起offer。<br/>这里使用了一个简单的uuid比较逻辑：先启动的客户端会作为offer发起方
- 根据前端需求读取和保存配置文件，聊天记录，频道信息
- 提供运行在8848端口上的socket服务，并转发相应的webrtc连接信息<br/>该socket服务附加在express上
- 提供electron前端窗口，webrtc-internal窗口和devtool窗口为调试所需
- 使用koffi与dll交互，获取tailscale守护进程信息

### preload.js

- `ipcBridge`: 用于前端与主进程交流的ipcBridge，还包含自定义标题栏用于控制窗口动作的方法
- `winAudioCapture`: 暴露用于控制原生node模块的方法，以及获取electron音频进程pid的方法（在音频捕获时用于排除electron自身）


### 前端(渲染进程)

前端所有内容均位于`/src`

前端实现了以下功能：
- socket连接及重连逻辑
- webrtc角色决定，连接，重连及连接管理
- tailscale状态展示
- 本地音频管理，rnn降噪处理，本地进程音频捕获
- 利用webrtc的datachannel建立的基础信息交换机制，包括聊天和频道信息共识
- 通过webrtc建立最终语言通话连接

tailscale信息管理，socket管理，webrtc连接管理，本地音频管理均通过react context提供给其他组件

[转到上文提到的代码段](./src/App.jsx#L18)

前端界面使用三段式布局，得益于shadcn的resizable panel三段布局的宽度可以任意调整<br/>
大量使用[shadcn](https://ui.shadcn.com/)组件和[lucide](https://lucide.dev/icons/)图标库<br/>
背景来自[aceternity](https://ui.aceternity.com/)的[backgroundbeams](https://ui.aceternity.com/components/background-beams)

RNN降噪开关来自 https://uiverse.io/Admin12121/massive-dodo-67
<br/>并在其基础上改造成了react组件

一些来自shadcn/ui的组件经过我的改造以适应需求

动态emoji来自 https://googlefonts.github.io/noto-emoji-animation/
<br/>通过Lottie播放和定制<br/>为了展示静态图像，每个动态emoji都配有对应的静态svg，这些静态svg也来自该网站，但是是从devTool中手动获取的

![screenShot](./assets/Screenshot%202024-10-07%20231424.png)

与tailscale网络交互
- 创建新的网络（在headscale上仅以用户名区别，同时生成一个一次性的不过期的preauth key）
- 邀请新用户（新设备的唯一加入方式是preauth key）
- 加入网络（只能通过输入preauth key加入）
- ~~快速切换网络（未完成）~~
![createPanel](./assets/Screenshot%202024-10-07%20234758.png)

用户设置页面
![userPanel](./assets/Screenshot%202024-10-07%20234925.png)

### 输入降噪

用户的输入音频降噪来自RNNoise项目，这是一个在前端即可实时运行的神经网络降噪模型
https://jmvalin.ca/demo/rnnoise
<br/>该降噪模型默认开启，可在设置中关闭

![settingPanel](./assets/Screenshot%202024-10-07%20234730.png)

### 频谱显示

频谱显示模块通过在canvas上绘制柱子实现，柱子高度通过简单的快速傅里叶变换计算得到

[转到上文提到的代码段](./src/utils/AudioLevelVisualizer.js#1)

### 音频捕获插件

捕获本地进程播放的音频并与输入音频合并的功能来自我编写的原生node模块
该node模块使用win32api录制进程输出音频，在插件中包装成wav数据后返回给主进程，在渲染进程中解码成音频媒体流
这个原生模块允许以任意间隔请求捕获的音频数据，在指定的间隔时间内它会不断获取缓冲区内的音频数据，较长的时间间隔可以有效降低方法的请求频率，减少性能影响，同时前端得到的音频数据延迟即为给定的间隔时间
<br/>
也就是说越快的请求频率录制延迟越小，性能消耗越大

测试示例[Capture-Audio-from-Process---javascript-addon](https://github.com/Need-an-AwP/Capture-Audio-from-Process---javascript-addon)

模块打包仓库[win-process-audio-capture](https://github.com/Need-an-AwP/win-process-audio-capture)

由于处理这个插件返回的音频数据的audioworklet节点的processor注册代码不能在打包后正常导入使用，这里粗暴地使用了blob加载js代码用于创建audioworklet节点

[转到上文提到的代码段](./src/context/AudioContext.jsx#L256)

![audioCaptuRepanel](./assets/Screenshot%202024-10-07%20234717.png)

### 全局及单一用户输出音频调整

在`ChannelList.jsx`中通过来自`rtccontext`的`usertc`得到rtc连接ontrack方法获取的原始音频流stream
这里试图通过重新建立一个媒体流来使用gain节点调整音量，但是直接通过createMediaStreamSource创建audiocontext的来源无法得到有效的数据（使用analyser调试可知source中传出数据全为0）<br/>
所以使用静音播放原始流来诱骗，使audiocontext得到有效的数据，得以通过gain节点调整音量

[转到上文提到的代码段](./src/components/ChannelList.jsx#L160)

## Release

```bash
npm i
```

### 前端编译

```bash
npm run build
```
### 打包

> 在编译前端后使用

```bash
npm run package
```
使用electron forge打包windows squirrel版本
> 由于forge不支持打包protable版本， 如需portable版本， 需要使用electron builder打包

[转到上文提到的代码段](./forge.config.js#17)

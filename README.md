# Rank Lab · SVD 图像实验室

浏览器端的互动实验。保留前 k 项奇异值，查看上传照片的重建图、实时公式与理论数值个数。

**[打开在线实验](https://haoweiyuan88-wq.github.io/rank-lab-svd/)** · [课堂投影二维码](assets/class-qr.png)

点「上传自己的图片」，或选择一张示例图。先把 k 调到 5，再调到 20，观察哪些细节变清楚，以及公式求和的上限如何改变。右上角「分享实验」可以显示二维码，照片只在各自设备上处理。

## 同一 Wi-Fi 下的课堂备用方式

解压 Rank-Lab-Classroom.zip，在与手机同一可互访网络的 Mac 上双击 Start-Class.command。在开课电脑的浏览器中投影自动生成的二维码。Python 只提供静态网页；学生选择的照片在各自设备上处理。

## 本地开发与静态托管

在本目录运行 python3 -m http.server 8000 ，然后在浏览器打开 http://localhost:8000/ 。GitHub Pages 可以从仓库根目录发布。分享对话框使用当前网址的路径，并移除查询参数和片段。同网模式使用演示电脑的局域网地址。在单独的本地文件或 localhost 上，页面会给出分享方法。

## 文件

- index.html、style.css、app.js 是页面、样式和交互逻辑。
- svd-worker.js 负责 SVD 计算和重建。
- sharing.js 和 assets/qr-code.js 在本机生成二维码。第三方二维码组件的授权说明保留在源码头部。
- assets/ 还包含示例照片和图标。图片来源和授权见页面页脚。
- classroom/ 保存了课堂服务器和打包程序。运行 python3 classroom/package.py 可以重建 Rank-Lab-Classroom.zip。

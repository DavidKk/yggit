Yggit · macOS 首次打开 / First launch on macOS
==============================================

【中文】

Yggit 是开源免费工具，暂未购买 Apple 开发者证书做签名公证，
从浏览器下载后 macOS 可能提示「已损坏，无法打开」。App 本身没有问题。

将压缩包里的 Yggit.app 拖到「应用程序」，然后在「终端」执行一次：

    xattr -cr /Applications/Yggit.app

之后双击 Yggit 即可正常打开，只需要做一次。

如果提示的是「无法验证开发者」而不是「已损坏」，也可以不用终端：
  ・macOS 14 及更早：右键 Yggit →「打开」→ 再点「打开」。
  ・macOS 15 及更新：「系统设置 → 隐私与安全性」底部点「仍要打开」。


[English]

Yggit is a free open-source tool and is not yet signed / notarized with an
Apple Developer certificate. After downloading in a browser, macOS may say the
app "is damaged and can't be opened". The app is fine.

Drag Yggit.app from this zip into Applications, then run once in Terminal:

    xattr -cr /Applications/Yggit.app

After that Yggit opens normally with a double-click. You only need to do this once.

If macOS says it "cannot verify the developer" instead of "damaged", no Terminal needed:
  - macOS 14 or earlier: right-click Yggit → Open → Open.
  - macOS 15 or later: System Settings → Privacy & Security → "Open Anyway".

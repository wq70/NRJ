import UIKit
import Capacitor
import WebKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CommerceBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

class CommerceBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() { bridge?.registerPluginInstance(CommerceBrowserPlugin()) }
}

@objc(CommerceBrowserPlugin)
class CommerceBrowserPlugin: CAPPlugin, CAPBridgedPlugin, WKNavigationDelegate, WKUIDelegate {
    let identifier = "CommerceBrowserPlugin"
    let jsName = "CommerceBrowser"
    let pluginMethods: [CAPPluginMethod] = ["open", "layout", "navigate", "back", "reload", "close", "evaluate"].map {
        CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise)
    }
    private var pages: [String: WKWebView] = [:]
    private var current: WKWebView?
    private var resumeObserver: NSObjectProtocol?
    private let domains = ["meituan.com", "dianping.com", "sankuai.com", "jd.com", "jd.hk", "360buy.com", "3.cn", "taobao.com", "tmall.com", "alipay.com", "tb.cn", "yangkeduo.com", "pinduoduo.com"]
    private func trusted(_ url: URL?) -> Bool {
        guard let url = url, url.scheme == "https", url.user == nil, let host = url.host else { return false }
        return domains.contains { host == $0 || host.hasSuffix("." + $0) }
    }
    override func load() {
        resumeObserver = NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            if let self = self, let page = self.current { self.event(page, loading: false) }
        }
    }
    deinit { if let observer = resumeObserver { NotificationCenter.default.removeObserver(observer) } }
    private func event(_ page: WKWebView, loading: Bool, error: String? = nil) {
        guard page === current else { return }
        var data: [String: Any] = ["url": page.url?.absoluteString ?? "", "title": page.title ?? "", "loading": loading]
        if let error = error { data["error"] = error }
        notifyListeners("browserEvent", data: data)
    }
    private func applyBounds(_ b: JSObject?, hidden: Bool = false) {
        guard let b = b, let host = bridge?.webView, let root = bridge?.viewController?.view, let page = current else { return }
        let viewport = (b["viewportWidth"] as? NSNumber)?.doubleValue ?? 0
        guard viewport > 0 else { return }
        let scale = host.bounds.width / CGFloat(viewport)
        let x = CGFloat((b["x"] as? NSNumber)?.doubleValue ?? 0) * scale
        let y = CGFloat((b["y"] as? NSNumber)?.doubleValue ?? 0) * scale
        let w = CGFloat((b["width"] as? NSNumber)?.doubleValue ?? 0) * scale
        let h = CGFloat((b["height"] as? NSNumber)?.doubleValue ?? 0) * scale
        page.frame = host.convert(CGRect(x: x, y: y, width: max(1,w), height: max(1,h)), to: root)
        page.isHidden = hidden
    }
    @objc func open(_ call: CAPPluginCall) {
        guard let value = call.getString("url"), let url = URL(string: value), trusted(url), let platform = call.getString("platform"), ["meituan","jd","taobao","pdd"].contains(platform) else { call.reject("不支持的平台地址"); return }
        DispatchQueue.main.async {
            guard let root = self.bridge?.viewController?.view else { call.reject("浏览容器尚未就绪"); return }
            self.current?.removeFromSuperview()
            let fresh = self.pages[platform] == nil
            let page: WKWebView
            if let existing = self.pages[platform] { page = existing }
            else {
                let config = WKWebViewConfiguration()
                config.websiteDataStore = .default()
                // A fresh configuration deliberately has no app message handlers or Capacitor bridge.
                page = WKWebView(frame: .zero, configuration: config)
                page.navigationDelegate = self; page.uiDelegate = self
                page.allowsBackForwardNavigationGestures = true
                page.scrollView.contentInsetAdjustmentBehavior = .never
                self.pages[platform] = page
            }
            self.current = page; root.addSubview(page); self.applyBounds(call.getObject("bounds"))
            if fresh { page.load(URLRequest(url: url)) } else { self.event(page, loading: false) }
            call.resolve()
        }
    }
    @objc func layout(_ call: CAPPluginCall) { DispatchQueue.main.async { self.applyBounds(call.getObject("bounds"), hidden: call.getBool("hidden") ?? false); call.resolve() } }
    @objc func navigate(_ call: CAPPluginCall) {
        guard let value = call.getString("url"), let url = URL(string: value), trusted(url) else { call.reject("仅支持平台 HTTPS 地址"); return }
        DispatchQueue.main.async { self.current?.load(URLRequest(url: url)); call.resolve() }
    }
    @objc func back(_ call: CAPPluginCall) { DispatchQueue.main.async { let can = self.current?.canGoBack ?? false; if can { self.current?.goBack() }; call.resolve(["canGoBack": can]) } }
    @objc func reload(_ call: CAPPluginCall) { DispatchQueue.main.async { self.current?.reload(); call.resolve() } }
    @objc func close(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            for page in self.pages.values { page.stopLoading(); page.removeFromSuperview(); page.navigationDelegate = nil; page.uiDelegate = nil }
            self.pages.removeAll(); self.current = nil; call.resolve()
        }
    }
    @objc func evaluate(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let page = self.current, self.trusted(page.url) else { call.reject("当前页面不可读取，请返回平台商品页"); return }
            page.evaluateJavaScript(call.getString("script") ?? "''") { value, error in
                if let error = error { call.reject(error.localizedDescription) }
                else { call.resolve(["value": value as? String ?? "null"]) }
            }
        }
    }
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) { event(webView, loading: true) }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { event(webView, loading: false) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { event(webView, loading: false, error: error.localizedDescription) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { event(webView, loading: false, error: error.localizedDescription) }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if url.scheme == "https" || url.absoluteString == "about:blank" { decisionHandler(.allow); return }
        let schemes = ["alipay", "alipays", "weixin", "mqqapi", "imeituan", "meituanwaimai", "openapp.jdmobile", "taobao", "tbopen", "pinduoduo"]
        if schemes.contains(url.scheme ?? "") {
            UIApplication.shared.open(url, options: [:]) { success in
                if !success { self.event(webView, loading: false, error: "未找到对应平台或支付应用，请选择页面提供的其他方式。") }
            }
        } else { event(webView, loading: false, error: "此链接无法在共逛窗口打开。") }
        decisionHandler(.cancel)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if action.targetFrame == nil, let url = action.request.url, url.scheme == "https" { webView.load(action.request) }
        return nil
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: webView.url?.host, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "确定", style: .default) { _ in completionHandler() })
        bridge?.viewController?.present(alert, animated: true)
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: webView.url?.host, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "取消", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "确定", style: .default) { _ in completionHandler(true) })
        bridge?.viewController?.present(alert, animated: true)
    }
}

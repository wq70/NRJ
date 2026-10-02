package com.nianrenjin.app;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Message;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.*;
import android.widget.FrameLayout;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.HashMap;
import java.util.Map;
import java.util.Arrays;

/** Independent shopping WebViews. Remote pages never receive the app's Capacitor bridge. */
@CapacitorPlugin(name = "CommerceBrowser", permissions = {
    @Permission(alias = "location", strings = {android.Manifest.permission.ACCESS_COARSE_LOCATION, android.Manifest.permission.ACCESS_FINE_LOCATION})
})
public class CommerceBrowserPlugin extends Plugin {
    private final Map<String, WebView> pages = new HashMap<>();
    private WebView current;
    private FrameLayout container;
    private OnBackPressedCallback backCallback;
    private ValueCallback<Uri[]> fileCallback;
    private PluginCall browserCall;
    private GeolocationPermissions.Callback locationCallback;
    private String locationOrigin;
    private static final String[] DOMAINS = {"meituan.com", "dianping.com", "sankuai.com", "jd.com", "jd.hk", "360buy.com", "3.cn", "taobao.com", "tmall.com", "alipay.com", "tb.cn", "yangkeduo.com", "pinduoduo.com"};
    private boolean trusted(String value) {
        if (value == null) return false;
        Uri u = Uri.parse(value); String h = u.getHost();
        if (!"https".equals(u.getScheme()) || h == null || u.getUserInfo() != null) return false;
        for (String d : DOMAINS) if (h.equals(d) || h.endsWith("." + d)) return true;
        return false;
    }
    private void event(WebView page, boolean loading, String error) {
        if (page != current) return;
        JSObject data = new JSObject(); data.put("url", page.getUrl()); data.put("title", page.getTitle()); data.put("loading", loading);
        if (error != null) data.put("error", error);
        notifyListeners("browserEvent", data);
    }
    private boolean route(WebView page, String value) {
        Uri u = Uri.parse(value); String scheme = u.getScheme();
        if ("https".equals(scheme)) return false;
        if (Arrays.asList("alipay", "alipays", "weixin", "mqqapi", "imeituan", "meituanwaimai", "openapp.jdmobile", "taobao", "tbopen", "pinduoduo").contains(scheme)) {
            try { getActivity().startActivity(new Intent(Intent.ACTION_VIEW, u).addCategory(Intent.CATEGORY_BROWSABLE)); }
            catch (Exception ex) { event(page, false, "未找到对应平台或支付应用，请选择页面提供的其他方式。"); }
        } else if ("intent".equals(scheme)) {
            try {
                Intent intent = Intent.parseUri(value, Intent.URI_INTENT_SCHEME);
                String target = intent.getDataString();
                if (target != null && !target.startsWith("intent:")) route(page, target);
            } catch (Exception ex) { event(page, false, "无法打开平台应用。"); }
        } else { event(page, false, "此链接无法在共逛窗口打开。"); }
        return true;
    }
    @SuppressLint("SetJavaScriptEnabled")
    private WebView createPage() {
        WebView page = new WebView(getActivity());
        WebSettings settings = page.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(true); settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setGeolocationEnabled(true);
        settings.setUserAgentString(settings.getUserAgentString().replace("; wv", ""));
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(page, true);
        page.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return route(view, request.getUrl().toString()); }
            @Override public void onPageStarted(WebView view, String url, Bitmap icon) { event(view, true, null); }
            @Override public void onPageFinished(WebView view, String url) { CookieManager.getInstance().flush(); event(view, false, null); }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) event(view, false, "页面加载失败，可刷新重试：" + error.getDescription());
            }
        });
        page.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onCreateWindow(WebView view, boolean dialog, boolean gesture, Message result) {
                if (!gesture) return false;
                WebView child = new WebView(getActivity());
                child.setWebViewClient(new WebViewClient() {
                    @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                        String url = request.getUrl().toString(); if (!route(page, url)) page.loadUrl(url);
                        v.post(v::destroy); return true;
                    }
                });
                ((WebView.WebViewTransport) result.obj).setWebView(child); result.sendToTarget(); return true;
            }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try { startActivityForResult(browserCall, params.createIntent(), "filesSelected"); }
                catch (Exception ex) { fileCallback.onReceiveValue(null); fileCallback = null; event(page, false, "无法打开文件选择器。"); }
                return true;
            }
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (!trusted(origin)) { callback.invoke(origin, false, false); return; }
                if (getPermissionState("location") == PermissionState.GRANTED) { callback.invoke(origin, true, false); return; }
                if (locationCallback != null) locationCallback.invoke(locationOrigin, false, false);
                locationOrigin = origin; locationCallback = callback;
                requestPermissionForAlias("location", browserCall, "locationResult");
            }
        });
        return page;
    }
    @ActivityCallback private void filesSelected(PluginCall call, ActivityResult result) {
        if (fileCallback != null) { fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.getResultCode(), result.getData())); fileCallback = null; }
    }
    @PermissionCallback private void locationResult(PluginCall call) {
        if (locationCallback != null) {
            boolean allowed = getPermissionState("location") == PermissionState.GRANTED;
            locationCallback.invoke(locationOrigin, allowed, false); locationCallback = null;
            if (!allowed && current != null) event(current, false, "未开启定位，请在平台页面手动选择收货地址。");
        }
    }
    private void bounds(JSObject b, boolean hidden) {
        if (container == null || b == null) return;
        double viewport = b.optDouble("viewportWidth", 0);
        if (viewport <= 0) return;
        float scale = (float) (bridge.getWebView().getWidth() / viewport);
        int[] root = new int[2]; int[] host = new int[2];
        bridge.getWebView().getLocationOnScreen(host); ((View) container.getParent()).getLocationOnScreen(root);
        FrameLayout.LayoutParams p = new FrameLayout.LayoutParams(Math.max(1, (int)(b.optDouble("width") * scale)), Math.max(1, (int)(b.optDouble("height") * scale)));
        p.leftMargin = host[0] - root[0] + (int)(b.optDouble("x") * scale);
        p.topMargin = host[1] - root[1] + (int)(b.optDouble("y") * scale);
        container.setLayoutParams(p); container.setVisibility(hidden ? View.GONE : View.VISIBLE);
    }
    @PluginMethod public void open(PluginCall call) {
        String url = call.getString("url", ""); String platform = call.getString("platform", "");
        if (!trusted(url) || !Arrays.asList("meituan", "jd", "taobao", "pdd").contains(platform)) { call.reject("不支持的平台地址"); return; }
        getActivity().runOnUiThread(() -> {
            browserCall = call;
            if (container == null) {
                container = new FrameLayout(getActivity());
                ((FrameLayout)getActivity().findViewById(android.R.id.content)).addView(container);
                backCallback = new OnBackPressedCallback(true) {
                    @Override public void handleOnBackPressed() {
                        if (current != null && current.canGoBack()) current.goBack();
                        else { destroyPages(); JSObject e = new JSObject(); e.put("closed", true); notifyListeners("browserEvent", e); }
                    }
                };
                getActivity().getOnBackPressedDispatcher().addCallback(getActivity(), backCallback);
            }
            current = pages.get(platform);
            boolean fresh = current == null;
            if (fresh) { current = createPage(); pages.put(platform, current); }
            container.removeAllViews(); container.addView(current, new FrameLayout.LayoutParams(-1, -1));
            bounds(call.getObject("bounds"), false);
            if (fresh) current.loadUrl(url); else event(current, false, null);
            call.resolve();
        });
    }
    @PluginMethod public void layout(PluginCall call) { getActivity().runOnUiThread(() -> { bounds(call.getObject("bounds"), call.getBoolean("hidden", false)); call.resolve(); }); }
    @PluginMethod public void navigate(PluginCall call) {
        String url = call.getString("url", ""); if (!trusted(url)) { call.reject("仅支持平台 HTTPS 地址"); return; }
        getActivity().runOnUiThread(() -> { if(current!=null)current.loadUrl(url); call.resolve(); });
    }
    @PluginMethod public void back(PluginCall call) { getActivity().runOnUiThread(() -> { boolean can = current != null && current.canGoBack(); if(can)current.goBack(); JSObject r=new JSObject();r.put("canGoBack",can);call.resolve(r); }); }
    @PluginMethod public void reload(PluginCall call) { getActivity().runOnUiThread(() -> { if(current!=null)current.reload();call.resolve(); }); }
    @PluginMethod public void evaluate(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if(current==null || !trusted(current.getUrl())) { call.reject("当前页面不可读取，请返回平台商品页");return; }
            current.evaluateJavascript(call.getString("script", "''"), value -> {
                try { Object decoded=new org.json.JSONTokener(value).nextValue(); JSObject r=new JSObject();r.put("value",decoded);call.resolve(r); }
                catch(Exception ex){call.reject("读取页面失败");}
            });
        });
    }
    private void destroyPages() {
        if(locationCallback!=null){locationCallback.invoke(locationOrigin,false,false);locationCallback=null;}
        if(fileCallback!=null){fileCallback.onReceiveValue(null);fileCallback=null;}
        if(container!=null){container.removeAllViews();((ViewGroup)container.getParent()).removeView(container);container=null;}
        for(WebView page:pages.values()){page.stopLoading();page.destroy();} pages.clear();current=null;
        if(backCallback!=null){backCallback.remove();backCallback=null;}
        CookieManager.getInstance().flush();
    }
    @PluginMethod public void close(PluginCall call) { getActivity().runOnUiThread(() -> {destroyPages();call.resolve();}); }
    @Override protected void handleOnResume() { if(current!=null)event(current,false,null); }
    @Override protected void handleOnDestroy() { getActivity().runOnUiThread(this::destroyPages); }
}

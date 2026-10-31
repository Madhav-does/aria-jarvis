package com.aria.jarvis;

import android.graphics.Color;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        try {
            WebView webView = this.getBridge().getWebView();
            if (webView != null) {
                webView.setBackgroundColor(Color.parseColor("#02070D"));
                WebSettings settings = webView.getSettings();
                settings.setLoadWithOverviewMode(true);
                settings.setUseWideViewPort(true);
                settings.setSupportZoom(false);
                settings.setBuiltInZoomControls(false);
                settings.setDisplayZoomControls(false);
            }
        } catch (Exception ignored) {}
    }
}

package com.nianrenjin.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(CommerceBrowserPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

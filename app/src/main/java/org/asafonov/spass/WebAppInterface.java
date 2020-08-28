package org.asafonov.spass;

import android.webkit.JavascriptInterface;
import android.content.ClipboardManager;
import android.content.ClipData;
import android.content.Context;

public class WebAppInterface {
    private Context mContext;

    public WebAppInterface (Context mContext) {
        this.mContext = mContext;
    }

    @JavascriptInterface
    public void copyToClipboard (String text) {
        ClipboardManager clipboard = (ClipboardManager) this.mContext.getSystemService(Context.CLIPBOARD_SERVICE);
        ClipData clip = ClipData.newPlainText("demo", text);
        clipboard.setPrimaryClip(clip);
    }
}

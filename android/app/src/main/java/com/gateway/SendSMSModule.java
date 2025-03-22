//DirectSmsModule.java  : This is the name of the Java Class/File
package com.gateway; //make sure to change to your project's actual name.

import com.facebook.react.bridge.Callback;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import android.telephony.SmsManager;  //++ make sure this package is available always
import android.telephony.SmsMessage;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;

import java.util.ArrayList;
import java.util.List;

class DirectSmsModule extends ReactContextBaseJavaModule implements SMSReceiver.SMSReceivedListener {
    public ReactApplicationContext _reactContext;

    public DirectSmsModule(ReactApplicationContext reactContext) {
        super(reactContext); //required by React Native
        _reactContext = reactContext;
        System.out.println("Started listening sms receive");
        SMSReceiver.addSMSListner(this);
    }

    @Override
    //getName is required to define the name of the module represented in JavaScript
    public String getName() {
        return "DirectSms";
    }

    @SuppressLint("MissingPermission")
    @ReactMethod
    public void sendDirectSms(String phoneNumber, String msg, Integer queueId, Integer simSubscriptionId) {
        try {
            System.out.println("sending new message");
            String SENT = "SMS_SENT_" + queueId;
            String DELIVERED = "SMS_DELIVERED_" + queueId;
            ArrayList<PendingIntent> sentPendingIntents = new ArrayList<PendingIntent>();
            ArrayList<PendingIntent> deliveredPendingIntents = new ArrayList<PendingIntent>();
            PendingIntent sentPI = PendingIntent.getBroadcast(_reactContext, 0,
                    new Intent(SENT), PendingIntent.FLAG_IMMUTABLE);

            PendingIntent deliveredPI = PendingIntent.getBroadcast(_reactContext, 0,
                    new Intent(DELIVERED), PendingIntent.FLAG_IMMUTABLE);

            WritableMap sendparams = Arguments.createMap();
            WritableMap deliveredparams = Arguments.createMap();
            sendparams.putInt("queue_id", queueId);
            deliveredparams.putInt("queue_id", queueId);

            //---when the SMS has been sent---
            _reactContext.registerReceiver(new BroadcastReceiver() {
                public void onReceive(Context arg0, Intent arg1) {
                    switch (getResultCode()) {

                        case Activity.RESULT_OK:
                            _reactContext
                                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                                    .emit("onMessageSent", sendparams);
                            break;
                        default:
                            sendparams.putInt("error_code", getResultCode());
                            _reactContext
                                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                                    .emit("onMessageFailed", sendparams);
                            break;
                    }
                    _reactContext.unregisterReceiver(this);
                }
            }, new IntentFilter(SENT));

            //---when the SMS has been delivered---
            _reactContext.registerReceiver(new BroadcastReceiver() {
                @Override
                public void onReceive(Context arg0, Intent arg1) {
                    switch (getResultCode()) {
                        case Activity.RESULT_OK:
                            _reactContext
                                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                                    .emit("onMessageDelivered", deliveredparams);
                            break;
                        case Activity.RESULT_CANCELED:
                            _reactContext
                                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                                    .emit("onMessageDeliveredFailed", deliveredparams);
                            break;
                    }
                    _reactContext.unregisterReceiver(this);
                }
            }, new IntentFilter(DELIVERED));
            SmsManager smsManager = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                SubscriptionManager localSubscriptionManager = SubscriptionManager.from(_reactContext);

                if (localSubscriptionManager.getActiveSubscriptionInfoCount() > 1) {
                    smsManager = SmsManager.getSmsManagerForSubscriptionId(simSubscriptionId);
                }else{
                    smsManager = SmsManager.getDefault();
                }
            } else {
                smsManager = SmsManager.getDefault();
            }
            if (smsManager == null) throw new Exception("Sms Manager not found");

            ArrayList<String> parts = smsManager.divideMessage(msg);
            for (int i = 0; i < parts.size(); i++) {
                sentPendingIntents.add(i, sentPI);

                deliveredPendingIntents.add(i, deliveredPI);
            }
            smsManager.sendMultipartTextMessage(phoneNumber, null, parts, sentPendingIntents, deliveredPendingIntents);
        } catch (Exception ex) {
            System.out.println(ex.getMessage());
            System.out.println("couldn't send message.");
        }
    }

    @Override
    public void message(ArrayList<SmsMessage> messages) {
        System.out.println("received an sms on message fuction");
        WritableMap params = Arguments.createMap();
        String fullBody = "";
        for (SmsMessage message : messages) {
            fullBody += message.getMessageBody();
            params.putString("from", message.getOriginatingAddress());
            params.putInt("sms_index", message.getIndexOnIcc());
        }
        params.putString("body", fullBody);

        _reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit("onMessageReceived", params);
    }

    @ReactMethod
    public void addListener(String eventName) {
        System.out.println("add listener: " + eventName);
    }

    @ReactMethod
    public void removeListeners(Integer count) {
        System.out.println("remove listener: " + count);
    }

    @SuppressLint("MissingPermission")
    @ReactMethod
    public void getSIMInfo(Callback callback) {
        WritableArray simInfoList = Arguments.createArray();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
        SubscriptionManager localSubscriptionManager = SubscriptionManager.from(_reactContext);
        if (localSubscriptionManager.getActiveSubscriptionInfoCount() > 0) {
            for(SubscriptionInfo localList :localSubscriptionManager.getActiveSubscriptionInfoList()){
                String generatedString=localList.getSimSlotIndex()+":"+localList.getSubscriptionId()+":"+localList.getCarrierName();
                simInfoList.pushString(generatedString);
            }

            }
        }
        callback.invoke(simInfoList);
    }


}

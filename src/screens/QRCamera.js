import React from "react";
import QRCodeScanner from "react-native-qrcode-scanner";
import { RNCamera } from "react-native-camera";
import { Alert, NativeModules } from "react-native";
import { navigationRef } from "../utils/RootNavigation";
import { removeData, setData } from "../utils/Helpers";
import { storage } from "../utils/Constants";
import CookieManager from "@react-native-cookies/cookies";
import { addDevice } from "../utils/Api";
import DeviceInfo from "react-native-device-info";

const DirectSms = NativeModules.DirectSms;

Date.prototype.addMonths = function(m) {
  let d = new Date(this);
  let years = Math.floor(m / 12);
  let months = m - (years * 12);
  if (years) d.setFullYear(d.getFullYear() + years);
  if (months) d.setMonth(d.getMonth() + months);
  return d;
};
const setServerData=(data)=>{

  return Promise.all([
    setData(storage.server, data.server),
    setData(storage.token, data.token),
    CookieManager.set(data.server, {
      name: "wv_token",
      value: data.token,
      path: "/",
      version: "1",
      expires: new Date().addMonths(6).toString(),
    })
  ])
}
const onSuccess = async (e) => {
  try {
    let data = JSON.parse(e.data);
    if (data && data.hasOwnProperty("token") && data.hasOwnProperty("server") && data.hasOwnProperty("type")) {
      const [s,t,c]=await setServerData(data);
      if (data.type == "add") {
        DirectSms.getSIMInfo(async (simInfo)=>{
          let brand = DeviceInfo.getBrand();
          let model = DeviceInfo.getModel();
          let app_version = DeviceInfo.getVersion();
          let android_version = await DeviceInfo.getApiLevel();
          let device_id = await DeviceInfo.getUniqueId();

          addDevice({
            "name": brand,
            "model": model,
            "app_version": app_version,
            "android_version": android_version,
            "device_unique_id": device_id,
            "sim_info":simInfo
          }).then((res) => {
              navigationRef.navigate("WebView", data);
          }).catch((err) => {
            removeData(storage.server,storage.token,storage.queues)
            if (err.hasOwnProperty('response') && err.response.hasOwnProperty('status') && err.response.status == 400) {
              const messages = err.response.data.message;
              let alertMessage = "";
              if (typeof messages == "object") {
                for (const key in messages) {
                  alertMessage += messages[key][0] + "\n\r";
                }
              } else {
                alertMessage = messages;
              }
              Alert.alert("Invalid QR Code", alertMessage, [
                {
                  text: "Ok",
                  onPress: () => {
                    navigationRef.navigate("Login");
                  },
                },
              ]);
            }else{
              Alert.alert("Invalid", err.message, [
                {
                  text: "Ok",
                  onPress: () => {
                    navigationRef.navigate("Login");
                  },
                },
              ]);
            }
          });
        });

      }

    } else {
      throw new Error("Invalid Json");
    }
  } catch (e) {
    removeData(storage.server,storage.token,storage.queues)
    Alert.alert("Invalid QR Code", "Please scan the valid qr code", [
      {
        text: "Ok",
        onPress: () => {
          navigationRef.navigate("Login");
        },
      },
    ]);
  }

};

const QRCamera = ( ) => {
  return (
    <QRCodeScanner
      showMarker={true}
      onRead={onSuccess}
      flashMode={RNCamera.Constants.FlashMode.auto}
    />
  );
};

export default QRCamera;

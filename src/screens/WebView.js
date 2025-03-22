import React, { useRef, useEffect, useState } from "react";
import { WebView } from "react-native-webview";
import { View, useWindowDimensions, ActivityIndicator, Alert, BackHandler, NativeModules } from "react-native";
import Draggable from "react-native-draggable";
import { getQueues, updateQueue, getSendingSettings, storeInbound } from "../utils/Api";
import DeviceInfo from "react-native-device-info";
import BackgroundService from "react-native-background-actions";
import { Linking, NativeEventEmitter } from "react-native";
import { storage, status } from "../utils/Constants";
import { getData, removeData, setData } from "../utils/Helpers";
import * as RNLocalize from "react-native-localize";

const DirectSms = NativeModules.DirectSms;
const DirectSmsEmitter = new NativeEventEmitter(DirectSms);

Linking.addEventListener("url", (evt) => {
  console.log(evt.url);
});

DirectSmsEmitter.addListener("onMessageDelivered", async (evt) => {
  const device_id = await DeviceInfo.getUniqueId();
  updateQueue(device_id, evt.queue_id, status.delivered).then(() => {
    console.log("Delivered", evt.queue_id);
  }).catch((err => {
    console.log(err);
  }));
});

DirectSmsEmitter.addListener("onMessageSent", (evt) => {
  console.log("on sent", evt);
});

DirectSmsEmitter.addListener("onMessageFailed",async (evt) => {
  console.log("on sent failed", evt);
  const device_id = await DeviceInfo.getUniqueId();
  updateQueue(device_id, evt.queue_id, status.failed,evt.error_code).then(() => {
    console.log("Delivered failed", evt.queue_id);
  }).catch((err => {
    console.log(err);
  }));
});

DirectSmsEmitter.addListener("onMessageReceived", async (evt) => {
  const device_id = await DeviceInfo.getUniqueId();
  const sms = {
    from: evt.from,
    body: evt.body,
    device_id: device_id,
  };
  storeInbound(sms).then((res) => {
    console.log(res);
  }).catch(error => console.log(error));

});

const sleep = (time) => new Promise((resolve) => setTimeout(() => resolve(), time));
const WebViewApp = ({ route, navigation }) => {
  const { height, width } = useWindowDimensions();
  const [processing, setProcessing] = useState(BackgroundService.isRunning());

  const { server, token } = route.params;
  const webRef = useRef();
  const taskOptions = {
    taskName: "QueueProcess",
    taskTitle: "Waiting",
    taskDesc: "Waiting for next queue",
    taskIcon: {
      name: "ic_launcher",
      type: "mipmap",
    },
    color: "#058072",
    linkingURI: "queueProcessScheme://show/process", // Add this
    parameters: {
      delay: 2000,
    },
    progressBar: {
      indeterminate: true,
    },
  };

  const isValidDate = (startTime, endTime) => {
    const currentDate = new Date();

    const startDate = new Date(currentDate.getTime());
    startDate.setHours(startTime.split(":")[0]);
    startDate.setMinutes(startTime.split(":")[1]);

    const endDate = new Date(currentDate.getTime());
    endDate.setHours(endTime.split(":")[0]);
    endDate.setMinutes(endTime.split(":")[1]);

    return startDate < currentDate && endDate > currentDate;
  };
  const timeToWait = 6 * 1000; //wait for 6 seconds
  const _processBackgroundTask = async (taskDataArguments) => {
    const { delay } = taskDataArguments;
    await new Promise(async (resolve) => {
      for (let i = 0; BackgroundService.isRunning(); i++) {
        const preQueues = await getData(storage.queues);
        if (preQueues) {
          const length = Object.keys(preQueues).length;
          //looping through queues and sending sms
          for (let j = 0; j < length; j++) {
            const queue = preQueues[j];
            console.log(`sending sms to ${queue.to}`);
            //send sms here
            DirectSms.sendDirectSms(queue.to.toString(), queue.body.toString(), parseInt(queue.id),parseInt(queue.subscriber_id)); //subscriber_id means sim id on device

            //Updating notification bar
            const percentage = ((100 / length) * j);
            await BackgroundService.updateNotification({
              taskDesc: percentage + "%",
              progressBar: {
                max: length,
                value: j,
                indeterminate: false,
              },
            }).catch(err => {
              console.log(err)
            });
            await sleep(delay);

          }
        }
        //After processing all queues updating notification bar and checking for new queues
        await BackgroundService.updateNotification({
          taskTitle: "Waiting",
          taskDesc: "Waiting for next queue", progressBar: { indeterminate: true },
        }).catch(err => {
        });
        await removeData(storage.queues);
        const device_timezone = RNLocalize.getTimeZone();
        const device_id = await DeviceInfo.getUniqueId();
        const sending_settings = await getData(storage.sending_settings);
        if (!sending_settings.hasOwnProperty("minute_limit") || !sending_settings.hasOwnProperty("message_limit") || !sending_settings.hasOwnProperty("start_time") || !sending_settings.hasOwnProperty("end_time")) {
          console.log("Sending settings not configured");
          await sleep(timeToWait);
          continue;
        }
        const limit = sending_settings.minute_limit > 0 ? (sending_settings.message_limit / sending_settings.minute_limit) : 0;
        if (sending_settings.start_time && !isValidDate(sending_settings.start_time, sending_settings.end_time)) {
          console.log("Not in sending time frame");
          await sleep(timeToWait); //wait for 60 seconds
          continue;
        }
        console.log("Getting queues",device_id);
        await getQueues(device_id, device_timezone, limit).then(async (res) => {
          console.log(res.queues);
          if (Object.keys(res.queues).length !== 0) {
            setProcessing(true);
            await setData(storage.queues, res.queues);
          }
        }).catch(async (err) => {
          console.log(err.response);
          setProcessing(false);
          await BackgroundService.stop();
        });
        await sleep(timeToWait); //wait for 60 seconds
      }
    });
  };

  const _handleProcessing = async () => {
    setProcessing(true);
    getSendingSettings().then(async (res) => {
      await setData(storage.sending_settings, res.data);
      await BackgroundService.start(_processBackgroundTask, taskOptions);
    }).catch((err) => {
      if(err.response.data.hasOwnProperty('message')){
        Alert.alert(
          "Error",
          err.response.data.message);
      }
      setProcessing(false);
    });
  };

  const _handleStopProcessing = async () => {
    setProcessing(false);
    await BackgroundService.stop();
  };

  const processQueue = () => {
    Alert.alert(
      "Confirmation",
      "Are you sure you want to process the queue?",
      [
        {
          text: "Cancel", onPress: () => {
          },
        },
        { text: "OK", onPress: _handleProcessing },
      ],
      { cancelable: false });
  };

  const stopProcessQueue = () => {
    Alert.alert(
      "Confirmation",
      "Are you sure you want to stop the process?",
      [
        {
          text: "Cancel", onPress: () => {
          },
        },
        { text: "OK", onPress: _handleStopProcessing },
      ],
      { cancelable: false });
  };

  const onBackPress = () => {
    webRef.current.goBack();
    return true;
  };

  useEffect(() => {
      BackHandler.addEventListener("hardwareBackPress", onBackPress);

      getSendingSettings().then((res) => {
        setData(storage.sending_settings, res.data);
      }).catch((err) => {
        console.log(err);
      });

      return () => {
        BackHandler.removeEventListener("hardwareBackPress", onBackPress);
      };
    }
    , [],
  );

  const FloatingButton = () => {
    return (
      processing === false ? (
        <Draggable shouldReverse x={width / 2 - 25} y={0} maxY={height - 500} minX={50} maxX={width - 50}
                   renderSize={56}
                   renderColor="white" imageSource={require("../Icons/play_button.png")} isCircle
                   onShortPressRelease={processQueue} />
      ) : (
        <Draggable shouldReverse x={width / 2 - 25} y={0} maxY={height - 500} minX={50} maxX={width - 50}
                   renderSize={56}
                   renderColor="white" imageSource={require("../Icons/pause_button.png")} isCircle
                   onShortPressRelease={stopProcessQueue} />
      )

    );
  };

  const CustomActivityIndicator = () => {
    return (
      <ActivityIndicator
        animating={true}
        color="#84888d"
        size="large"
        hidesWhenStopped={true}
        style={{ alignItems: "center", justifyContent: "center", flex: 1 }} />
    );
  };
  const handleMessage = (event) => {
    navigation.setOptions({ title: event.nativeEvent.title });
  };
  const INJECTED_JAVASCRIPT = `(function() {
        $('.user-menu').hide()
        $('.user-panel').attr('style', function(i,s) { return (s || '') + 'display: none !important;' });
        $('.item-settings,.item-ticket,.item-api-token,.item-device,.item-billing').hide()
        window.ReactNativeWebView.postMessage(JSON.stringify(window.title));
    })();`;
  const displayError = (e) => {
    Alert.alert(
      "Error",
      "Something went wrong! Check your internet connection or server",
      [
        { text: "OK", onPress: () => navigation.popToTop() },
      ],
      { cancelable: false });
  };

  return (
    <>
      <WebView ref={webRef}
               sharedCookiesEnabled={true}
               source={{ uri: server + "/login" }}
               style={{ marginTop: 20 }}
               onError={displayError}
               startInLoadingState={true}
               renderLoading={() => <CustomActivityIndicator />
               }
               allowsBackForwardNavigationGestures
               injectedJavaScript={INJECTED_JAVASCRIPT}
               onMessage={handleMessage}
               onLoadStart={() => {
                 navigation.setOptions({ headerTitle: () => <CustomActivityIndicator /> });
               }}
               onLoadEnd={(syntheticEvent) => {
                 // update component to be aware of loading status
                 const { nativeEvent } = syntheticEvent;
                 navigation.setOptions({ headerTitle: null, title: nativeEvent.title });

               }}
      />

      <View style={{ backgroundColor: "rgba(0,0,0,0.01)", padding: 30, width: 50 }}>
        <FloatingButton />
      </View>
    </>
  );
};

export default WebViewApp;

import React from "react";

import Icon from "react-native-vector-icons/Ionicons";
import { TouchableOpacity } from "react-native";
import { navigationRef } from "../utils/RootNavigation";
import { removeData } from "../utils/Helpers";
import { storage } from "../utils/Constants";

const WebViewRight = () => {
  const exitToLogin = async () => {
    await removeData(storage.server,storage.token,storage.queues).catch(()=>{console.log("unable to delete storage")})
    navigationRef.navigate("Login");
  };
  return (
    <TouchableOpacity onPress={exitToLogin}>
      <Icon name="exit-outline" size={30} color="#FF4961" />
    </TouchableOpacity>

  );
};

export default WebViewRight;

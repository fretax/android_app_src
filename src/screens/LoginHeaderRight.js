import React from "react";

import Icon from "react-native-vector-icons/FontAwesome5";
import { TouchableOpacity, Linking } from "react-native";

const LoginHeaderRight = () => {
  const LoginExternalInfo = async () => {
    const url = "https://picotech.gitbook.io/pico_msg/how-to/how-to-install-and-configure-apk";
    await Linking.openURL(url);
  };
  return (
    <TouchableOpacity onPress={LoginExternalInfo}>
      <Icon name="question-circle" size={30} color="#FF4961" />
    </TouchableOpacity>

  );
};

export default LoginHeaderRight;

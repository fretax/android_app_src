import React, { useEffect} from "react";
import type { Node } from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  useColorScheme,

} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen,QRCamera,WebView } from "./screens";
import { navigationRef } from './utils/RootNavigation';
import WebViewRight  from './screens/WebViewRight';
import { getData } from "./utils/Helpers";
import { storage } from "./utils/Constants";

const App: () => Node = () => {
  const isDarkMode = useColorScheme() === "dark";
  const Stack = createNativeStackNavigator();
  useEffect( ()=>{
    (async ()=>{
      const token=await getData(storage.token)
      const server=await getData(storage.server)
      console.log(token,server);
      if (token && server){
        navigationRef.current.navigate("WebView",{token,server});
      }
    })()

  },[])

  return (
    <NavigationContainer ref={navigationRef}>
      <SafeAreaView style={[styles.container]}>
        <StatusBar barStyle={isDarkMode ? "dark-content" : "light-content"} />
        <Stack.Navigator>
          <Stack.Screen name={"Login"}  component={LoginScreen} options={{ title: 'Welcome',headerTitleAlign: 'center'}}/>
          <Stack.Screen name="QRCamera"  component={QRCamera} options={{ title: 'QR Code'}}/>
          <Stack.Screen name="WebView"  component={WebView} options={{ headerBackVisible:false, headerRight:()=> <WebViewRight/>,  title: 'Web App',headerTitleAlign: 'center' }}/>
        </Stack.Navigator>
      </SafeAreaView>
    </NavigationContainer>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f7f7",
  },
});
export default App;

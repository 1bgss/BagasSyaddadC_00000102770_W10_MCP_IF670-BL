import "react-native-url-polyfill/auto";
import { decode } from "base64-arraybuffer";

import * as Location from "expo-location";
import React, { useState, useEffect } from "react";

import {
  Button,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";

import MapView, {
  Marker,
  Region,
  UrlTile,
} from "react-native-maps";

import * as ImagePicker from "expo-image-picker";
import { Camera } from "expo-camera";

import * as FileSystem from "expo-file-system/legacy";

import { supabase } from "../utils/supabase";
import * as Notifications from "expo-notifications";
import {
  useDispatch,
  useSelector,
} from "react-redux";

import {
  incrementSuccess,
  incrementFailed,
} from "../store/counter.slice";

import { RootState }
  from "../store/store";

type Coordinates = {
  latitude: number;
  longitude: number;
};

const { height } = Dimensions.get("window");

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
export default function Index() {
  const [location, setLocation] =
    useState<Coordinates | null>(null);

  const [image, setImage] =
    useState<string | null>(null);

  const registerForNotifications =
  async () => {
    const { status } =
      await Notifications.requestPermissionsAsync();

    if (status !== "granted") {
      alert(
        "Notification permission denied!"
      );
    }
  };

    useEffect(() => {
    registerForNotifications();
  }, []);

  const sendNotification = async (
  title: string,
  body: string
) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
    },
    trigger: null,
  });
};

const dispatch = useDispatch();

const successCount =
  useSelector(
    (state: RootState) =>
      state.counter.successCount
  );

const failedCount =
  useSelector(
    (state: RootState) =>
      state.counter.failedCount
  );

  // =========================
  // GET LOCATION
  // =========================
  const getLocation = async () => {
    const { status } =
      await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      alert("Location permission denied!");
      return;
    }

    const loc =
      await Location.getCurrentPositionAsync({});

    setLocation({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    });
  };

  // =========================
  // OPEN CAMERA
  // =========================
  const openCamera = async () => {
    const permission =
      await Camera.requestCameraPermissionsAsync();

    if (!permission.granted) {
      alert("Camera permission required!");
      return;
    }

    const result =
      await ImagePicker.launchCameraAsync({
        mediaTypes:
          ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

    if (!result.canceled) {
      setImage(result.assets[0].uri);

      // otomatis ambil lokasi
      await getLocation();
    }
  };

  // =========================
  // SAVE PHOTO + LOCATION
  // =========================
  const savePhotoWithLocation = async () => {
    if (!image || !location) {
      alert("Image or location missing!");
      return;
    }

    try {
      // =========================
      // READ IMAGE AS BASE64
      // =========================
      const base64 =
      await FileSystem.readAsStringAsync(
        image,
          {
            encoding: "base64",
          }
      );

      // =========================
      // CONVERT TO ARRAY BUFFER
      // =========================
      const arrayBuffer = decode(base64);

      // =========================
      // FILE NAME
      // =========================
      const fileName = `photo_${Date.now()}.jpg`;

      // =========================
      // UPLOAD TO STORAGE
      // =========================
      const { error: uploadError } =
        await supabase.storage
          .from("photos")
          .upload(fileName, arrayBuffer, {
          contentType: "image/jpeg",
          upsert: true,
          });

      if (uploadError) {
  dispatch(
    incrementFailed()
  );

  console.log(
    "UPLOAD ERROR:",
    uploadError
  );

  await sendNotification(
    "❌ Upload Gagal",
    `Latitude: ${location.latitude}
Longitude: ${location.longitude}

${uploadError.message}`
  );

  alert("Upload failed!");

  return;
}

      // =========================
      // GET PUBLIC URL
      // =========================
      const { data } = supabase.storage
        .from("photos")
        .getPublicUrl(fileName);

      const publicUrl =
        data.publicUrl;

      // =========================
      // SAVE DATABASE
      // =========================
      const { error: dbError } =
        await supabase
          .from("locations")
          .insert([
            {
              image_url: publicUrl,
              latitude:
                location.latitude,
              longitude:
                location.longitude,
            },
          ]);

      if (dbError) {
  dispatch(
  incrementFailed()
  );

  console.log(
    "DATABASE ERROR:",
    dbError
  );

  await sendNotification(
    "❌ Database Gagal",
    `Latitude: ${location.latitude}
Longitude: ${location.longitude}

${dbError.message}`
  );

  alert(
    "Database save failed!"
  );

  return;
}

dispatch(
  incrementSuccess()
);

      console.log(
  "SUCCESS:",
  publicUrl
);

await sendNotification(
  "✅ Data Berhasil Disimpan",
  `Success : ${successCount + 1}
Failed  : ${failedCount}

Latitude : ${location.latitude}
Longitude: ${location.longitude}

Foto berhasil diupload ke Supabase dan data lokasi berhasil disimpan.`
);

alert(
  "Photo + location saved successfully!"
);
    } catch (err: any) {
  dispatch(
  incrementFailed()
  );
  
  console.log(
    "GENERAL ERROR:",
    err
  );

  await sendNotification(
    "❌ Terjadi Kesalahan",
    err?.message ??
      "Unknown error"
  );

  alert("Something went wrong!");
}
};

  // =========================
  // MAP PRESS
  // =========================
  const handleMapPress = (
    event: any
  ) => {
    const { latitude, longitude } =
      event.nativeEvent.coordinate;

    setLocation({
      latitude,
      longitude,
    });
  };

  // =========================
  // MARKER DRAG
  // =========================
  const handleDragEnd = (
    event: any
  ) => {
    const { latitude, longitude } =
      event.nativeEvent.coordinate;

    setLocation({
      latitude,
      longitude,
    });
  };

  // =========================
  // MAP REGION
  // =========================
  const region: Region | undefined =
    location
      ? {
          latitude:
            location.latitude,

          longitude:
            location.longitude,

          latitudeDelta: 0.01,

          longitudeDelta: 0.01,
        }
      : undefined;

  return (
    <View style={styles.container}>
      {/* CAMERA BUTTON */}
      <View style={styles.button}>
        <Button
          title="OPEN CAMERA"
          onPress={openCamera}
        />
      </View>

      {/* IMAGE PREVIEW */}
      {image && (
        <>
          <Image
            source={{ uri: image }}
            style={styles.image}
          />

          {/* MAP */}
          {location && (
            <>
              <MapView
                style={styles.map}
                initialRegion={region}
                onPress={handleMapPress}
              >
                <UrlTile urlTemplate="https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png" />

                <Marker
                  coordinate={location}
                  draggable
                  onDragEnd={
                    handleDragEnd
                  }
                  title="Photo Location"
                />
              </MapView>

              {/* LOCATION INFO */}
              <View style={styles.info}>
                <Text>
                  Latitude:{" "}
                  {location.latitude}
                </Text>

                <Text>
                  Longitude:{" "}
                  {location.longitude}
                </Text>

                <Text>
                Success: {successCount}
                </Text>

                <Text>
                Failed: {failedCount}
                </Text>

                <Button
                  title="SAVE PHOTO + LOCATION"
                  onPress={
                    savePhotoWithLocation
                  }
                />
              </View>
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    backgroundColor: "#fff",
  },

  button: {
    margin: 10,
  },

  image: {
    width: "100%",
    height: 250,
  },

  map: {
    height: height * 0.35,
    width: "100%",
  },

  info: {
    padding: 16,
    backgroundColor: "#fff",
  },
});
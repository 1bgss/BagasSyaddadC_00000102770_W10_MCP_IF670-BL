import "react-native-url-polyfill/auto";
import { decode } from "base64-arraybuffer";

import * as Location from "expo-location";
import React, { useState } from "react";

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

type Coordinates = {
  latitude: number;
  longitude: number;
};

const { height } = Dimensions.get("window");

export default function Index() {
  const [location, setLocation] =
    useState<Coordinates | null>(null);

  const [image, setImage] =
    useState<string | null>(null);

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
        console.log(
          "UPLOAD ERROR:",
          uploadError
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
        console.log(
          "DATABASE ERROR:",
          dbError
        );

        alert(
          "Database save failed!"
        );

        return;
      }

      console.log(
        "SUCCESS:",
        publicUrl
      );

      alert(
        "Photo + location saved successfully!"
      );
    } catch (err) {
      console.log(
        "GENERAL ERROR:",
        err
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
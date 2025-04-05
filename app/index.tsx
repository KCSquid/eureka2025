import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';

export default function Home() {
  const [location, setLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation.coords);
    })();
  }, []);

  return (
    <View>
      {errorMsg ? (
        <Text>{errorMsg}</Text>
      ) : (
        <Text>
          {location
            ? `Latitude: ${location.latitude}, Longitude: ${location.longitude}`
            : 'Fetching location...'}
        </Text>
      )}
    </View>
  );
}
